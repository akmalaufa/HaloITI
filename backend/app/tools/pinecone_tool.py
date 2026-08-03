import os
from google import genai
from google.genai import types
from pinecone import Pinecone
from pinecone_text.sparse import BM25Encoder
from app.core.config import settings
from pinecone_text.hybrid import hybrid_convex_scale

# 1. Inisialisasi Koneksi API
gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)

# 2. Muat Otak BM25 (Hybrid Keyword)
current_dir = os.path.dirname(os.path.abspath(__file__))
bm25_path = os.path.join(current_dir, "bm25_params.json")

from app.tools.supabase_tool import supabase_client

try:
    # Download dari Supabase Storage (Cloud-Native) saat server baru menyala
    print("☁️ [Pinecone Tool] Mengunduh bm25_params.json dari Supabase Storage...")
    response = supabase_client.storage.from_("knowledge_files").download("bm25_params.json")
    with open(bm25_path, "wb") as f:
        f.write(response)
    print("✅ [Pinecone Tool] Berhasil mengunduh bm25_params.json dari Supabase!")
except Exception as e:
    print(f"⚠️ [Pinecone Tool] Gagal mengunduh dari Supabase (Mungkin file belum ada): {e}")

try:
    bm25 = BM25Encoder().load(bm25_path)
except Exception:
    print("[WARNING] File bm25_params.json tidak ditemukan. BM25 akan kosong sementara.")
    bm25 = BM25Encoder()

