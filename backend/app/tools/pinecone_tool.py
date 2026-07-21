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

bm25 = BM25Encoder().load(bm25_path)

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