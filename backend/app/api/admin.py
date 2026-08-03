from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy import text
from app.tools.supabase_tool import admin_engine, supabase_client
from app.core.memory import redis_client
from app.core.config import settings
import logging
import io
import uuid
import json

from google import genai
from google.genai import types
from app.tools.knowledge_tool import HierarchicalTextSplitter
from app.tools.pinecone_tool import pinecone_index, sync_pinecone_knowledge

# Inisialisasi Gemini Client
gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)


# Import schemas (Satpam) yang baru kita buat di Tahap 1.1.1
from app.models.admin_schema import ProdiCreate, ProdiUpdate, PeriodeCreate, PeriodeUpdate, BiayaCreate, BiayaUpdate

# Import Pinecone untuk Lapis 1 Cache Invalidation
from app.tools.pinecone_tool import pinecone_index

from fastapi.security import APIKeyHeader
from fastapi import Depends

logger = logging.getLogger(__name__)

# Bikin gembok X-API-Key
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.X_API_KEY:
        raise HTTPException(status_code=401, detail="Dilarang Masuk! Kunci API salah.")
    return api_key

# Bikin Jalur VIP (Router) khusus Admin dengan Gembok
router = APIRouter(dependencies=[Depends(get_api_key)])

# ==========================================
# FUNGSI PEMBANTU: CACHE INVALIDATION
# ==========================================
def invalidate_prodi_cache(nama_prodi: str):
    """Membunuh cache di Redis yang berhubungan dengan nama prodi ini (Targeted Purge)"""
    if not redis_client:
        return
    try:
        # Cari semua kunci di Redis Lapis 2 yang mengandung nama prodi ini
        pattern = f"*cache:tool:*{nama_prodi}*"
        keys = redis_client.keys(pattern)
        if keys:
            # Jika menggunakan Redis client dari Upstash, delete() butuh argument unpacking
            redis_client.delete(*keys)
            logger.info(f"🧹 [Cache Invalidation] Berhasil menghapus {len(keys)} cache untuk prodi '{nama_prodi}'")
            
        # 2. BUM HANGUSKAN Lapis 1 (Pinecone Semantic Cache)
        pinecone_index.delete(delete_all=True, namespace='cache')
        logger.info(f"🔥 [Cache Invalidation] Lapis 1 (Pinecone Semantic Cache) berhasil di-flush!")
    except Exception as e:
        logger.error(f"❌ [Cache Invalidation] Gagal menghapus cache untuk '{nama_prodi}': {e}")


def invalidate_knowledge_cache():
    """Membunuh seluruh cache pencarian kualitatif di Redis Lapis 2 dan Pinecone Lapis 1"""
    if not redis_client:
        return
    try:
        # 1. BUM HANGUSKAN Lapis 2 (Redis Tool Cache)
        pattern = "*cache:tool:search_pinecone*"
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
            logger.info(f"🗑️ [Cache Lapis 2] Berhasil menghapus {len(keys)} cache search_pinecone di Redis.")
            
        # 2. BUM HANGUSKAN Lapis 1 (Pinecone Semantic Cache)
        pinecone_index.delete(delete_all=True, namespace='cache')
        logger.info(f"🔥 [Cache Invalidation] Lapis 1 (Pinecone Semantic Cache) berhasil di-flush untuk Knowledge Update!")
    except Exception as e:
        logger.error(f"❌ [Cache Invalidation] Gagal menghapus cache knowledge: {e}")


# ==========================================
# 1. CRUD TABEL PRODI
# ==========================================

@router.get("/prodi")
async def get_all_prodi():
    """Membaca (Read) semua data Program Studi"""
    try:
        async with admin_engine.connect() as conn:
            result = await conn.execute(text("SELECT * FROM prodi ORDER BY id_prodi ASC"))
            rows = result.fetchall()
            # Convert hasil database mentah jadi dictionary JSON
            return [{"id_prodi": row[0], "nama_prodi": row[1], "jenjang": row[2]} for row in rows]
    except Exception as e:
        logger.error(f"Error GET Prodi: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil data prodi dari database.")


