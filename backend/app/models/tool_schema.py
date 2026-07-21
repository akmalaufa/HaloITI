from pydantic import BaseModel, Field
from typing import Optional

# ==========================================
# KONSTITUSI SKEMA DATABASE SUPABASE
# ==========================================
DB_SCHEMA_PROMPT = """
Gunakan skema database PostgreSQL berikut untuk merakit sql_query:
1. Tabel `prodi`: id_prodi (INT), nama_prodi (VARCHAR), jenjang (VARCHAR)
2. Tabel `periode_pendaftaran`: id_periode (SERIAL), sistem (VARCHAR - 'Reguler', 'RPL', 'PSPPI'), nama_jalur (VARCHAR), gelombang (VARCHAR), tgl_buka (DATE), tgl_tutup (DATE)
3. Tabel `biaya_studi`: id_biaya (SERIAL), id_prodi (INT), id_periode (INT), kelas (VARCHAR - 'Weekdays', 'Weekend'), jenis_jalur (VARCHAR), sks_min (INT), sks_max (INT), biaya_formulir (DECIMAL), biaya_asesmen (DECIMAL), biaya_pkkmb (DECIMAL), upp_nominal (DECIMAL), ukt_nominal (DECIMAL), diskon_full_payment (DECIMAL), diskon_alumni (DECIMAL), diskon_pengurus_pii (DECIMAL), diskon_gelombang (DECIMAL), biaya_sertifikasi_pratama (DECIMAL), biaya_sertifikasi_madya (DECIMAL), biaya_sertifikasi_utama (DECIMAL)

RELASI:
- biaya_studi.id_prodi = prodi.id_prodi
- biaya_studi.id_periode = periode_pendaftaran.id_periode

ATURAN SQL:
- HANYA gunakan SELECT.
- Selalu gunakan INNER JOIN jika membutuhkan nama prodi atau detail periode.
- Abaikan filter WHERE untuk parameter yang bernilai kosong (opsional).
- WAJIB sertakan kolom keterangan pendukung di SELECT (seperti kelas, gelombang, atau nama_jalur) agar kamu bisa membedakan konteks dari masing-masing baris harga.
- WAJIB gunakan ILIKE '%...%' (jangan gunakan tanda =) untuk filter WHERE yang berbasis teks (seperti nama_jalur, prodi, atau gelombang) agar pencarian fleksibel dan kebal terhadap perbedaan huruf besar/kecil.
- KAMUS SINGKATAN & SINONIM (WAJIB PATUHI SEBELUM MERAKIT SQL): 
  1. Prodi: PWK/Planologi = 'Perencanaan Wilayah dan Kota', TIP/Agroindustri = 'Teknologi Industri Pertanian', IF/IT/Informatika = 'Teknik Informatika', TI/Industri = 'Teknik Industri', TE/Elektro = 'Teknik Elektro', TK/Kimia = 'Teknik Kimia', PPI/PSPPI = 'Program Profesi Insinyur'.
  2. Biaya: Uang Gedung/Pangkal/Pembangunan = targetkan kolom `upp_nominal`, SPP/Uang Kuliah/Semester = targetkan kolom `ukt_nominal`.
  3. Kelas/Sistem: Kelas Karyawan/Ekstensi/Lanjutan = targetkan kelas 'Weekend' atau sistem 'RPL'. Kelas Pagi = targetkan kelas 'Weekdays'.
- JIKA user bertanya tentang status jadwal "sekarang", "saat ini", atau "hari ini", WAJIB gunakan filter SQL: `CURRENT_DATE BETWEEN tgl_buka AND tgl_tutup` (TIDAK PERLU MENEBAK TANGGAL MANUAL).
"""

# ==========================================
# KATEGORI A: MICRO-TOOLS BIAYA (SUPABASE)
# ==========================================

class CekBiayaRegulerSchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS untuk mencari informasi nominal biaya (UKT, UPP, Formulir) mahasiswa S1 REGULER.
    """
    prodi: str = Field(
        ..., 
        description="WAJIB. Ekstrak nama prodi. JIKA USER TIDAK MENYEBUTKAN PRODI, JANGAN KIRIM SQL. Tanyakan kembali ke user DENGAN menyebutkan daftar prodi ini: Arsitektur, Manajemen, Teknik Kimia, Teknik Mesin, Teknik Sipil, Teknik Elektro, Teknik Industri, Teknik Informatika, PWK, TIP."
    )
    kelas: Optional[str] = Field(
        None,
        description="OPSIONAL. Ekstrak jenis kelas jika ditanyakan (Weekdays / Weekend). Jika tidak disebutkan, biarkan kosong agar SQL menarik kedua opsi."
    )
    sql_query: str = Field(
        ..., 
        description=f"Kueri SQL valid. Filter sistem='Reguler' dari tabel periode_pendaftaran. {DB_SCHEMA_PROMPT}"
    )

class CekBiayaRPLSchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS untuk mencari informasi nominal biaya (Biaya per SKS, UPP, Asesmen) mahasiswa jalur RPL (Rekognisi Pembelajaran Lampau).
    """
    prodi: str = Field(
        ..., 
        description="WAJIB. Ekstrak nama prodi. JIKA USER TIDAK MENYEBUTKAN PRODI, JANGAN KIRIM SQL. Tanyakan kembali ke user DENGAN menyebutkan daftar prodi RPL ini: Arsitektur, Manajemen, Teknik Kimia, Teknik Mesin, Teknik Sipil, Teknik Elektro, Teknik Industri, Teknik Informatika, PWK, TIP."
    )
    estimasi_sks: Optional[int] = Field(
        None,
        description="OPSIONAL. Ekstrak angka SKS jika ditanyakan oleh user. Jika tidak disebutkan, biarkan kosong."
    )
    sql_query: str = Field(
        ..., 
        description=f"Kueri SQL valid. Filter sistem='RPL' dari tabel periode_pendaftaran. {DB_SCHEMA_PROMPT}"
    )

class CekBiayaPSPPISchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS untuk mencari informasi nominal biaya Program Profesi Insinyur (PSPPI).
    """
    prodi: str = Field(
        "Program Profesi Insinyur", 
        description="Otomatis terisi Program Profesi Insinyur."
    )
    status_diskon: Optional[str] = Field(
        None,
        description="OPSIONAL. Ekstrak status pengguna (Umum / Alumni / Pengurus PII). Jika tidak disebut, biarkan kosong."
    )
    sql_query: str = Field(
        ..., 
        description=f"Kueri SQL valid. Filter sistem='PSPPI' dari tabel periode_pendaftaran. {DB_SCHEMA_PROMPT}"
    )

# ==========================================
# KATEGORI B: JADWAL & ANALITIK (SUPABASE)
# ==========================================

class CekJadwalPMBSchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS untuk mencari jadwal, tanggal buka, tutup, atau gelombang PMB.
    """
    sistem_studi: str = Field(
        ..., 
        description="WAJIB. Ekstrak sistem studi (Reguler / RPL / PSPPI). JIKA USER TIDAK MENYEBUTKAN SISTEM STUDI, JANGAN KIRIM SQL. Tanyakan kembali ke user DENGAN menyebutkan 3 opsi ini: Reguler, RPL, atau PSPPI."
    )
    gelombang: Optional[str] = Field(
        None, 
        description="OPSIONAL. Ekstrak nama gelombang (misal: Gelombang 1). Jika kosong, biarkan saja agar SQL menarik seluruh jadwal gelombang yang ada."
    )
    sql_query: str = Field(
        ..., 
        description=f"Kueri SQL valid ke tabel periode_pendaftaran. {DB_SCHEMA_PROMPT}"
    )

class CekAnalitikGlobalSchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS jika pengguna menanyakan komparasi atau analitik agregat lintas prodi/sistem.
    Contoh kasus penggunaan alat ini: 
    - 'Sebutkan 3 prodi dengan UKT paling murah'
    - 'Berapa rata-rata uang pangkal di ITI'
    - 'Prodi apa saja yang menyediakan kelas Weekend'
    """
    sql_query: str = Field(
        ..., 
        description=f"Kueri SQL (PostgreSQL) agregat. {DB_SCHEMA_PROMPT}"
    )

# ==========================================
# KATEGORI C: JARING PENGAMAN (PINECONE)
# ==========================================

class SearchPineconeSchema(BaseModel):
    """
    PILIH ALAT INI KHUSUS untuk mencari informasi kualitatif teks panjang yang tidak ada di tabel database biaya (seperti Visi Misi, Kurikulum, Daftar Dosen, Profil Lulusan, Aturan RPL, Syarat Pendaftaran, Beasiswa, UKM, Fasilitas, Layanan Kampus, dll).
    """
    query: str = Field(
        ..., 
        description="WAJIB. Buat inti kalimat pencarian berdasarkan pertanyaan user (misal: 'Daftar nama dosen pengajar'). JIKA user menyebutkan sistem studi (Reguler / RPL / PSPPI), pastikan kata tersebut dimasukkan ke dalam query ini."
    )
    prodi_terkait: Optional[str] = Field(
        None,
        description="OPSIONAL. JIKA pertanyaan user berkaitan dengan spesifik program studi (seperti daftar dosen, kurikulum, mata kuliah, profil lulusan, atau laboratorium) TETAPI user belum menyebutkan prodinya, JANGAN GUNAKAN ALAT INI DULU! Tanyakan kembali ke user prodi apa yang dimaksud (Sebutkan daftar 11 prodi ITI, termasuk Program Profesi Insinyur / PSPPI). JIKA pertanyaan bersifat umum kampus (seperti sejarah, fasilitas umum, beasiswa, layanan IT/SIAKAD, UKM, layanan disabilitas, atau penelitian), biarkan kosong."
    )