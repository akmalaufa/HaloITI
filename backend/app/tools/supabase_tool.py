from sqlalchemy import text, NullPool
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from typing import Optional

# Import official Supabase client untuk Storage
from supabase import create_client, Client

# Inisialisasi Supabase REST Client
if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    raise ValueError("FATAL: SUPABASE_URL atau SUPABASE_KEY tidak ditemukan!")
supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# 1. Inisialisasi Mesin Database Asinkronus (AsyncEngine) KHUSUS AGEN (Read-Only)
# Menggunakan NullPool untuk mencegah bentrok dengan Transaction Pooler Supabase
db_url = settings.AGENT_DATABASE_URL
if not db_url:
    raise ValueError("FATAL: AGENT_DATABASE_URL tidak ditemukan di file .env! Agen dilarang menyala tanpa pengamanan.")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# 2. Inisialisasi Mesin Database Asinkronus KHUSUS ADMIN (Read-Write)
admin_db_url = settings.DATABASE_URL
if admin_db_url.startswith("postgres://"):
    admin_db_url = admin_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif admin_db_url.startswith("postgresql://") and "+asyncpg" not in admin_db_url:
    admin_db_url = admin_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url, 
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0}
)

admin_engine = create_async_engine(
    admin_db_url, 
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0}
)

async def _run_safe_query(sql_query: str) -> str:
    """Fungsi internal untuk mengeksekusi SQL dengan aman (Read-Only)."""
    try:
        # A. Pengamanan Ketat (Anti SQL Injection di Level Python)
        forbidden_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "GRANT"]
        upper_query = sql_query.upper()
        
        if any(keyword in upper_query for keyword in forbidden_keywords):
            return "ERROR_SECURITY_VIOLATION: Dilarang keras melakukan manipulasi data. Hanya izinkan perintah SELECT!"

        print(f"🔍 [Supabase Tool] Mengeksekusi Query SQL (Async):\n{sql_query}")

        # B. Eksekusi Query ke Supabase
        async with engine.connect() as connection:
            result = await connection.execute(text(sql_query))
            columns = result.keys()
            rows = result.fetchall()
            
            # C. Mengemas Hasil
            if not rows:
                return "DATA_NOT_FOUND: Tidak ada data yang cocok dengan kueri tersebut di Supabase."
            
            formatted_results = [str({col: str(val) for col, val in zip(columns, row)}) for row in rows]
            return "\n".join(formatted_results)

    except SQLAlchemyError as db_error:
        print(f"❌ [Supabase Tool] Database Error: {db_error}")
        return "DATABASE_ERROR: Gagal mengeksekusi kueri. Pastikan nama tabel dan kolom sesuai."
    except Exception as e:
        print(f"❌ [Supabase Tool] General Error: {e}")
        return "SYSTEM_ERROR: Terjadi kesalahan internal sistem."

# ==========================================
# FUNGSI EKSEKUTOR MICRO-TOOLS BIAYA
# ==========================================

async def query_biaya_reguler(prodi: str, sql_query: str, kelas: Optional[str] = None) -> str:
    """Eksekutor untuk CekBiayaRegulerSchema"""
    return await _run_safe_query(sql_query)

async def query_biaya_rpl(prodi: str, sql_query: str, estimasi_sks: Optional[int] = None) -> str:
    """Eksekutor untuk CekBiayaRPLSchema"""
    return await _run_safe_query(sql_query)

async def query_biaya_psppi(prodi: str, sql_query: str, status_diskon: Optional[str] = None) -> str:
    """Eksekutor untuk CekBiayaPSPPISchema"""
    return await _run_safe_query(sql_query)

# ==========================================
# FUNGSI EKSEKUTOR MICRO-TOOLS JADWAL & ANALITIK
# ==========================================

async def query_jadwal_pmb(sistem_studi: str, sql_query: str, gelombang: Optional[str] = None) -> str:
    """Eksekutor untuk CekJadwalPMBSchema"""
    return await _run_safe_query(sql_query)

async def query_analitik_global(sql_query: str) -> str:
    """Eksekutor untuk CekAnalitikGlobalSchema"""
    return await _run_safe_query(sql_query)