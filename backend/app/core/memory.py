import json
import logging
import re
import pytz
from datetime import datetime, timezone, timedelta
from upstash_redis import Redis
from sqlalchemy import text
from app.core.config import settings
from app.tools.supabase_tool import admin_engine

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inisialisasi Upstash Redis (REST API)
try:
    redis_client = Redis(
        url=settings.UPSTASH_REDIS_REST_URL,
        token=settings.UPSTASH_REDIS_REST_TOKEN
    )
except Exception as e:
    logger.error(f"Gagal menginisialisasi Upstash Redis: {e}")
    redis_client = None

# Konfigurasi Memori Final
SLIDING_WINDOW_SIZE = 20     # Maksimal 20 pesan (10 pasang interaksi)
SESSION_TTL_SECONDS = 604800 # 7 Hari (Idle Timeout untuk Redis & Supabase)

async def get_chat_history(session_id: str, id_lead: str, limit: int = SLIDING_WINDOW_SIZE, offset: int = 0) -> list[dict]:
    """
    Mengambil riwayat percakapan dari Redis (jika offset 0) atau langsung ke Supabase (jika offset > 0).
    """
    if not redis_client:
        return []

    redis_key = f"user:{id_lead}:session:{session_id}"
    
    try:
        # 1. Cek Redis hanya jika offset = 0 (meminta data terbaru)
        if offset == 0:
            cached_data = redis_client.get(redis_key)
            if cached_data:
                logger.info(f"🚀 [Memory] Cache Hit untuk {redis_key}")
                data_list = json.loads(cached_data) if isinstance(cached_data, str) else cached_data
                # Pastikan tidak mengembalikan lebih dari `limit`
                return data_list[-limit:] if len(data_list) > limit else data_list
                
        # 2. Cache Miss atau Offset > 0: Tarik dari Supabase
        logger.info(f"⏳ [Memory] Menarik dari Supabase (Limit: {limit}, Offset: {offset}) untuk {redis_key}...")
        
        async with admin_engine.connect() as connection:
            # Ambil 1 pesan terakhir untuk mengecek usia (Temporal Blindness Check)
            check_sql = """
                SELECT created_at 
                FROM chat_logs 
                WHERE session_id = CAST(:session_id AS uuid) AND id_lead = CAST(:id_lead AS uuid)
                ORDER BY created_at DESC 
                LIMIT 1
            """
            result = await connection.execute(text(check_sql), {"session_id": session_id, "id_lead": id_lead})
            last_msg = result.fetchone()
            
            if not last_msg:
                logger.info(f"✨ [Memory] Sesi murni baru di Supabase. Mulai dari nol.")
                return []
                
            last_created_at = last_msg[0] # timezone aware datetime dari PostgreSQL
            if last_created_at.tzinfo is None:
                last_created_at = last_created_at.replace(tzinfo=timezone.utc)
                
            now_utc = datetime.now(timezone.utc)
            
            # 3. Re-warming / Pagination: Tarik pesan terakhir (Maksimal 20 pesan / 10 pasang)
            pull_sql = """
                SELECT user_query, bot_response, created_at FROM (
                    SELECT user_query, bot_response, created_at 
                    FROM chat_logs 
                    WHERE session_id = CAST(:session_id AS uuid) AND id_lead = CAST(:id_lead AS uuid)
                    ORDER BY created_at DESC 
                    LIMIT :limit OFFSET :offset
                ) sub
                ORDER BY created_at ASC
            """
            limit_pairs = max(1, limit // 2)
            offset_pairs = offset // 2
            rows = await connection.execute(text(pull_sql), {"session_id": session_id, "id_lead": id_lead, "limit": limit_pairs, "offset": offset_pairs})
            
            history = []
            for row in rows:
                # Konversi waktu Supabase (UTC) ke WIB (UTC+7)
                waktu_utc = row[2].replace(tzinfo=timezone.utc) if row[2].tzinfo is None else row[2]
                waktu_wib = waktu_utc.astimezone(timezone(timedelta(hours=7)))
                cap_waktu = waktu_wib.strftime("[%Y-%m-%d %H:%M WIB]")
                
                # Suntikkan cap waktu ke dalam ingatan AI (Hanya di pihak User)
                history.append({"role": "user", "content": f"{cap_waktu} {row[0]}"})
                history.append({"role": "model", "content": f"{row[1]}"})
                
            # Masukkan kembali ke Redis (Re-warming) dengan TTL 7 Hari, HANYA jika ini halaman pertama (offset 0)
            if offset == 0:
                redis_client.set(redis_key, json.dumps(history), ex=SESSION_TTL_SECONDS)
                logger.info(f"🔥 [Memory] Re-warming Redis berhasil untuk {redis_key}")
            
            return history

    except Exception as e:
        logger.error(f"❌ [Memory] Error pada get_chat_history: {e}")
        return []

async def save_chat_history(session_id: str, id_lead: str, user_query: str, bot_response: str, 
                            prompt_tokens: int = 0, completion_tokens: int = 0, response_time_ms: int = 0, routed_to: str = "general"):
    """
    Menyimpan pesan baru ke Redis (Update Cache) dan ke Supabase (Penyimpanan Abadi untuk Observability).
    """
    redis_key = f"user:{id_lead}:session:{session_id}"
    
    # --- 1. Update Redis Cache (Time-Aware Memory) ---
    try:
        # Bikin cap waktu WIB saat ini untuk disuntikkan ke otak AI
        waktu_wib = datetime.now(timezone(timedelta(hours=7)))
        cap_waktu = waktu_wib.strftime("[%Y-%m-%d %H:%M WIB]")
        
        history = await get_chat_history(session_id, id_lead)
        
        # Suntikkan cap waktu HANYA ke pesan User di Redis (makanan AI)
        history.append({"role": "user", "content": f"{cap_waktu} {user_query}"})
        history.append({"role": "model", "content": f"{bot_response}"})
        
        # Terapkan Sliding Window (Potong jika kepanjangan)
        if len(history) > SLIDING_WINDOW_SIZE:
            history = history[-SLIDING_WINDOW_SIZE:]
            
        # Simpan ke Redis dan reset bom waktu (TTL) ke 7 Hari
        redis_client.set(redis_key, json.dumps(history), ex=SESSION_TTL_SECONDS)
        logger.info(f"✅ [Memory] Riwayat disimpan ke Redis dengan Cap Waktu. TTL di-reset (7 Hari).")
    except Exception as e:
        logger.error(f"❌ [Memory] Gagal update Redis: {e}")

    # --- 2. Update Supabase (Harddisk Abadi, Teks Murni) ---
    try:
        async with admin_engine.begin() as connection:
            insert_sql = """
                INSERT INTO chat_logs 
                (id_lead, session_id, user_query, bot_response, routed_to, prompt_tokens, completion_tokens, response_time_ms)
                VALUES 
                (CAST(:id_lead AS uuid), CAST(:session_id AS uuid), :user_query, :bot_response, :routed_to, :prompt_tokens, :completion_tokens, :response_time_ms)
            """
            await connection.execute(text(insert_sql), {
                "id_lead": id_lead,
                "session_id": session_id,
                "user_query": user_query,          # Murni tanpa cap waktu
                "bot_response": bot_response,      # Murni tanpa cap waktu
                "routed_to": routed_to,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "response_time_ms": response_time_ms
            })
            logger.info(f"💾 [Memory] Rekam jejak abadi (Teks Murni) disimpan ke Supabase.")
    except Exception as e:
        logger.error(f"❌ [Memory] Gagal simpan ke Supabase: {e}")

# ==========================================
# CIRCUIT BREAKER (PENGAMAN FALLBACK)
# ==========================================

def is_model_bypassed(model_name: str) -> bool:
    """Cek ke Redis apakah model ini sedang dihukum (Kena Limit)."""
    if not redis_client:
        return False
    
    # Mengembalikan True jika key ada di Redis
    return redis_client.exists(f"circuit_breaker:{model_name}") == 1

def trip_circuit_breaker(model_name: str, error_message: str):
    """Menganalisis error 429 dan menghukum model (Bypass) sesuai durasi limit."""
    if not redis_client:
        return

    error_str = str(error_message)
    
    # Lapis 1: Coba cari angka detik eksplisit dari Google (Contoh: "Please retry in 52.6s")
    match_detik = re.search(r'retry(?: in |Delay\D*)(\d+(?:\.\d+)?)s', error_str, re.IGNORECASE)
    # Lapis 2: Cek apakah errornya eksplisit ngomongin limit harian
    match_harian = re.search(r'PerDay|requests_per_day', error_str, re.IGNORECASE)
    
    if match_detik:
        # Tambah 2 detik ekstra biar aman dari delay jaringan (Bypass Limit Menit/RPM)
        detik_hukuman = int(float(match_detik.group(1))) + 2
        logger.warning(f"🛑 [Circuit Breaker] Model {model_name} Kena RPM Limit! Di-Bypass selama {detik_hukuman} detik.")
    elif match_harian:
        # Kiamat Harian (RPD). Hitung waktu sampai jam 12 Malam Waktu Pasifik (Reset Kuota Harian Google)
        sekarang_pt = datetime.now(pytz.timezone('America/Los_Angeles'))
        besok_tengah_malam_pt = (sekarang_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        selisih_waktu = besok_tengah_malam_pt - sekarang_pt
        detik_hukuman = int(selisih_waktu.total_seconds())
        
        logger.error(f"🛑 [Circuit Breaker] Model {model_name} KIAMAT HARIAN! Di-Bypass sampai Besok (selama {detik_hukuman} detik).")
    else:
        # Error 429 gaje (Server overload sesaat)
        detik_hukuman = 60
        logger.warning(f"🛑 [Circuit Breaker] Model {model_name} Kena 429 Gaje! Di-Bypass sementara selama {detik_hukuman} detik.")

    # Set status rusak ke Redis (Otomatis hilang sendiri dalam 'detik_hukuman')
    try:
        redis_client.set(f"circuit_breaker:{model_name}", "TRIPPED", ex=detik_hukuman)
    except Exception as e:
        logger.error(f"❌ [Circuit Breaker] Gagal menyimpan ke Redis: {e}")