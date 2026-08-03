import os
from dotenv import load_dotenv

# Membaca isi file .env yang ada di folder root backend
load_dotenv()

class Settings:
    """Konfigurasi utama aplikasi Backend FastAPI."""
    
    # 1. Konfigurasi Agen Gemini
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    
    # 2. Konfigurasi Vector Database (Pinecone)
    PINECONE_API_KEY: str | None = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "pmb-iti-index")
    
    # 3. Konfigurasi Relational Database (Supabase)
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
    SUPABASE_KEY: str | None = os.getenv("SUPABASE_KEY")
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")
    AGENT_DATABASE_URL: str | None = os.getenv("AGENT_DATABASE_URL")
    
    # 4. Konfigurasi Redis (Upstash REST API)
    UPSTASH_REDIS_REST_URL: str | None = os.getenv("UPSTASH_REDIS_REST_URL")
    UPSTASH_REDIS_REST_TOKEN: str | None = os.getenv("UPSTASH_REDIS_REST_TOKEN")

    # 5. Konfigurasi Keamanan (JWT & API Proxy)
    JWT_SECRET: str | None = os.getenv("JWT_SECRET")
    X_API_KEY: str | None = os.getenv("X_API_KEY")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # 5. Konfigurasi Agen (Protokol 3 & Router)
    MAX_REACT_ITERATIONS: int = 5
    FALLBACK_NOT_FOUND_MESSAGE: str = "Waduh Kak, aku lagi muter-muter nyari datanya tapi belum ketemu info yang pasti nih 😅. Biar Kakak nggak nunggu lama dan dapet info yang valid, Kakak bisa langsung hubungi Admin kampus yang relevan ya! ✨"

    @classmethod
    def validate(cls):
        """
        Fungsi Validasi Pre-Flight (Fail-Fast Mechanism).
        Akan dihentikan secara paksa jika ada API Key yang tertinggal.
        """
        missing_keys = []
        if not cls.GEMINI_API_KEY:
            missing_keys.append("GEMINI_API_KEY")
        if not cls.PINECONE_API_KEY:
            missing_keys.append("PINECONE_API_KEY")
        if not cls.SUPABASE_URL:
            missing_keys.append("SUPABASE_URL")
        if not cls.SUPABASE_KEY:
            missing_keys.append("SUPABASE_KEY")
        if not cls.UPSTASH_REDIS_REST_URL:
            missing_keys.append("UPSTASH_REDIS_REST_URL")
        if not cls.UPSTASH_REDIS_REST_TOKEN:
            missing_keys.append("UPSTASH_REDIS_REST_TOKEN")
        if not cls.JWT_SECRET:
            missing_keys.append("JWT_SECRET")
        if not cls.DATABASE_URL:
            missing_keys.append("DATABASE_URL")
        if not cls.AGENT_DATABASE_URL:
            missing_keys.append("AGENT_DATABASE_URL")
        if not cls.X_API_KEY:
            missing_keys.append("X_API_KEY")

        if missing_keys:
            # Memunculkan pesan peringatan keras ke layar terminal (Crash sistem secara sengaja)
            raise ValueError(
                f"🚨 FATAL ERROR: Server ditolak menyala! API Keys berikut belum diatur di file .env: {', '.join(missing_keys)}"
            )

# Menginstansiasi konfigurasi untuk siap dipanggil oleh file lain
settings = Settings()