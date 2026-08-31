# app/api/chat.py

from fastapi import APIRouter, Depends, HTTPException, Query, Request
import logging

# Impor "Cetakan Kue" dari Langkah 2
from app.models.chat_schema import ChatRequest, ChatResponse, ChatHistoryResponse

# Impor "Satpam Pintu" dari Langkah 1
from app.core.security import get_current_user_id, limiter

# Impor "Koki Utama" dan "Gudang Memori"
from app.services.agent_service import chat_with_agent
from app.core.memory import get_chat_history

logger = logging.getLogger(__name__)

router = APIRouter()

# ==========================================
# LOKET 1: MENGIRIM PESAN BARU
# ==========================================
from fastapi.responses import StreamingResponse

@router.post("")
@limiter.limit("10/minute")
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    id_lead: str = Depends(get_current_user_id) # Satpam bekerja di sini!
):
    """
    Pintu Depan untuk berinteraksi dengan AI via Streaming SSE.
    """
    # KUNCI KEAMANAN: Paksa session_id menjadi id_lead
    forced_session_id = id_lead
    
    logger.info(f"📨 [API] Request Streaming masuk dari Maba (ID: {id_lead[:8]}...) - Sesi Paksa: {forced_session_id}")
    
    try:
        # Panggil fungsi generator Streaming dari Koki Utama
        return StreamingResponse(
            chat_with_agent(
                session_id=forced_session_id,
                id_lead=id_lead,
                user_input=body.message
            ),
            media_type="text/event-stream"
        )
        
    except Exception as e:
        logger.error(f"❌ [API] Kesalahan fatal di mesin agen: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan pada server saat memproses pesan.")


# ==========================================
# LOKET 2: MEMINTA RIWAYAT MASA LALU
# ==========================================
@router.get("/history", response_model=ChatHistoryResponse)
async def get_history_endpoint(
    limit: int = Query(20, description="Jumlah pesan maksimal (kelipatan genap)"),
    offset: int = Query(0, description="Jumlah pesan yang dilewati (kelipatan genap)"),
    id_lead: str = Depends(get_current_user_id) # Satpam bekerja di sini!
):
    """
    Mengambil riwayat percakapan masa lalu (1-Room Chat) untuk Frontend.
    """
    # KUNCI KEAMANAN: Paksa session_id menjadi id_lead
    forced_session_id = id_lead
    
    logger.info(f"📜 [API] Permintaan riwayat obrolan dari Maba (ID: {id_lead[:8]}...) - Sesi Paksa: {forced_session_id} - Limit: {limit}, Offset: {offset}")
    
    try:
        # Panggil fungsi narik data dari Redis / Supabase
        history = await get_chat_history(forced_session_id, id_lead, limit=limit, offset=offset)
        
        # Cetak riwayat berlembar-lembar itu pakai Cetakan Kue (Tanpa session_id)
        return ChatHistoryResponse(
            history=history
        )
    except Exception as e:
        logger.error(f"❌ [API] Gagal mengambil riwayat: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memuat riwayat obrolan.")