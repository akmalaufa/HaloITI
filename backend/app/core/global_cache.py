import json
import hashlib
import logging
from typing import Dict, Any, Optional
from google.genai import types
from app.core.config import settings
from app.core.memory import redis_client
from app.tools.pinecone_tool import gemini_client, pinecone_index

logger = logging.getLogger(__name__)

# ==========================================
# LAPIS 1: SEMANTIC CACHE (PINECONE)
# ==========================================
def check_semantic_cache(user_query: str) -> Optional[str]:
    """Cek Lapis 1 di Pinecone. Jika mirip > 95%, balikin jawaban instan."""
    logger.info("🔍 [Cache Lapis 1] Memeriksa Semantic Cache...")
    try:
        response = gemini_client.models.embed_content(
            model='gemini-embedding-2',
            contents=user_query,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        query_vector = response.embeddings[0].values
        
        search_result = pinecone_index.query(
            vector=query_vector,
            top_k=1,
            namespace="cache",
            include_metadata=True
        )
        
        if search_result.matches:
            best_match = search_result.matches[0]
            if best_match.score >= 0.95:
                logger.info(f"✅ [Cache Lapis 1] CACHE HIT! (Skor: {best_match.score:.2f})")
                return best_match.metadata.get("jawaban_sukses")
                
        logger.info("⏳ [Cache Lapis 1] CACHE MISS.")
        return None
    except Exception as e:
        logger.error(f"❌ [Cache Lapis 1] Error: {e}")
        return None

def save_semantic_cache(user_query: str, bot_response: str, is_success: bool, synthetic_query: Optional[str] = None):
    """Simpan ke Lapis 1 (Pinecone) JIKA DAN HANYA JIKA jawaban sukses. Mendukung double-save."""
    if not is_success:
        logger.warning("🚫 [Cache Lapis 1] Jawaban ditolak (Filter Anti-Gagal).")
        return
        
    try:
        queries_to_save = [user_query.strip()]
        if synthetic_query and synthetic_query.strip() and synthetic_query.strip() != user_query.strip():
            queries_to_save.append(synthetic_query.strip())
            
        vectors_to_upsert = []
        for q in queries_to_save:
            q_hash = hashlib.md5(q.encode('utf-8')).hexdigest()
            response = gemini_client.models.embed_content(
                model='gemini-embedding-2',
                contents=q,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            vectors_to_upsert.append({
                "id": f"cache_{q_hash}",
                "values": response.embeddings[0].values,
                "metadata": {
                    "pertanyaan_asli": q,
                    "jawaban_sukses": bot_response
                }
            })
            
        pinecone_index.upsert(vectors=vectors_to_upsert, namespace="cache")
        logger.info(f"💾 [Cache Lapis 1] {len(vectors_to_upsert)} Vektor berhasil disimpan (Double-Save aktif)!")
    except Exception as e:
        logger.error(f"❌ [Cache Lapis 1] Gagal menyimpan: {e}")


# ==========================================
# LAPIS 2: TOOL-LEVEL CACHE (REDIS)
# ==========================================
def check_tool_cache(tool_name: str, tool_args: Dict[str, Any]) -> Optional[str]:
    """Cek Lapis 2 di Redis menggunakan Exact Match JSON."""
    if not redis_client:
        return None
        
    logger.info("🔍 [Cache Lapis 2] Memeriksa Tool Cache...")
    try:
        # Buang 'sql_query' karena itu dibuat dinamis oleh Gemini dan sering beda karakter
        cache_args = tool_args.copy()
        if 'sql_query' in cache_args:
            del cache_args['sql_query']
            
        args_json = json.dumps(cache_args, sort_keys=True)
        redis_key = f"cache:tool:{tool_name}:{args_json}"
        
        cached_result = redis_client.get(redis_key)
        if cached_result:
            logger.info("✅ [Cache Lapis 2] CACHE HIT! Bypass eksekusi database.")
            # Redis Upstash kadang mengembalikan byte, jadi decode ke string jika perlu
            if isinstance(cached_result, bytes):
                return cached_result.decode('utf-8')
            return cached_result
            
        logger.info("⏳ [Cache Lapis 2] CACHE MISS.")
        return None
    except Exception as e:
        logger.error(f"❌ [Cache Lapis 2] Error: {e}")
        return None

def save_tool_cache(tool_name: str, tool_args: Dict[str, Any], final_response: str, is_success: bool):
    """Simpan ke Lapis 2 (Redis) dengan TTL 30 Hari JIKA jawaban sukses."""
    if not redis_client or not is_success:
        logger.warning("🚫 [Cache Lapis 2] Jawaban ditolak (Filter Anti-Gagal).")
        return
        
    try:
        # Buang 'sql_query' karena itu dibuat dinamis oleh Gemini dan sering beda karakter
        cache_args = tool_args.copy()
        if 'sql_query' in cache_args:
            del cache_args['sql_query']
            
        args_json = json.dumps(cache_args, sort_keys=True)
        redis_key = f"cache:tool:{tool_name}:{args_json}"
        
        # Simpan ke Redis dengan TTL 30 hari (2592000 detik)
        redis_client.set(redis_key, final_response, ex=2592000)
        logger.info("💾 [Cache Lapis 2] Data berhasil disimpan!")
    except Exception as e:
        logger.error(f"❌ [Cache Lapis 2] Gagal menyimpan: {e}")