# Tambahkan prodi_terkait di sini
async def search_pinecone(query: str, prodi_terkait: str = None, top_k: int = 10, alpha: float = 0.5) -> str:
    """
    Mencari data di Pinecone menggunakan metode Hybrid Search (Semantik + Keyword).
    alpha = 0.5 artinya 50% pakai logika Makna (Google), 50% pakai logika Keyword (BM25).
    """
    try:
        # PENTING: Penggabungan (Merge) Jebakan Prodi
        # Kalau Gemini ngirim nama prodi, kita tempel di akhir kalimat pencarian
        if prodi_terkait:
            query = f"{query} untuk prodi {prodi_terkait}"
            
        print(f"🔍 [Pinecone Tool] Mencari dokumen untuk: '{query}'")
        
        # A. Bikin Dense Vector (Memahami Makna)
        # Pakai model text-embedding-004 bawaan Google GenAI terbaru
        response = gemini_client.models.embed_content(
            model='gemini-embedding-2',
            contents=query,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        dense_vec = response.embeddings[0].values
        
        # B. Bikin Sparse Vector (Mencari Keyword Eksak)
        sparse_vec = bm25.encode_queries(query)
        
        # C. Terapkan Rumus Alpha (Tombol Volume 50/50)
        dense_vec, sparse_vec = hybrid_convex_scale(dense_vec, sparse_vec, alpha)
        
        # D. Eksekusi Hybrid Search ke Database
        search_result = pinecone_index.query(
            vector=dense_vec,
            sparse_vector=sparse_vec,
            top_k=top_k,
            include_metadata=True
        )
        
        # E. Ekstraksi Hasil
        if not search_result.matches:
            return "DATA_TIDAK_DITEMUKAN"
            
        # Gabungkan semua teks relevan jadi satu paragraf panjang
        extracted_texts = []
        for i, match in enumerate(search_result.matches):
            text = match.metadata.get("text", "")
            kategori = match.metadata.get("kategori", "Umum")
            dokumen_asal = match.metadata.get("dokumen_asal", "Unknown")
            score = match.score
            # Kita kasih tau Gemini asal dokumennya biar dia makin pintar merangkum
            extracted_texts.append(f"[Konteks {i+1} | Dokumen: {dokumen_asal} | Kategori: {kategori} | Kemiripan: {score:.2f}]:\n{text}")
            
        final_context = "\n\n".join(extracted_texts)
        return final_context
        
    except Exception as e:
        print(f"❌ [Pinecone Tool] Error: {e}")
        return "DATA_TIDAK_DITEMUKAN"


# ==========================================
# FUNGSI SINKRONISASI GLOBAL (RAG PIPELINE)
# ==========================================
async def sync_pinecone_knowledge():
    """
    Fungsi sakti untuk menarik semua teks dari SQL,
    Melatih ulang (Retrain) otak BM25,
    dan membanjiri Pinecone dengan Sparse Vector terbaru.
    """
    from app.tools.supabase_tool import admin_engine # Local import menghindari circular dependency
    import json
    import time
    from sqlalchemy import text
    
    print("🔄 [Sync] Memulai Sinkronisasi Global Pinecone...")
    yield json.dumps({"progress": 91, "message": "Menarik data potongan teks dari SQL Database...", "status": "processing"}) + "\n"
    

    # 1. Tarik Semua Data dari SQL (Dengan Sistem Retry & Timeout)
    import asyncio
    max_retries = 3
    rows = []
    
    async def fetch_data():
        async with admin_engine.connect() as conn:
            sql_query = text("""
                SELECT id, id_dokumen, kategori, teks, dense_vector, dokumen_asal
                FROM knowledge_chunks
            """)
            result = await conn.execute(sql_query)
            return result.fetchall()
            
    for attempt in range(max_retries):
        try:
            # Berikan waktu maksimal 60 detik agar tidak hang selamanya (disesuaikan untuk internet lambat)
            rows = await asyncio.wait_for(fetch_data(), timeout=60.0)
            break  # Jika sukses, keluar dari loop retry
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠️ [Sync] Koneksi SQL gagal/timeout (Attempt {attempt+1}/{max_retries}). Menunggu sebelum retry...")
                await asyncio.sleep(2)
            else:
                raise e # Lemparkan error jika sudah maksimal
        
    if not rows:
        print("⚠️ [Sync] SQL Kosong. Menghapus seluruh isi Pinecone...")
        pinecone_index.delete(delete_all=True)
        # Bikin BM25 kosong
        global bm25
        bm25 = BM25Encoder()
        yield json.dumps({"progress": 94, "message": "Mengosongkan memori AI karena tidak ada data...", "status": "processing"}) + "\n"
        
        # Hapus file lokal jika ada
        import os
        if os.path.exists(bm25_path):
            os.remove(bm25_path)
            print("🗑️ [Sync] File bm25_params.json lokal dihapus karena SQL kosong.")
        # Hapus file dari Supabase Storage juga
        try:
            supabase_client.storage.from_("knowledge_files").remove(["bm25_params.json"])
            print("🗑️☁️ [Sync] File bm25_params.json berhasil dihapus dari Supabase Storage.")
        except Exception as e:
            print(f"⚠️☁️ [Sync] Gagal menghapus file dari Supabase: {e}")
        return
        
    # 2. Re-train BM25
    print(f"🧠 [Sync] Melatih ulang otak BM25 dari {len(rows)} potongan teks...")
    yield json.dumps({"progress": 92, "message": f"Melatih ulang otak BM25 dari {len(rows)} potongan teks...", "status": "processing"}) + "\n"
    
    corpus_texts = [f"{r[5]} - {r[2]}\n{r[3]}" for r in rows]
    
    bm25 = BM25Encoder()
    bm25.fit(corpus_texts)
    bm25.dump(bm25_path) # Simpan ke disk (agar Chatbot pakai kamus terbaru)
    
    # Upload ke Supabase Storage (Cloud-Native Backup)
    try:
        with open(bm25_path, "rb") as f:
            supabase_client.storage.from_("knowledge_files").upload(
                file=f.read(),
                path="bm25_params.json",
                file_options={"content-type": "application/json", "upsert": "true"}
            )
        print("☁️✅ [Sync] File bm25_params.json berhasil di-backup ke Supabase Storage!")
    except Exception as e:
        print(f"☁️⚠️ [Sync] Gagal mem-backup bm25_params.json ke Supabase: {e}")
    
    # 3. Rakit Peluru Pinecone
    print("🚀 [Sync] Merakit Vector dan Upsert Massal ke Pinecone...")
    yield json.dumps({"progress": 93, "message": "Merakit Vektor dan menyuntikkan ke Pinecone...", "status": "processing"}) + "\n"
    batch_size = 50
    vectors_to_upsert = []
    
    for row in rows:
        chunk_id = str(row[0]) # ID asli dari PostgreSQL (Sangat Kuat)
        id_dokumen = row[1]
        kategori = row[2]
        teks = row[3]
        dense_vec_str = row[4]
        
        # Mencegah error Pinecone jika ada data NULL dari database
        dokumen_asal = row[5] if row[5] else "Dokumen Lama"
        
        rich_text = f"{dokumen_asal} - {kategori}\n{teks}"
        
        # Dense vec dari SQL, Sparse vec di-generate on-the-fly pakai BM25 yg baru lulus
        # [Perbaikan Bug]: Cek apakah Supabase (asyncpg) sudah otomatis mengubah JSONB jadi List
        dense_vec = json.loads(dense_vec_str) if isinstance(dense_vec_str, str) else dense_vec_str
        
        sparse_vec = bm25.encode_documents(rich_text)
        
        vectors_to_upsert.append({
            "id": chunk_id,
            "values": dense_vec,
            "sparse_values": sparse_vec,
            "metadata": {
                "id_dokumen": id_dokumen,
                "dokumen_asal": dokumen_asal,
                "kategori": kategori,
                "text": teks
            }
        })
        
    # 4. Tembak ke Pinecone (Batching)
    for i in range(0, len(vectors_to_upsert), batch_size):
        batch = vectors_to_upsert[i:i+batch_size]
        pinecone_index.upsert(vectors=batch)
        time.sleep(1) # Jeda nafas API
        
    print(f"✅ [Sync] Berhasil meng-upsert {len(vectors_to_upsert)} chunks ke Pinecone!")