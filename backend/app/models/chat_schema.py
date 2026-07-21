# app/models/chat_schema.py

from pydantic import BaseModel, Field
from uuid import UUID

# ==========================================
# SATPAM INPUT (Menerima Pesan dari Maba)
# ==========================================
class ChatRequest(BaseModel):
    # PENTING (SECURITY): id_lead sengaja ditiadakan di sini untuk mencegah celah IDOR.
    # Identitas user akan diekstrak langsung dari token JWT di router.
    
    session_id: UUID = Field(
        ..., 
        description="ID unik untuk memisahkan sesi percakapan di Redis"
    )
    
    message: str = Field(
        ..., 
        min_length=1, 
        max_length=400, # Batas standar industri (Anti-Token Flooding)
        description="Pesan teks dari pengguna. Kosong dilarang, lebih dari 1000 huruf ditolak."
    )

# ==========================================
# SATPAM OUTPUT (Mengirim Balasan ke Maba)
# ==========================================
class ChatResponse(BaseModel):
    # Metrik performa tidak disertakan di sini agar response UI bersih
    
    session_id: UUID
    reply: str
    status: str = "success"

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatHistoryResponse(BaseModel):
    session_id: UUID
    history: list[ChatMessage]
    status: str = "success"