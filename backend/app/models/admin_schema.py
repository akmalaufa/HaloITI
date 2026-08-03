from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal

# ==========================================
# 1. SCHEMA PRODI
# ==========================================
class ProdiBase(BaseModel):
    id_prodi: int
    nama_prodi: str
    jenjang: str

class ProdiCreate(ProdiBase):
    pass

class ProdiUpdate(BaseModel):
    # Semua opsional, karena kalau admin edit, dia bisa aja cuma ganti nama doang
    id_prodi: Optional[int] = None
    nama_prodi: Optional[str] = None
    jenjang: Optional[str] = None


# ==========================================
# 2. SCHEMA PERIODE PENDAFTARAN
# ==========================================
class PeriodeBase(BaseModel):
    sistem: str
    nama_jalur: str
    gelombang: int
    tgl_buka: date
    tgl_tutup: date
    link_pendaftaran: Optional[str] = None

class PeriodeCreate(PeriodeBase):
    pass

class PeriodeUpdate(BaseModel):
    sistem: Optional[str] = None
    nama_jalur: Optional[str] = None
    gelombang: Optional[int] = None
    tgl_buka: Optional[date] = None
    tgl_tutup: Optional[date] = None
    link_pendaftaran: Optional[str] = None


# ==========================================
# 3. SCHEMA BIAYA STUDI (PRICING ENGINE)
# ==========================================
class BiayaBase(BaseModel):
    id_prodi: int
    id_periode: int
    kelas: str
    jenis_jalur: Optional[str] = None
    sks_min: int = 0
    sks_max: int = 0
    
    # Biaya Dasar
    biaya_formulir: Decimal = Field(default=0, decimal_places=2)
    biaya_asesmen: Decimal = Field(default=0, decimal_places=2)
    biaya_pkkmb: Decimal = Field(default=0, decimal_places=2)
    upp_nominal: Decimal = Field(default=0, decimal_places=2)
    ukt_nominal: Decimal = Field(default=0, decimal_places=2)
    
    # Diskon/Potongan
    diskon_full_payment: Decimal = Field(default=0, decimal_places=2)
    diskon_alumni: Decimal = Field(default=0, decimal_places=2)
    diskon_pengurus_pii: Decimal = Field(default=0, decimal_places=2)
    diskon_gelombang: Decimal = Field(default=0, decimal_places=2)
    
    # Khusus Sertifikasi PSPPI Profesional
    biaya_sertifikasi_pratama: Decimal = Field(default=0, decimal_places=2)
    biaya_sertifikasi_madya: Decimal = Field(default=0, decimal_places=2)
    biaya_sertifikasi_utama: Decimal = Field(default=0, decimal_places=2)

class BiayaCreate(BiayaBase):
    pass

class BiayaUpdate(BaseModel):
    id_prodi: Optional[int] = None
    id_periode: Optional[int] = None
    kelas: Optional[str] = None
    jenis_jalur: Optional[str] = None
    sks_min: Optional[int] = None
    sks_max: Optional[int] = None
    
    biaya_formulir: Optional[Decimal] = None
    biaya_asesmen: Optional[Decimal] = None
    biaya_pkkmb: Optional[Decimal] = None
    upp_nominal: Optional[Decimal] = None
    ukt_nominal: Optional[Decimal] = None
    
    diskon_full_payment: Optional[Decimal] = None
    diskon_alumni: Optional[Decimal] = None
    diskon_pengurus_pii: Optional[Decimal] = None
    diskon_gelombang: Optional[Decimal] = None
    
    biaya_sertifikasi_pratama: Optional[Decimal] = None
    biaya_sertifikasi_madya: Optional[Decimal] = None
    biaya_sertifikasi_utama: Optional[Decimal] = None

# ==========================================
# 4. SCHEMA ADMIN USERS (AUTH)
# ==========================================
class AdminUserCreate(BaseModel):
    email: str
