from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import chat
from app.api import leads
from app.api import admin
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.security import limiter

# 1. MENGAKTIFKAN SATPAM KEAMANAN
# Baris ini akan otomatis mengecek file .env lu. Kalau kunci kurang, server gagal nyala.
settings.validate()

# 2. INISIALISASI MESIN FASTAPI
# Standar Industri: Matikan /docs jika berada di Production
is_prod = settings.ENVIRONMENT.lower() == "production"

app = FastAPI(
    title="PMB ITI Agentic RAG Backend",
    description="Server utama untuk melayani Chatbot PMB berbasis Gemini dan Pinecone",
    version="1.0.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json"
)

# 2.5 INISIALISASI POS SATPAM (RATE LIMITING)
# 2.5 INISIALISASI POS SATPAM (RATE LIMITING)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# 3. MEMBUKA PINTU TOL (CORS)
# Ini wajib supaya Frontend (Next.js) yang alamatnya beda, diizinkan ngobrol sama server ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Harus spesifik jika allow_credentials=True
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"], # Mengizinkan semua metode umum
    allow_headers=["*"], # Izinkan semua header termasuk Authorization
)

# 4. RUTE ANTI-TIDUR (Health Check)
# Rute ini murni dipakai untuk ditembak oleh Cron-Job.org supaya server Render lu melek 24 jam
@app.get("/health")
async def health_check():
    return {
        "status": "sehat",
        "message": "Server PMB ITI berjalan lancar dan siap menerima chat!"
    }

# (Nanti rute utama buat chat dengan agen Gemini akan kita tambahkan di bawah sini)
# 5. MEMASUKKAN MEJA RESEPSIONIS KE DALAM GEDUNG (PEKERJAAN 5)
app.include_router(chat.router, prefix="/api/chat", tags=["Agent Chat"])

# 6. PENDAFTARAN MABA (LEAD GENERATION)
app.include_router(leads.router, prefix="/api/leads", tags=["Lead Generation"])

# 7. JALUR VIP KHUSUS ADMIN (CRUD DATABASE)
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Dashboard"])