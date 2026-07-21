from fastapi import APIRouter, HTTPException, Header, Security
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, NullPool
from app.core.config import settings
from app.core.security import create_access_token

router = APIRouter()

# Setup Pipa Database untuk Resepsionis (Menggunakan koneksi yang aman)
db_url = settings.DATABASE_URL
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url and db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Kita pakai NullPool biar ringan dan nggak bentrok sama Supabase Pooler
engine = create_async_engine(db_url, poolclass=NullPool) if db_url else None

class LeadRequest(BaseModel):
    nama_lengkap: str
    email_google: EmailStr
    no_whatsapp: Optional[str] = None
    
@router.post("/")
async def register_or_login_lead(
    lead: LeadRequest,
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Endpoint (Resepsionis) untuk menerima pendaftaran Maba atau Login Ulang (Silent Check).
    Mengembalikan JWT Token jika sukses.
    """
    # 0. Verifikasi Kunci Proxy (X-API-KEY)
    if x_api_key != settings.X_API_KEY:
        raise HTTPException(
            status_code=403, 
            detail="Akses Ditolak: Hanya API Internal yang diizinkan!"
        )

    if not engine:
        raise HTTPException(status_code=500, detail="Konfigurasi Database belum diatur.")
        
    try:
        async with engine.connect() as conn:
            # 1. Pengecekan Bisu (Silent Check): Apakah Email sudah terdaftar?
            check_sql = text("SELECT id_lead, no_whatsapp FROM leads WHERE email_google = :email")
            result = await conn.execute(check_sql, {"email": lead.email_google})
            existing_lead = result.fetchone()
            
            if existing_lead:
                # SKENARIO A: MABA LAMA (Sudah ada di database)
                id_lead = existing_lead[0]
                existing_wa = existing_lead[1]
                
                # Jika Maba ngisi WA lagi dan angkanya beda, kita update (Ganti Nomor HP)
                if lead.no_whatsapp and lead.no_whatsapp != existing_wa:
                    update_sql = text("UPDATE leads SET no_whatsapp = :wa WHERE id_lead = :id")
                    await conn.execute(update_sql, {"wa": lead.no_whatsapp, "id": id_lead})
                    await conn.commit()
            else:
                # SKENARIO B: MABA BARU
                if not lead.no_whatsapp:
                    # Kalau belum pernah daftar dan WA kosong (Cuma login Google), 
                    # kita kasih tau Frontend buat nampilin Modal Input WA!
                    return {"status": "need_whatsapp"}
                    
                # Kalau WA sudah diisi, Masukkan data baru ke tabel (INSERT)
                insert_sql = text("""
                    INSERT INTO leads (nama_lengkap, email_google, no_whatsapp) 
                    VALUES (:nama, :email, :wa) 
                    RETURNING id_lead
                """)
                result = await conn.execute(insert_sql, {
                    "nama": lead.nama_lengkap,
                    "email": lead.email_google,
                    "wa": lead.no_whatsapp
                })
                id_lead = result.fetchone()[0]
                await conn.commit()
                
            # 2. Pembuatan Tiket JWT
            # Kita simpan id_lead Maba ini ke dalam Payload JWT dengan label 'sub' (Subject)
            access_token = create_access_token(data={"sub": str(id_lead)})
            
            return {
                "status": "success", 
                "access_token": access_token
            }
            
    except Exception as e:
        print(f"❌ [Database Error] Gagal memproses data Leads: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal pada server pendaftaran.")
