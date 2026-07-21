# app/services/agent_service.py

import os
import time
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
from tenacity import retry, stop_after_attempt, wait_exponential
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.prompt import SYSTEM_INSTRUCTION
from app.core.memory import get_chat_history, save_chat_history, is_model_bypassed, trip_circuit_breaker

# [TAMBAHAN PEKERJAAN 4] Import Global Cache
from app.core.global_cache import (
    check_semantic_cache, save_semantic_cache,
    check_tool_cache, save_tool_cache
)


# 1. Mengimpor Skema Alat (Buku Menu Gemini)
from app.models.tool_schema import (
    CekBiayaRegulerSchema,
    CekBiayaRPLSchema,
    CekBiayaPSPPISchema,
    CekJadwalPMBSchema,
    CekAnalitikGlobalSchema,
    SearchPineconeSchema
)
from app.tools.guardrails_tool import RejectOutDomainInput

# 2. Mengimpor Fungsi Eksekutor (Koki Dapur Python)
from app.tools.supabase_tool import (
    query_biaya_reguler,
    query_biaya_rpl,
    query_biaya_psppi,
    query_jadwal_pmb,
    query_analitik_global
)
from app.tools.pinecone_tool import search_pinecone
from app.tools.guardrails_tool import reject_out_of_domain, OutOfDomainException

# ==========================================
# INISIALISASI KLIEN GEMINI
# ==========================================
client = genai.Client(api_key=settings.GEMINI_API_KEY)

# ==========================================
# TAHAP 2.2: DEKLARASI TOOLS & REGISTRY
# ==========================================
# Peta Penjodohan: Mengubah String dari Gemini menjadi Fungsi Eksekusi
TOOL_EXECUTORS = {
    CekBiayaRegulerSchema.__name__: query_biaya_reguler,
    CekBiayaRPLSchema.__name__: query_biaya_rpl,
    CekBiayaPSPPISchema.__name__: query_biaya_psppi,
    CekJadwalPMBSchema.__name__: query_jadwal_pmb,
    CekAnalitikGlobalSchema.__name__: query_analitik_global,
    SearchPineconeSchema.__name__: search_pinecone,
    RejectOutDomainInput.__name__: reject_out_of_domain
}

# Kamus Pemetaan Tool ke Database (Sesuai Permintaan Lu)
TOOL_DATABASE_MAP = {
    CekBiayaRegulerSchema.__name__: f"{CekBiayaRegulerSchema.__name__} (Supabase)",
    CekBiayaRPLSchema.__name__: f"{CekBiayaRPLSchema.__name__} (Supabase)",
    CekBiayaPSPPISchema.__name__: f"{CekBiayaPSPPISchema.__name__} (Supabase)",
    CekJadwalPMBSchema.__name__: f"{CekJadwalPMBSchema.__name__} (Supabase)",
    CekAnalitikGlobalSchema.__name__: f"{CekAnalitikGlobalSchema.__name__} (Supabase)",
    SearchPineconeSchema.__name__: f"{SearchPineconeSchema.__name__} (Pinecone)",
    RejectOutDomainInput.__name__: f"{RejectOutDomainInput.__name__} (Guardrails)"
}

# ==========================================
# HELPER UNTUK MENGUBAH PYDANTIC KE GOOGLE TOOLS
# ==========================================
def pydantic_to_tool(schema_class) -> dict:
    schema = schema_class.model_json_schema()
    properties = {}
    for k, v in schema.get("properties", {}).items():
        type_str = v.get("type", "string").upper()
        if type_str not in ["STRING", "INTEGER", "NUMBER", "BOOLEAN", "ARRAY", "OBJECT"]:
            type_str = "STRING"
        properties[k] = {
            "type": type_str,
            "description": v.get("description", "")
        }
    return {
        "function_declarations": [
            {
                "name": schema_class.__name__,
                "description": schema.get("description", ""),
                "parameters": {
                    "type": "OBJECT",
                    "properties": properties,
                    "required": schema.get("required", [])
                }
            }
        ]
    }

# Sabuk Peralatan yang sudah DITERJEMAHKAN ke otak AI
agent_tools = [
    pydantic_to_tool(CekBiayaRegulerSchema),
    pydantic_to_tool(CekBiayaRPLSchema),
    pydantic_to_tool(CekBiayaPSPPISchema),
    pydantic_to_tool(CekJadwalPMBSchema),
    pydantic_to_tool(CekAnalitikGlobalSchema),
    pydantic_to_tool(SearchPineconeSchema),
    pydantic_to_tool(RejectOutDomainInput)
]