@router.post("/prodi")
async def create_prodi(prodi: ProdiCreate):
    """Membuat (Create) Program Studi baru"""
    try:
        async with admin_engine.begin() as conn: # Pakai .begin() biar kalau error otomatis Rollback
            # Cek apakah ID prodi sudah terpakai
            cek = await conn.execute(text("SELECT id_prodi FROM prodi WHERE id_prodi = :id"), {"id": prodi.id_prodi})
            if cek.fetchone():
                raise HTTPException(status_code=400, detail="ID Prodi sudah digunakan!")
                
            sql = text("""
                INSERT INTO prodi (id_prodi, nama_prodi, jenjang) 
                VALUES (:id_prodi, :nama_prodi, :jenjang)
            """)
            await conn.execute(sql, {
                "id_prodi": prodi.id_prodi,
                "nama_prodi": prodi.nama_prodi,
                "jenjang": prodi.jenjang
            })
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_prodi_cache(prodi.nama_prodi)
            
            return {"status": "success", "message": f"Prodi {prodi.nama_prodi} berhasil ditambahkan"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error POST Prodi: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan data prodi.")


@router.put("/prodi/{id_prodi}")
async def update_prodi(id_prodi: int, prodi: ProdiUpdate):
    """Mengubah (Update) data Program Studi dan Menghapus Cache"""
    try:
        async with admin_engine.begin() as conn:
            # Ambil data lama dulu buat tau apa nama_prodi sebelumnya (untuk keperluan hapus cache)
            cek = await conn.execute(text("SELECT nama_prodi FROM prodi WHERE id_prodi = :id"), {"id": id_prodi})
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Prodi tidak ditemukan!")
            
            nama_lama = data_lama[0]
            
            # Susun query SQL Update secara dinamis (tergantung kolom apa yang diisi sama Admin)
            update_fields = []
            params = {"id": id_prodi}
            
            if prodi.id_prodi is not None:
                if prodi.id_prodi != id_prodi:
                    cek_id = await conn.execute(text("SELECT id_prodi FROM prodi WHERE id_prodi = :new_id"), {"new_id": prodi.id_prodi})
                    if cek_id.fetchone():
                        raise HTTPException(status_code=400, detail="ID Prodi baru sudah digunakan!")
                update_fields.append("id_prodi = :new_id")
                params["new_id"] = prodi.id_prodi

            if prodi.nama_prodi is not None:
                update_fields.append("nama_prodi = :nama")
                params["nama"] = prodi.nama_prodi
            if prodi.jenjang is not None:
                update_fields.append("jenjang = :jenjang")
                params["jenjang"] = prodi.jenjang
                
            if not update_fields:
                return {"status": "success", "message": "Tidak ada data yang diubah"}
                
            sql = text(f"UPDATE prodi SET {', '.join(update_fields)} WHERE id_prodi = :id")
            await conn.execute(sql, params)
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_prodi_cache(nama_lama)
            # Jika Admin iseng ngubah nama prodi dari "Mesin" jadi "Teknik Mesin"
            if prodi.nama_prodi is not None and prodi.nama_prodi != nama_lama:
                invalidate_prodi_cache(prodi.nama_prodi) 
                
            return {"status": "success", "message": "Prodi berhasil diperbarui"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error PUT Prodi: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengubah data prodi.")


@router.delete("/prodi/{id_prodi}")
async def delete_prodi(id_prodi: int):
    """Menghapus (Delete) Program Studi dan Menghapus Cache"""
    try:
        async with admin_engine.begin() as conn:
            # Ambil data lama buat tau nama_prodi-nya (untuk keperluan hapus cache)
            cek = await conn.execute(text("SELECT nama_prodi FROM prodi WHERE id_prodi = :id"), {"id": id_prodi})
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Prodi tidak ditemukan!")
                
            nama_lama = data_lama[0]
            
            # Hapus dari database (karena ON DELETE CASCADE di DB, harga UKT terkait juga akan terhapus otomatis)
            await conn.execute(text("DELETE FROM prodi WHERE id_prodi = :id"), {"id": id_prodi})
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_prodi_cache(nama_lama)
            
            return {"status": "success", "message": f"Prodi {nama_lama} berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error DELETE Prodi: {e}")
        raise HTTPException(status_code=500, detail="Gagal menghapus data prodi.")


# ==========================================
# FUNGSI PEMBANTU: CACHE INVALIDATION PERIODE
# ==========================================
def invalidate_periode_cache(sistem: str, gelombang: str):
    """Membunuh cache di Redis yang berhubungan dengan jadwal ini"""
    if not redis_client:
        return
    try:
        # Cari semua kunci di Redis Lapis 2 yang mengandung sistem atau gelombang
        # Karena prompt AI kadang beda, kita hapus luas aja (toh ini hitungannya jarang berubah)
        pattern = f"*cache:tool:*{sistem}*"
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
            logger.info(f"🧹 [Cache Invalidation] Berhasil menghapus {len(keys)} cache untuk sistem '{sistem}'")
            
        # 2. BUM HANGUSKAN Lapis 1 (Pinecone Semantic Cache)
        pinecone_index.delete(delete_all=True, namespace='cache')
        logger.info(f"🔥 [Cache Invalidation] Lapis 1 (Pinecone Semantic Cache) berhasil di-flush!")
    except Exception as e:
        logger.error(f"❌ [Cache Invalidation] Gagal menghapus cache untuk periode: {e}")


# ==========================================
# 2. CRUD TABEL PERIODE PENDAFTARAN
# ==========================================

@router.get("/periode")
async def get_all_periode():
    try:
        async with admin_engine.connect() as conn:
            result = await conn.execute(text("SELECT id_periode, sistem, nama_jalur, gelombang, tgl_buka, tgl_tutup, link_pendaftaran FROM periode_pendaftaran ORDER BY id_periode ASC"))
            rows = result.fetchall()
            return [{
                "id_periode": row[0], 
                "sistem": row[1], 
                "nama_jalur": row[2],
                "gelombang": row[3],
                "tgl_buka": row[4],
                "tgl_tutup": row[5],
                "link_pendaftaran": row[6]
            } for row in rows]
    except Exception as e:
        logger.error(f"Error GET Periode: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil data periode.")


@router.post("/periode")
async def create_periode(periode: PeriodeCreate):
    try:
        async with admin_engine.begin() as conn:
            # Karena SERIAL, id_periode tidak perlu di-insert
            sql = text("""
                INSERT INTO periode_pendaftaran (sistem, nama_jalur, gelombang, tgl_buka, tgl_tutup, link_pendaftaran) 
                VALUES (:sistem, :nama_jalur, :gelombang, :tgl_buka, :tgl_tutup, :link_pendaftaran)
            """)
            await conn.execute(sql, {
                "sistem": periode.sistem,
                "nama_jalur": periode.nama_jalur,
                "gelombang": periode.gelombang,
                "tgl_buka": periode.tgl_buka,
                "tgl_tutup": periode.tgl_tutup,
                "link_pendaftaran": periode.link_pendaftaran
            })
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_periode_cache(periode.sistem, str(periode.gelombang))
            
            return {"status": "success", "message": f"Periode {periode.sistem} - {periode.gelombang} berhasil ditambahkan"}
    except Exception as e:
        logger.error(f"Error POST Periode: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan data periode.")


@router.put("/periode/{id_periode}")
async def update_periode(id_periode: int, periode: PeriodeUpdate):
    try:
        async with admin_engine.begin() as conn:
            # Ambil data lama
            cek = await conn.execute(text("SELECT sistem, gelombang FROM periode_pendaftaran WHERE id_periode = :id"), {"id": id_periode})
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Periode tidak ditemukan!")
            
            sistem_lama = data_lama[0]
            gelombang_lama = data_lama[1]
            
            update_fields = []
            params = {"id": id_periode}
            
            if periode.sistem is not None:
                update_fields.append("sistem = :sistem")
                params["sistem"] = periode.sistem
            if periode.nama_jalur is not None:
                update_fields.append("nama_jalur = :nama_jalur")
                params["nama_jalur"] = periode.nama_jalur
            if periode.gelombang is not None:
                update_fields.append("gelombang = :gelombang")
                params["gelombang"] = periode.gelombang
            if periode.tgl_buka is not None:
                update_fields.append("tgl_buka = :tgl_buka")
                params["tgl_buka"] = periode.tgl_buka
            if periode.tgl_tutup is not None:
                update_fields.append("tgl_tutup = :tgl_tutup")
                params["tgl_tutup"] = periode.tgl_tutup
            if periode.link_pendaftaran is not None:
                update_fields.append("link_pendaftaran = :link_pendaftaran")
                params["link_pendaftaran"] = periode.link_pendaftaran
                
            if not update_fields:
                return {"status": "success", "message": "Tidak ada data yang diubah"}
                
            sql = text(f"UPDATE periode_pendaftaran SET {', '.join(update_fields)} WHERE id_periode = :id")
            await conn.execute(sql, params)
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_periode_cache(sistem_lama, gelombang_lama)
            if periode.sistem is not None and periode.sistem != sistem_lama:
                invalidate_periode_cache(periode.sistem, gelombang_lama)
                
            return {"status": "success", "message": "Periode berhasil diperbarui"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error PUT Periode: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengubah data periode.")


@router.delete("/periode/{id_periode}")
async def delete_periode(id_periode: int):
    try:
        async with admin_engine.begin() as conn:
            cek = await conn.execute(text("SELECT sistem, gelombang FROM periode_pendaftaran WHERE id_periode = :id"), {"id": id_periode})
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Periode tidak ditemukan!")
                
            sistem_lama = data_lama[0]
            gelombang_lama = data_lama[1]
            
            await conn.execute(text("DELETE FROM periode_pendaftaran WHERE id_periode = :id"), {"id": id_periode})
            
            # --- TRIGGER CACHE INVALIDATION ---
            invalidate_periode_cache(sistem_lama, gelombang_lama)
            
            return {"status": "success", "message": f"Periode {sistem_lama} berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error DELETE Periode: {e}")
        raise HTTPException(status_code=500, detail="Gagal menghapus data periode.")


# ==========================================
# 3. CRUD TABEL BIAYA STUDI (PRICING ENGINE)
# ==========================================

@router.get("/biaya")
async def get_all_biaya():
    """Mengambil semua skema harga beserta nama prodi dan gelombang"""
    try:
        async with admin_engine.connect() as conn:
            # INNER JOIN untuk mendapatkan nama_prodi dan nama_jalur
            sql = text("""
                SELECT 
                    b.*, 
                    p.nama_prodi, 
                    p.jenjang,
                    per.sistem, 
                    per.nama_jalur, 
                    per.gelombang
                FROM biaya_studi b
                INNER JOIN prodi p ON b.id_prodi = p.id_prodi
                INNER JOIN periode_pendaftaran per ON b.id_periode = per.id_periode
                ORDER BY b.id_biaya ASC
            """)
            result = await conn.execute(sql)
            
            biaya_list = []
            for row in result:
                row_dict = dict(row._mapping)
                # Convert Decimal ke float untuk JSON serialization di FastAPI
                for key, value in row_dict.items():
                    if hasattr(value, 'quantize'): # Cek apakah Decimal
                        row_dict[key] = float(value)
                biaya_list.append(row_dict)
                
            return biaya_list
    except Exception as e:
        logger.error(f"Error GET Biaya: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil data biaya studi.")


@router.post("/biaya")
async def create_biaya(biaya: BiayaCreate):
    try:
        async with admin_engine.begin() as conn:
            sql = text("""
                INSERT INTO biaya_studi (
                    id_prodi, id_periode, kelas, jenis_jalur, sks_min, sks_max,
                    biaya_formulir, biaya_asesmen, biaya_pkkmb, upp_nominal, ukt_nominal,
                    diskon_full_payment, diskon_alumni, diskon_pengurus_pii, diskon_gelombang,
                    biaya_sertifikasi_pratama, biaya_sertifikasi_madya, biaya_sertifikasi_utama
                ) VALUES (
                    :id_prodi, :id_periode, :kelas, :jenis_jalur, :sks_min, :sks_max,
                    :biaya_formulir, :biaya_asesmen, :biaya_pkkmb, :upp_nominal, :ukt_nominal,
                    :diskon_full_payment, :diskon_alumni, :diskon_pengurus_pii, :diskon_gelombang,
                    :biaya_sertifikasi_pratama, :biaya_sertifikasi_madya, :biaya_sertifikasi_utama
                )
            """)
            await conn.execute(sql, biaya.model_dump())
            
            # --- TRIGGER CACHE INVALIDATION ---
            # Cari nama prodi terlebih dahulu untuk invalidasi target
            cek = await conn.execute(text("SELECT nama_prodi FROM prodi WHERE id_prodi = :id"), {"id": biaya.id_prodi})
            prodi_lama = cek.fetchone()
            if prodi_lama:
                invalidate_prodi_cache(prodi_lama[0])
                
            return {"status": "success", "message": "Skema biaya baru berhasil ditambahkan"}
    except Exception as e:
        logger.error(f"Error POST Biaya: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan data biaya studi.")


@router.put("/biaya/{id_biaya}")
async def update_biaya(id_biaya: int, biaya: BiayaUpdate):
    try:
        async with admin_engine.begin() as conn:
            # 1. Cari tau ini harga punyanya prodi apa (buat hapus cache nanti)
            cek = await conn.execute(text("""
                SELECT p.nama_prodi 
                FROM biaya_studi b 
                INNER JOIN prodi p ON b.id_prodi = p.id_prodi 
                WHERE b.id_biaya = :id
            """), {"id": id_biaya})
            
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Skema biaya tidak ditemukan!")
            
            nama_prodi = data_lama[0]
            
            # 2. Siapkan data yang mau diupdate (hanya yang tidak None)
            update_data = biaya.model_dump(exclude_unset=True)
            if not update_data:
                return {"status": "success", "message": "Tidak ada data biaya yang diubah"}
            
            update_fields = [f"{key} = :{key}" for key in update_data.keys()]
            params = update_data.copy()
            params["id"] = id_biaya
            
            sql = text(f"UPDATE biaya_studi SET {', '.join(update_fields)} WHERE id_biaya = :id")
            await conn.execute(sql, params)
            
            # 3. TRIGGER CACHE INVALIDATION
            invalidate_prodi_cache(nama_prodi)
            
            # Jika Admin iseng pindahin harga ini ke prodi lain (id_prodi berubah)
            if biaya.id_prodi is not None:
                cek_baru = await conn.execute(text("SELECT nama_prodi FROM prodi WHERE id_prodi = :id"), {"id": biaya.id_prodi})
                nama_prodi_baru = cek_baru.fetchone()[0]
                if nama_prodi_baru != nama_prodi:
                    invalidate_prodi_cache(nama_prodi_baru)
            
            return {"status": "success", "message": f"Biaya untuk prodi {nama_prodi} berhasil diperbarui"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error PUT Biaya: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengubah data biaya studi.")


@router.delete("/biaya/{id_biaya}")
async def delete_biaya(id_biaya: int):
    try:
        async with admin_engine.begin() as conn:
            # 1. Cari tau nama prodi sebelum dihapus
            cek = await conn.execute(text("""
                SELECT p.nama_prodi 
                FROM biaya_studi b 
                INNER JOIN prodi p ON b.id_prodi = p.id_prodi 
                WHERE b.id_biaya = :id
            """), {"id": id_biaya})
            
            data_lama = cek.fetchone()
            if not data_lama:
                raise HTTPException(status_code=404, detail="Skema biaya tidak ditemukan!")
                
            nama_prodi = data_lama[0]
            
            # 2. Hapus datanya
            await conn.execute(text("DELETE FROM biaya_studi WHERE id_biaya = :id"), {"id": id_biaya})
            
            # 3. TRIGGER CACHE INVALIDATION
            invalidate_prodi_cache(nama_prodi)
            
            return {"status": "success", "message": f"Skema biaya untuk {nama_prodi} berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error DELETE Biaya: {e}")
        raise HTTPException(status_code=500, detail="Gagal menghapus data biaya studi.")


# ==========================================
# 4. CRUD TABEL KNOWLEDGE DOKUMEN (RAG PIPELINE)
# ==========================================

@router.get("/knowledge/dokumen")
async def get_all_knowledge_dokumen():
    """Mengambil daftar semua dokumen kualitatif untuk UI Admin"""
    try:
        async with admin_engine.connect() as conn:
            # Urutkan berdasarkan ID (yang baru masuk akan berada di paling bawah/nomor terakhir)
            sql = text("SELECT id, nama_dokumen, file_url, updated_at, nama_file_asli FROM knowledge_dokumen ORDER BY id ASC")
            result = await conn.execute(sql)
            
            dokumen_list = []
            for row in result:
                dokumen_list.append({
                    "id": row[0],
                    "nama_dokumen": row[1],
                    "file_url": row[2],
                    "updated_at": row[3].isoformat() if row[3] else None,
                    "nama_file_asli": row[4]
                })
                
            return {
                "status": "success",
                "data": dokumen_list
            }
    except Exception as e:
        logger.error(f"Error GET Knowledge Dokumen: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil daftar dokumen kualitatif.")


@router.get("/knowledge/dokumen/{id_dokumen}/download")
async def download_knowledge_dokumen(id_dokumen: int):
    """Mengunduh file fisik dari Supabase dengan nama file asli"""
    try:
        async with admin_engine.connect() as conn:
            sql = text("SELECT file_url, nama_file_asli FROM knowledge_dokumen WHERE id = :id")
            result = await conn.execute(sql, {"id": id_dokumen})
            doc = result.fetchone()
            
            if not doc:
                raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
                
            file_url = doc[0]
            nama_file_asli = doc[1] or file_url.split("/")[-1]
            
            # Ambil file dari Supabase Storage
            # supabase.storage.from_("bucket").download() mengembalikan bytes
            res = supabase_client.storage.from_("knowledge_files").download(file_url)
            
            # Buat stream response
            return StreamingResponse(
                io.BytesIO(res), 
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={
                    "Content-Disposition": f'attachment; filename="{nama_file_asli}"'
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error Download Knowledge Dokumen: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengunduh dokumen")


@router.delete("/knowledge/dokumen/{id_dokumen}")
async def delete_knowledge_dokumen(id_dokumen: int):
    """Menghapus Dokumen Kualitatif (Storage, SQL, Pinecone) secara Streaming"""
    
    async def process_delete():
        nama_dokumen = f"ID {id_dokumen}"
        try:
            yield json.dumps({"progress": 10, "message": "Memvalidasi dokumen di Database SQL...", "status": "processing"}) + "\n"
            
            async with admin_engine.begin() as conn:
                cek = await conn.execute(text("SELECT file_url, nama_dokumen FROM knowledge_dokumen WHERE id = :id"), {"id": id_dokumen})
                data_lama = cek.fetchone()
                if not data_lama:
                    yield json.dumps({"progress": 0, "message": "Dokumen tidak ditemukan di Database SQL!", "status": "error"}) + "\n"
                    return
                
                file_url = data_lama[0]
                nama_dokumen = data_lama[1]
                
                filename = file_url.split("/")[-1] if "/" in file_url else file_url
                
                yield json.dumps({"progress": 30, "message": "Menghapus file fisik dari Cloud Storage...", "status": "processing"}) + "\n"
                try:
                    supabase_client.storage.from_("knowledge_files").remove([filename])
                except Exception as e:
                    logger.warning(f"⚠️ [Storage] Gagal menghapus file fisik (mungkin sudah hilang): {e}")
                    
                yield json.dumps({"progress": 50, "message": "Menghapus metadata & potongan teks dari Database SQL...", "status": "processing"}) + "\n"
                await conn.execute(text("DELETE FROM knowledge_dokumen WHERE id = :id"), {"id": id_dokumen})
                
            yield json.dumps({"progress": 70, "message": "Menghapus vektor pengetahuan dari memori AI (Pinecone)...", "status": "processing"}) + "\n"
            try:
                pinecone_index.delete(filter={"id_dokumen": id_dokumen})
            except Exception as e:
                logger.error(f"❌ [Pinecone] Gagal menghapus vektor dari Pinecone: {e}")
                
            yield json.dumps({"progress": 90, "message": "Melakukan Sinkronisasi Knowledge AI...", "status": "processing"}) + "\n"
            try:
                pinecone_index.delete(delete_all=True, namespace='cache')
            except Exception as e:
                pass
                
            async for sync_msg in sync_pinecone_knowledge():
                yield sync_msg
            
            yield json.dumps({"progress": 95, "message": "Membersihkan Semantic Cache Cerdas AI...", "status": "processing"}) + "\n"
            invalidate_knowledge_cache()

            yield json.dumps({"progress": 100, "message": f"Selesai! Dokumen '{nama_dokumen}' berhasil dihapus sepenuhnya.", "status": "success"}) + "\n"
        
        except Exception as e:
            logger.error(f"Error DELETE Dokumen Stream: {e}")
            error_msg = str(e)
            if "QueryCanceledError" in error_msg or "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
                user_msg = f"Harap tunggu 1-2 menit dan coba klik Hapus lagi pada dokumen '{nama_dokumen}'. Terdapat antrian kunci di database (Database Lock/Timeout)."
            else:
                user_msg = f"Terjadi kesalahan server saat menghapus '{nama_dokumen}': {error_msg}"
                
            yield json.dumps({"progress": 0, "message": user_msg, "status": "error"}) + "\n"

    return StreamingResponse(process_delete(), media_type="application/x-ndjson")


@router.post("/knowledge/upload")
async def upload_knowledge_dokumen(
    file: UploadFile = File(...),
    id_dokumen_update: Optional[int] = Form(None)
):
    """API Endpoint Sakti: Cek Duplikat -> Replace/Upload -> Storage -> SQL -> Splitter -> Gemini -> Pinecone (STREAMING)"""
    # 1. Validasi Ekstensi File & Baca ke Memory di luar generator
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Format tidak didukung! Hanya menerima file .docx")
        
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membaca file: {e}")
        
    original_filename = file.filename

    async def process_upload():
        # === VARIABEL PELACAK UNTUK ROLLBACK / CLEANUP ===
        # Kita hanya rollback file green yang baru diupload
        green_filename = None
        
        try:
            yield json.dumps({"progress": 5, "message": "Membaca isi dokumen Word...", "status": "processing"}) + "\n"
            
            file_stream = io.BytesIO(file_bytes)
            
            yield json.dumps({"progress": 10, "message": "Memotong teks menjadi bongkahan (Chunks)...", "status": "processing"}) + "\n"
            splitter = HierarchicalTextSplitter(max_chunk_length=3000)
            chunks = splitter.parse_docx(file_stream)
                
            if not chunks:
                yield json.dumps({"progress": 0, "message": "Dokumen kosong atau gagal dibaca.", "status": "error"}) + "\n"
                return
                
            heading_1 = chunks[0]["metadata"]["dokumen_asal"]
            if not heading_1 or heading_1 == "Dokumen Tidak Diketahui":
                heading_1 = original_filename.replace(".docx", "")
                
            # 1. Panggil Gemini API DI AWAL SEBELUM MENYENTUH DATABASE
            total_chunks = len(chunks)
            vector_data_list_temp = []
            
            for idx, chunk in enumerate(chunks):
                curr_progress = 10 + int(((idx + 1) / total_chunks) * 35) # Progress 10 -> 45
                yield json.dumps({
                        "progress": curr_progress, 
                        "message": f"Memanggil AI Gemini: Proses embedding Chunk {idx+1} dari {total_chunks}...", 
                        "status": "processing"
                    }) + "\n"

                kategori = chunk["metadata"]["kategori"]
                dokumen_asal = chunk["metadata"]["dokumen_asal"]
                teks = chunk["text"]
                rich_text = f"{dokumen_asal} - {kategori}\n{teks}"
                
                try:
                    gemini_resp = gemini_client.models.embed_content(
                        model='gemini-embedding-2',
                        contents=rich_text,
                        config=types.EmbedContentConfig(output_dimensionality=768)
                    )
                    dense_vec = gemini_resp.embeddings[0].values
                except Exception as e:
                    logger.error(f"Gemini API Error: {e}")
                    yield json.dumps({"progress": 0, "message": f"Gagal API Gemini pada chunk {idx+1}. Dokumen belum tersentuh.", "status": "error"}) + "\n"
                    return
                    
                vector_str = json.dumps(dense_vec)
                
                vector_data_list_temp.append({
                    "kategori": kategori,
                    "teks": teks,
                    "dense_vector": vector_str,
                    "dokumen_asal": dokumen_asal
                })
                
            # 2. Upload file ke Supabase Storage (Green)
            yield json.dumps({"progress": 50, "message": "Mengecek duplikasi & Mengunggah file fisik ke Storage...", "status": "processing"}) + "\n"
            
            async with admin_engine.begin() as conn:
                data_lama = None
                if id_dokumen_update:
                    cek_by_id = await conn.execute(text("SELECT id, file_url FROM knowledge_dokumen WHERE id = :id"), {"id": id_dokumen_update})
                    data_lama = cek_by_id.fetchone()
                    if not data_lama:
                        yield json.dumps({"progress": 0, "message": "Dokumen yang ingin diupdate tidak ditemukan.", "status": "error"}) + "\n"
                        return
                else:
                    cek_dup = await conn.execute(text("SELECT id, file_url FROM knowledge_dokumen WHERE nama_dokumen = :nama"), {"nama": heading_1})
                    data_lama = cek_dup.fetchone()
            
            file_ext = original_filename.split('.')[-1]
            green_filename = f"{uuid.uuid4().hex}.{file_ext}"
            
            try:
                res = supabase_client.storage.from_("knowledge_files").upload(
                    file=file_bytes,
                    path=green_filename,
                    file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                )
            except Exception as e:
                logger.error(f"Gagal upload ke Storage: {e}")
                yield json.dumps({"progress": 0, "message": "Gagal mengunggah file ke Supabase Storage.", "status": "error"}) + "\n"
                return

            # 3. TRANSISI BLUE-GREEN DI SQL
            yield json.dumps({"progress": 65, "message": "Menyimpan pengetahuan baru ke Database SQL...", "status": "processing"}) + "\n"
            
            id_dokumen_baru = None
            old_filename = None
            old_id = None
            
            async with admin_engine.begin() as conn:
                if data_lama:
                    old_id = data_lama[0]
                    old_file_url = data_lama[1]
                    old_filename = old_file_url.split("/")[-1] if "/" in old_file_url else old_file_url
                    
                    # Update row dokumen dengan green_filename
                    await conn.execute(
                        text("UPDATE knowledge_dokumen SET file_url = :url, nama_dokumen = :nama, nama_file_asli = :nama_asli, updated_at = CURRENT_TIMESTAMP WHERE id = :id"), 
                        {"url": green_filename, "nama": heading_1, "nama_asli": original_filename, "id": old_id}
                    )
                    
                    # Hapus chunks lama (Aman karena dokumen baru sudah sukses ter-generate vektornya)
                    await conn.execute(text("DELETE FROM knowledge_chunks WHERE id_dokumen = :id"), {"id": old_id})
                    id_dokumen_baru = old_id
                else:
                    # Insert row dokumen baru
                    sql_insert_doc = text("""
                        INSERT INTO knowledge_dokumen (nama_dokumen, file_url, nama_file_asli)
                        VALUES (:nama, :url, :nama_asli) RETURNING id
                    """)
                    result = await conn.execute(sql_insert_doc, {
                        "nama": heading_1, 
                        "url": green_filename,
                        "nama_asli": original_filename
                    })
                    id_dokumen_baru = result.scalar()
                
                # Masukkan chunks baru
                vector_data_list_final = []
                for v in vector_data_list_temp:
                    v["id_dokumen"] = id_dokumen_baru
                    vector_data_list_final.append(v)
                    
                sql_insert_chunk = text("""
                    INSERT INTO knowledge_chunks (id_dokumen, kategori, teks, dense_vector, dokumen_asal)
                    VALUES (:id_dokumen, :kategori, :teks, :dense_vector, :dokumen_asal)
                """)
                await conn.execute(sql_insert_chunk, vector_data_list_final)

            # 4. PEMBERSIHAN DATA LAMA (BLUE)
            yield json.dumps({"progress": 85, "message": "Pembersihan Data Lama & Sinkronisasi Pinecone...", "status": "processing"}) + "\n"
            
            # Hapus vektor lama dari Pinecone JIKA ini update
            if old_id:
                try:
                    pinecone_index.delete(filter={"id_dokumen": old_id})
                except Exception as e:
                    logger.warning(f"⚠️ [Pinecone] Gagal menghapus vektor lama (Orphan vector): {e}")
                
                # Hapus file storage lama JIKA ini update
                try:
                    supabase_client.storage.from_("knowledge_files").remove([old_filename])
                except Exception as e:
                    logger.warning(f"⚠️ [Storage] Gagal menghapus file lama di Supabase: {e}")
                    
            try:
                pinecone_index.delete(delete_all=True, namespace='cache')
            except Exception as e:
                pass
                
            # Sinkronisasi (Hanya mengirim dokumen yang baru masuk)
            async for sync_msg in sync_pinecone_knowledge():
                yield sync_msg
            
            yield json.dumps({"progress": 95, "message": "Melakukan sinkronisasi Caching AI...", "status": "processing"}) + "\n"
            invalidate_knowledge_cache()
            
            yield json.dumps({"progress": 100, "message": f"Selesai! Dokumen '{heading_1}' berhasil disuntikkan ke otak AI.", "status": "success"}) + "\n"
            
        except Exception as e:
            logger.error(f"Error POST Upload Dokumen Stream (Blue-Green): {e}")
            error_msg = str(e)
            nama_file = file.filename
            
            if "ConnectionDoesNotExistError" in error_msg or "closed in the middle" in error_msg.lower() or "QueryCanceledError" in error_msg or "timeout" in error_msg.lower():
                user_msg = f"Koneksi jaringan ke Database terputus. Sedang membersihkan file sementara... Harap coba upload ulang."
            else:
                user_msg = f"Terjadi kesalahan: {error_msg}. Sedang membersihkan file sementara..."
                
            yield json.dumps({"progress": 0, "message": user_msg, "status": "error"}) + "\n"
            
            # === SISTEM ROLLBACK SEDERHANA (HANYA HAPUS GREEN FILE JIKA GAGAL) ===
            # Dokumen lama di SQL dan Pinecone 100% AMAN karena transaksi gagal sebelum di-commit
            if green_filename:
                try:
                    supabase_client.storage.from_("knowledge_files").remove([green_filename])
                except Exception as rollback_err:
                    logger.error(f"Gagal Rollback Storage Green File: {rollback_err}")

    return StreamingResponse(process_upload(), media_type="application/x-ndjson")

@router.post("/knowledge/hard-reset")
async def hard_reset_pinecone():
    """Endpoint untuk menghapus 100% vektor Pinecone dan sinkronisasi ulang (Streaming)"""
    async def process_reset():
        try:
            yield json.dumps({"progress": 10, "message": "Mengosongkan seluruh memori AI di Pinecone...", "status": "processing"}) + "\n"
            
            # Hapus Storage Files yang Yatim Piatu (SQL_MISSING)
            try:
                storage_res = supabase_client.storage.from_("knowledge_files").list()
                if storage_res:
                    storage_filenames = [f['name'] for f in storage_res if f['name'] not in ['.emptyFolderPlaceholder', 'bm25_params.json']]
                    
                    async with admin_engine.connect() as conn:
                        doc_res = await conn.execute(text("SELECT file_url FROM knowledge_dokumen"))
                        sql_urls = [r[0] for r in doc_res.fetchall()]
                        sql_filenames = [u.split("/")[-1] if "/" in u else u for u in sql_urls]
                    
                    files_to_delete = [f for f in storage_filenames if f not in sql_filenames]
                    if files_to_delete:
                        yield json.dumps({"progress": 20, "message": f"Menghapus {len(files_to_delete)} file sampah dari Cloud Storage...", "status": "processing"}) + "\n"
                        supabase_client.storage.from_("knowledge_files").remove(files_to_delete)
            except Exception as e:
                logger.error(f"Gagal membersihkan storage: {e}")
                
            # Hapus semua vektor di namespace utama
            try:
                pinecone_index.delete(delete_all=True)
            except Exception as e:
                logger.warning(f"Pinecone default namespace reset info: {e}")
            
            # Hapus semantic cache di Lapis 1 dan Redis di Lapis 2
            try:
                invalidate_knowledge_cache()
            except Exception as e:
                logger.warning(f"Pinecone cache namespace reset info: {e}")
            
            yield json.dumps({"progress": 50, "message": "Membaca data dari SQL dan melatih ulang AI...", "status": "processing"}) + "\n"
            
            from app.tools.pinecone_tool import sync_pinecone_knowledge
            async for chunk in sync_pinecone_knowledge():
                yield chunk
            
            yield json.dumps({"progress": 100, "message": "Memori AI berhasil disinkronisasi total!", "status": "success"}) + "\n"
        except Exception as e:
            logger.error(f"Error Hard Reset: {e}")
            yield json.dumps({"progress": 0, "message": f"Gagal hard reset: {e}", "status": "error"}) + "\n"
            
    return StreamingResponse(process_reset(), media_type="application/x-ndjson")

# ==========================================
# 4. OBSERVABILITY & ANALITIK (TASK 1.5)
# ==========================================

@router.get("/metrics")
async def get_metrics():
    """Mengambil statistik performa keseluruhan untuk Dashboard"""
    try:
        async with admin_engine.connect() as conn:
            # Total Leads
            res_leads = await conn.execute(text("SELECT COUNT(*) FROM leads"))
            total_leads = res_leads.scalar() or 0
            
            # Total Percakapan
            res_chats = await conn.execute(text("SELECT COUNT(*) FROM chat_logs"))
            total_chats = res_chats.scalar() or 0
            
            # Rata-rata Latensi
            res_latency = await conn.execute(text("SELECT AVG(response_time_ms) FROM chat_logs WHERE response_time_ms IS NOT NULL"))
            avg_latency = res_latency.scalar()
            avg_latency_ms = int(avg_latency) if avg_latency else 0
            
            return {
                "status": "success",
                "data": {
                    "total_leads": total_leads,
                    "total_chats": total_chats,
                    "avg_latency_ms": avg_latency_ms
                }
            }
    except Exception as e:
        logger.error(f"Error GET Metrics: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil data metrik.")

@router.get("/leads")
async def get_all_leads(limit: int = 20, offset: int = 0):
    """Mengambil semua data pendaftar (Buku Tamu) dengan fitur pagination"""
    try:
        async with admin_engine.connect() as conn:
            # Mengambil total jumlah pendaftar
            count_result = await conn.execute(text("SELECT COUNT(*) FROM leads"))
            total_count = count_result.scalar() or 0

            # Mengambil data pendaftar sesuai halaman (limit & offset)
            query = text("""
                SELECT id_lead, nama_lengkap, email_google, no_whatsapp, to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') 
                FROM leads 
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await conn.execute(query, {"limit": limit, "offset": offset})
            rows = result.fetchall()
            
            return {
                "status": "success",
                "total_count": total_count,
                "data": [
                    {
                        "id_lead": str(row[0]),
                        "nama_lengkap": row[1],
                        "email_google": row[2],
                        "no_whatsapp": row[3],
                        "created_at": row[4]
                    } for row in rows
                ]
            }
    except Exception as e:
        logger.error(f"Error GET Leads: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil data leads.")

@router.delete("/leads/{id_lead}")
async def delete_lead(id_lead: str):
    """Menghapus Lead beserta seluruh riwayat chat-nya secara permanen (Hard Delete)"""
    try:
        async with admin_engine.begin() as conn:
            # Hapus riwayat chat dulu (meskipun mungkin udah ada CASCADE, kita pastikan)
            await conn.execute(text("DELETE FROM chat_logs WHERE id_lead = :id"), {"id": id_lead})
            # Hapus data lead utama
            result = await conn.execute(text("DELETE FROM leads WHERE id_lead = :id RETURNING id_lead"), {"id": id_lead})
            
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Data pendaftar tidak ditemukan.")
                
            return {"status": "success", "message": "Pendaftar dan seluruh riwayat chat-nya berhasil dihapus secara permanen."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error DELETE Lead: {e}")
        raise HTTPException(status_code=500, detail="Gagal menghapus data lead.")

@router.get("/chat-logs/{id_lead}")
async def get_chat_logs_by_lead(id_lead: str, limit: int = 20, offset: int = 0):
    """Mengambil riwayat percakapan spesifik untuk satu user dengan fitur pagination"""
    try:
        async with admin_engine.connect() as conn:
            sql = text("""
                SELECT 
                    EXTRACT(EPOCH FROM created_at) as id, 
                    user_query, 
                    bot_response, 
                    routed_to, 
                    response_time_ms, 
                    prompt_tokens, 
                    completion_tokens, 
                    to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') 
                FROM chat_logs 
                WHERE id_lead = :id_lead 
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await conn.execute(sql, {"id_lead": id_lead, "limit": limit, "offset": offset})
            
            # Convert result rows into a list and reverse it so it is oldest to newest
            rows = list(result.fetchall())
            rows.reverse()
            
            return {
                "status": "success",
                "data": [
                    {
                        "id": float(row[0]),
                        "user_query": row[1],
                        "bot_response": row[2],
                        "routed_to": row[3],
                        "response_time_ms": row[4],
                        "prompt_tokens": row[5],
                        "completion_tokens": row[6],
                        "created_at": row[7]
                    } for row in rows
                ]
            }
    except Exception as e:
        logger.error(f"Error GET Chat Logs: {e}")
        raise HTTPException(status_code=500, detail="Gagal mengambil riwayat chat.")

# ==========================================
# 5. SYSTEM HEALTH DASHBOARD (VALIDASI DATA)
# ==========================================

@router.get("/knowledge/health")
async def verify_knowledge_health():
    """Mengecek integritas sinkronisasi antara SQL, Storage, dan Pinecone"""
    try:
        issues = []
        is_healthy = True
        
        async with admin_engine.connect() as conn:
            # SQL Docs
            doc_res = await conn.execute(text("SELECT file_url, nama_dokumen FROM knowledge_dokumen"))
            sql_docs = doc_res.fetchall()
            sql_filenames = { (r[0].split("/")[-1] if "/" in r[0] else r[0]): r[1] for r in sql_docs }
            
            # SQL Chunks
            chunk_res = await conn.execute(text("SELECT COUNT(*) FROM knowledge_chunks"))
            sql_chunks = chunk_res.scalar() or 0
            
        # Storage Files
        storage_res = supabase_client.storage.from_("knowledge_files").list()
        storage_filenames = [f['name'] for f in storage_res if f['name'] != '.emptyFolderPlaceholder' and f['name'] != 'bm25_params.json']
        
        bm25_ready = any(f['name'] == 'bm25_params.json' for f in storage_res)
        
        # Pinecone Vectors
        pinecone_stats = pinecone_index.describe_index_stats()
        pinecone_vectors = pinecone_stats.total_vector_count
        
        # CROSS CHECK 1: SQL vs Storage
        for sql_f in sql_filenames.keys():
            if sql_f not in storage_filenames:
                is_healthy = False
                issues.append({
                    "target": sql_filenames[sql_f],
                    "type": "STORAGE_MISSING",
                    "reason": "File fisik gagal terunggah ke Cloud Storage akibat koneksi terputus.",
                    "action": "Harap hapus dokumen di tabel lalu unggah ulang."
                })
                
        for storage_f in storage_filenames:
            if storage_f not in sql_filenames:
                is_healthy = False
                original_name = storage_f.split("_", 1)[-1] if "_" in storage_f else storage_f
                issues.append({
                    "target": original_name,
                    "type": "SQL_MISSING",
                    "reason": "File sampah sisa upload gagal. Proses rollback otomatis sebelumnya tidak tuntas.",
                    "action": "Harap unggah ulang dokumen dengan nama yang sama persis untuk menimpa file sampah ini."
                })
                
        # CROSS CHECK 2: SQL Chunks vs Pinecone Vectors
        if sql_chunks > pinecone_vectors:
            is_healthy = False
            issues.append({
                "target": "Global Pinecone Index",
                "type": "PINECONE_MISSING",
                "reason": "Gagal menyuntikkan seluruh vektor ke otak AI Pinecone akibat Timeout jaringan.",
                "action": "Pilih salah satu dokumen secara acak, lalu klik Hapus, dan Unggah ulang untuk memicu sinkronisasi massal Pinecone."
            })
        elif sql_chunks < pinecone_vectors:
            is_healthy = False
            issues.append({
                "target": "Global Pinecone Index",
                "type": "PINECONE_ORPHAN",
                "reason": "Terdapat data hantu di memori AI Pinecone yang sudah tidak ada di SQL.",
                "action": "Pilih salah satu dokumen secara acak, lalu klik Hapus, dan Unggah ulang untuk memicu sinkronisasi massal Pinecone."
            })
            
        if not bm25_ready and sql_chunks > 0:
            is_healthy = False
            issues.append({
                "target": "bm25_params.json",
                "type": "BM25_MISSING",
                "reason": "Kamus keyword AI gagal dibackup ke Cloud Storage.",
                "action": "Pilih salah satu dokumen secara acak, lalu klik Hapus, dan Unggah ulang untuk memicu sinkronisasi massal Pinecone."
            })

        return {
            "status": "success",
            "data": {
                "is_healthy": is_healthy,
                "issues": issues,
                "metrics": {
                    "sql_docs": len(sql_filenames),
                    "storage_files": len(storage_filenames),
                    "sql_chunks": sql_chunks,
                    "pinecone_vectors": pinecone_vectors,
                    "bm25_ready": bm25_ready
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error GET Knowledge Health: {e}")
        raise HTTPException(status_code=500, detail="Gagal melakukan validasi sistem")


# ==========================================
# 4. CRUD MANAJEMEN ADMIN USERS (AUTH)
# ==========================================
from app.models.admin_schema import AdminUserCreate

@router.get("/admin-users")
async def get_admin_users():
    """Membaca daftar admin yang punya akses"""
    try:
        async with admin_engine.connect() as conn:
            result = await conn.execute(text("SELECT id, email, created_at FROM admin_users ORDER BY created_at ASC"))
            rows = result.fetchall()
            return [{"id": str(row[0]), "email": row[1], "created_at": row[2].isoformat()} for row in rows]
    except Exception as e:
        logger.error(f"Error GET admin_users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin-users")
async def create_admin_user(user: AdminUserCreate):
    """Menambahkan email admin baru"""
    try:
        async with admin_engine.connect() as conn:
            # Cek dulu apakah email sudah ada
            check = await conn.execute(
                text("SELECT id FROM admin_users WHERE email = :email"),
                {"email": user.email}
            )
            if check.fetchone():
                raise HTTPException(status_code=400, detail="Email ini sudah terdaftar sebagai admin.")
                
            await conn.execute(
                text("INSERT INTO admin_users (email) VALUES (:email)"),
                {"email": user.email}
            )
            await conn.commit()
            return {"status": "success", "message": f"Email {user.email} berhasil ditambahkan."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error POST admin_users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin-users/{id}")
async def delete_admin_user(id: str):
    """Menghapus admin dengan sistem Failsafe Anti-Lockout"""
    try:
        async with admin_engine.connect() as conn:
            # FAILSAFE: Hitung jumlah sisa admin
            count_result = await conn.execute(text("SELECT COUNT(*) FROM admin_users"))
            total_admins = count_result.scalar()
            
            if total_admins <= 1:
                raise HTTPException(status_code=400, detail="Gagal: Minimal harus ada 1 Admin operasional yang tersisa.")
                
            result = await conn.execute(
                text("DELETE FROM admin_users WHERE id = :id RETURNING id"),
                {"id": id}
            )
            if not result.fetchone():
                raise HTTPException(status_code=404, detail="Admin tidak ditemukan.")
                
            await conn.commit()
            return {"status": "success", "message": "Akses admin berhasil dicabut."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error DELETE admin_users: {e}")
        raise HTTPException(status_code=500, detail=str(e))
