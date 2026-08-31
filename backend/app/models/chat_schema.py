# app/models/chat_schema.py

from pydantic import BaseModel, Field

# ==========================================
# SATPAM INPUT (Menerima Pesan dari Maba)
# ==========================================
class ChatRequest(BaseModel):
    # PENTING (SECURITY): id_lead dan session_id sengaja ditiadakan di sini
    # untuk mencegah celah IDOR (Client-Side Manipulation).
    # Identitas user & sesi akan diekstrak langsung dari token JWT di router.
    
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
    # Metrik performa dan session_id tidak disertakan di sini agar response UI bersih
    # dan mencegah kebocoran struktur database backend ke browser.
    
    reply: str
    status: str = "success"

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatHistoryResponse(BaseModel):
    history: list[ChatMessage]
    status: str = "success"