# ==========================================
# TAHAP 2.1 & 2.2: KONFIGURASI MODEL FINAL
# ==========================================
MODELS = [
    "gemini-3.5-flash",       # Prioritas 1: Otak utama (Paling cerdas, limit 5 RPM)
    "gemini-2.5-flash",       # Prioritas 2: Otak cadangan 
    "gemini-3.1-flash-lite",  # Prioritas 3: Kuli utama (Kurang cerdas tapi ngebut & limit 15 RPM)
    "gemini-2.5-flash-lite",  # Prioritas 4: Kuli cadangan (Limit 10 RPM)
    "gemini-2.0-flash"        # Prioritas 5: Nyawa terakhir di dasar jurang
]

agent_config = types.GenerateContentConfig(
    system_instruction=SYSTEM_INSTRUCTION,
    temperature=0.0, 
    tools=agent_tools,
)

def get_agent_config() -> types.GenerateContentConfig:
    return agent_config



# ==========================================
# TAHAP 2.3: MESIN UTAMA (REACT LOOP & MEMORY)
# ==========================================
MAX_REACT_ITERATIONS = 5

TRANSLATION_MAP = {
    "CekBiayaRegulerSchema": "Menghitung kalkulasi biaya kuliah reguler",
    "CekBiayaRPLSchema": "Mengecek aturan khusus untuk jalur RPL",
    "CekBiayaPSPPISchema": "Membuka data program profesi insinyur",
    "CekJadwalPMBSchema": "Mengecek kalender akademik dan jadwal pendaftaran",
    "CekAnalitikGlobalSchema": "Mengumpulkan data statistik pendaftaran",
    "SearchPineconeSchema": "Membaca buku panduan kampus ITI",
    "RejectOutDomainInput": "Memeriksa pedoman percakapan sistem"
}

