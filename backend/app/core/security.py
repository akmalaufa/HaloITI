import jwt
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter
from slowapi.util import get_remote_address
ALGORITHM = "HS256"
# Waktu kadaluarsa token: 7 hari
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Pos Satpam Rate Limiting Utama
limiter = Limiter(key_func=get_remote_address)
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Mencetak tiket JWT baru berdasarkan data user (seperti id_lead)."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
        
    to_encode.update({"exp": expire})
    
    # Mencetak JWT menggunakan JWT_SECRET
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> Optional[dict]:
    """Mengecek keaslian tiket JWT (Membuka segel). Mengembalikan payload jika valid, None jika palsu/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        print("❌ [JWT] Token sudah kadaluarsa!")
        return None
    except jwt.InvalidTokenError:
        print("❌ [JWT] Token tidak valid atau dipalsukan!")
        return None

# Satpam Pengecek Header untuk dipakai di Route (FastAPI Depends)
security_scheme = HTTPBearer()

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> str:
    """
    Fungsi Satpam yang mencegat request, mengambil token dari Header (Bearer),
    memvalidasi, dan mengembalikan id_lead. Jika gagal, langsung tendang (Error 401).
    """
    token = credentials.credentials
    payload = verify_access_token(token)
    
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tiket otentikasi palsu atau sudah kadaluarsa. Silakan login kembali.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return payload["sub"]