async def chat_with_agent(session_id: str, id_lead: str, user_input: str):
    """Fungsi utama yang dipanggil oleh API Endpoint, mengembalikan Async Generator SSE"""
    import json
    
    # 1. Pipa Memori: Muat data dari Redis (Dict) dan terjemahkan ke Google Content
    yield f'data: {json.dumps({"type": "status", "message": "Sedang memahami maksud pertanyaan kamu..."})}\n\n'
    raw_history = await get_chat_history(session_id, id_lead)
    
    # [TAMBAHAN PEKERJAAN 4] CEK LAPIS 1: SEMANTIC CACHE (PINTU DEPAN)
    start_time_cache = time.time()
    lapis_1_hit = check_semantic_cache(user_input)
    if lapis_1_hit:
        response_time_ms = int((time.time() - start_time_cache) * 1000)
        # Tabung ke Sliding Window Maba
        await save_chat_history(
            session_id=session_id, id_lead=id_lead, user_query=user_input, 
            bot_response=lapis_1_hit, prompt_tokens=0, completion_tokens=0, 
            response_time_ms=response_time_ms, routed_to="Global Cache (Lapis 1)"
        )
        
        # CACHE HIT: Langsung tembak konten secara instan tanpa trace!
        words = lapis_1_hit.split(" ")
        for word in words:
            yield f'data: {json.dumps({"type": "content_chunk", "message": word + " "})}\n\n'
        
        yield f'data: {json.dumps({"type": "done"})}\n\n'
        return

    contents = []
    
    # Konversi Dictionary dari memory.py menjadi types.Content
    for msg in raw_history:
        contents.append(
            types.Content(role=msg["role"], parts=[types.Part.from_text(text=msg["content"])])
        )
    
    # Tambahkan pesan user saat ini beserta Cap Waktu WIB secara real-time
    now = datetime.now()
    cap_waktu = f"[{now.strftime('%Y-%m-%d %H:%M')} WIB]"
    stamped_user_input = f"{cap_waktu} {user_input}"
    
    contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=stamped_user_input)])
    )
    
    # Inisialisasi Metrik (Stopwatch & Token Counter)
    start_time = time.time()
    total_prompt_tokens = 0
    total_completion_tokens = 0
    routed_tools = set()
    final_bot_response = ""
    iteration = 0
    should_cache = True # [TAMBAHAN PEKERJAAN 4] Parameter Hulu Filter Enterprise
    
    while iteration < MAX_REACT_ITERATIONS:
        iteration += 1
        
        response_stream = None
        
        # Eksekusi Fallback Dinamis (5 Model) dengan Circuit Breaker
        for model_name in MODELS:
            if is_model_bypassed(model_name):
                logger.warning(f"⏩ Model {model_name} di-bypass sementara (Circuit Open).")
                continue # Langsung lompat ke prioritas di bawahnya
                
            try:
                logger.info(f"🧠 [AI Engine] Memulai proses pemikiran dengan model: {model_name}...")
                
                # Panggil AI mode Streaming
                response_stream = await client.aio.models.generate_content_stream(
                    model=model_name,
                    contents=contents,
                    config=get_agent_config()
                )
                # Jika sukses, segera keluar dari perulangan model
                break 
                
            except Exception as e:
                logger.warning(f"⚠️ Model {model_name} Tumbang! Menghidupkan Circuit Breaker. Error: {e}")
                # Jatuhkan hukuman pada model ini
                trip_circuit_breaker(model_name, e)
                # Lanjut mencoba model prioritas berikutnya di dalam loop

        if not response_stream:
            # SEMUA 5 MODEL SUDAH GUGUR (ATAU DI-BYPASS SEMUA)
            logger.error("❌ SEMUA MODEL PRIORITAS TUMBANG!")
            should_cache = False # Matikan cache saat limit/error API
            final_bot_response = "Maaf Kak, seluruh server pusat kami sedang terlalu sibuk. Mohon coba beberapa saat lagi ya! 🙏"
            yield f'data: {json.dumps({"type": "status", "message": "Jalur komunikasi sibuk..."})}\n\n'
            yield f'data: {json.dumps({"type": "content_chunk", "message": final_bot_response})}\n\n'
            break
            
        if response_stream:
            full_text_accumulator = ""
            function_calls_accumulator = []
            function_call_parts_accumulator = []
            
            try:
                async for chunk in response_stream:
                    if chunk.function_calls:
                        function_calls_accumulator.extend(chunk.function_calls)
                        # Simpan part aslinya secara utuh untuk menjaga Thought Signature
                        if chunk.parts:
                            for part in chunk.parts:
                                if part.function_call:
                                    function_call_parts_accumulator.append(part)
                    chunk_text = ""
                    try:
                        chunk_text = chunk.text
                    except Exception:
                        pass
                        
                    if chunk_text:
                        full_text_accumulator += chunk_text
                        # Kirim Typewriter Effect langsung ke Frontend
                        yield f'data: {json.dumps({"type": "content_chunk", "message": chunk_text})}\n\n'
            except Exception as stream_e:
                logger.error(f"❌ STREAMING TERPUTUS DI TENGAH JALAN: {stream_e}")
                should_cache = False
                if not full_text_accumulator.strip():
                    final_bot_response = "Maaf Kak, koneksi ke server terputus saat merangkai kalimat. Mohon ulangi ya! 🙏"
                    try:
                        yield f'data: {json.dumps({"type": "status", "message": "Koneksi kurang stabil..."})}\n\n'
                        yield f'data: {json.dumps({"type": "content_chunk", "message": final_bot_response})}\n\n'
                    except Exception:
                        pass
                break
            
        # APAKAH GEMINI MEMINTA ALAT? (Perutean)
        if function_calls_accumulator:
            tool_responses_parts = []
            tasks = []
            
            # Tambahin respon ke memori AI (menggunakan objek part asli yang punya Thought Signature)
            contents.append(types.Content(role="model", parts=function_call_parts_accumulator))
            
            # Gabungkan Traces untuk Multi-Parallel Tool Execution
            translated_statuses = []
            for func_call in function_calls_accumulator:
                tool_name = func_call.name
                mapped_name = TOOL_DATABASE_MAP.get(tool_name, tool_name)
                routed_tools.add(mapped_name)
                
                friendly_name = TRANSLATION_MAP.get(tool_name, "Memproses data lanjutan")
                translated_statuses.append(friendly_name)
                
                if tool_name in TOOL_EXECUTORS:
                    # [TAMBAHAN PEKERJAAN 4] CEK LAPIS 2: TOOL CACHE (PINTU TENGAH)
                    func_args_dict = dict(func_call.args) if func_call.args else {}
                    lapis_2_hit = check_tool_cache(tool_name, func_args_dict)
                    
                    if lapis_2_hit:
                        logger.info(f"⚡ [ReAct] Bypass Database! Ambil dari Lapis 2 untuk alat: {tool_name}")
                        async def dummy_result(res):
                            return res
                        tasks.append(dummy_result(lapis_2_hit))
                    else:
                        executor = TOOL_EXECUTORS[tool_name]
                        tasks.append(executor(**func_call.args))
                    
                    last_tool_name = tool_name
                    last_tool_args = func_args_dict

            combined_status = " dan ".join(translated_statuses) + "..."
            yield f'data: {json.dumps({"type": "status", "message": combined_status})}\n\n'
            
            try:
                # Eksekusi Paralel
                results = await asyncio.gather(*tasks)
                
                for func_call, result in zip(function_calls_accumulator, results):
                    if "DATA_TIDAK_DITEMUKAN" in str(result) or "DATA_NOT_FOUND" in str(result):
                        should_cache = False
                        logger.warning(f"🚫 [Filter Enterprise] Alat {func_call.name} tidak menemukan data! Cache dimatikan.")

                    tool_responses_parts.append(
                        types.Part.from_function_response(
                            name=func_call.name,
                            response={"result": result}
                        )
                    )
                
                # Lempar hasil data kembali ke memori percakapan
                contents.append(types.Content(role="user", parts=tool_responses_parts))
                
                # Update status
                yield f'data: {json.dumps({"type": "status", "message": "Menyusun jawaban terbaik untukmu..."})}\n\n'
                continue
                
            except OutOfDomainException as e:
                logger.warning(f"🚨 GUARDRAILS DIPICU! Alasan: {e.alasan}")
                should_cache = False 
                final_bot_response = e.message
                yield f'data: {json.dumps({"type": "content_chunk", "message": final_bot_response})}\n\n'
                break
            except Exception as e:
                logger.error(f"❌ Error Eksekusi Alat: {e}")
                should_cache = False 
                final_bot_response = "Maaf Kak, ada sedikit gangguan saat mengambil data. Mohon diulang! 🙏"
                yield f'data: {json.dumps({"type": "content_chunk", "message": final_bot_response})}\n\n'
                break
                
        else:
            # JIKA GEMINI TIDAK MENGGUNAKAN ALAT (Teks Final)
            if len(routed_tools) == 0:
                routed_tools.add("General Chat")
            final_bot_response = full_text_accumulator
            break
            
    if not final_bot_response:
        should_cache = False 
        final_bot_response = "Maaf Kak, proses pencarian data terlalu panjang demi keamanan. Bisa tolong lebih spesifik pertanyaannya? 🙏"
        yield f'data: {json.dumps({"type": "content_chunk", "message": final_bot_response})}\n\n'
        routed_tools.add("Timeout Fallback")

    # Matikan Stopwatch
    end_time = time.time()
    response_time_ms = int((end_time - start_time) * 1000)
    routed_to_str = ", ".join(list(routed_tools))
    
    is_general_or_slot_filling = ("General Chat" in routed_tools) or ("Timeout Fallback" in routed_tools)
    
    if is_general_or_slot_filling:
        should_cache = False
        logger.info("🚫 [Cache Guard] Obrolan murni Teks (Slot Filling/Sapaan). Caching Lapis 1 & 2 dimatikan otomatis.")
        
    user_input_for_cache = user_input.strip()
    synthetic_query = None
    
    if should_cache and "last_tool_name" in locals() and "last_tool_args" in locals():
        tool_context_map = {
            "CekBiayaRegulerSchema": "berapa biaya kuliah jalur reguler",
            "CekBiayaRPLSchema": "berapa biaya kuliah jalur rpl rekognisi pembelajaran lampau",
            "CekBiayaPSPPISchema": "berapa biaya kuliah jalur psppi profesi insinyur",
            "CekJadwalPMBSchema": "kapan jadwal pendaftaran pmb mahasiswa baru gelombang",
            "CekAnalitikGlobalSchema": "analitik data pmb global",
            "SearchPineconeSchema": "informasi umum kampus"
        }
        
        base_context = tool_context_map.get(last_tool_name, last_tool_name.replace("_", " ").lower())
        clean_args = {k: v for k, v in last_tool_args.items() if k != 'sql_query'}
        extracted_values = [str(val).lower() for val in clean_args.values() if val]
        synthetic_query = f"{base_context} {' '.join(extracted_values)}".strip()
        
        logger.info(f"🧬 [Cache Guard] Mengamankan 2 Vektor: Raw='{user_input_for_cache}' & Synthetic='{synthetic_query}'")

    save_semantic_cache(user_input_for_cache, final_bot_response, should_cache, synthetic_query=synthetic_query)
    
    if "last_tool_name" in locals() and "last_tool_args" in locals():
        save_tool_cache(last_tool_name, last_tool_args, final_bot_response, should_cache)

    await save_chat_history(
        session_id=session_id,
        id_lead=id_lead,
        user_query=user_input,
        bot_response=final_bot_response,
        prompt_tokens=total_prompt_tokens,
        completion_tokens=total_completion_tokens,
        response_time_ms=response_time_ms,
        routed_to=routed_to_str
    )
    
    yield f'data: {json.dumps({"type": "done"})}\n\n'