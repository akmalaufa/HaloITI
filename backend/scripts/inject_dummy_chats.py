import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Tambahkan path backend ke sistem
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tools.supabase_tool import engine
from sqlalchemy import text
from app.core.memory import redis_client # Untuk membersihkan cache Redis

async def inject_dummy():
    async with engine.begin() as connection:
        # 1. Cari id_lead dan session_id dari percakapan terakhir
        print("🔍 Mencari sesi percakapan terakhir...")
        result = await connection.execute(text("SELECT id_lead, session_id FROM chat_logs ORDER BY created_at DESC LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("❌ Tidak ada sesi yang ditemukan di database. Chat minimal 1 kali dulu di web.")
            return
            
        id_lead = row[0]
        session_id = row[1]
        
        print(f"🎯 Sesi ditemukan!")
        print(f"   ID Lead: {id_lead}")
        print(f"   Session ID: {session_id}")
        
        # 2. Hapus data dummy lama (kalau ada)
        print("🧹 Membersihkan sisa data dummy lama (jika ada)...")
        await connection.execute(text("DELETE FROM chat_logs WHERE user_query LIKE '[DUMMY]%'"))
        
        # Bersihkan Cache Redis untuk sesi ini supaya history langsung diambil dari Supabase
        redis_key = f"user:{id_lead}:session:{session_id}"
        if redis_client:
            redis_client.delete(redis_key)
            print("🧹 Cache Redis untuk sesi ini telah dihapus.")
        
        # 3. Suntik 100 data
        print("💉 Menyuntikkan 100 data obrolan palsu...")
        # Waktu disetting mundur 2 jam dari sekarang, dan maju 1 menit per pesan
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        
        for i in range(1, 101):
            msg_time = base_time + timedelta(minutes=i)
            
            insert_sql = """
                INSERT INTO chat_logs 
                (id_lead, session_id, user_query, bot_response, routed_to, created_at, prompt_tokens, completion_tokens, response_time_ms)
                VALUES 
                (:id_lead, :session_id, :user_query, :bot_response, 'general', :created_at, 0, 0, 0)
            """
            await connection.execute(text(insert_sql), {
                "id_lead": id_lead,
                "session_id": session_id,
                "user_query": f"[DUMMY] Pertanyaan ke-{i}: Uji coba Infinite Scroll Fase 4",
                "bot_response": f"[DUMMY] Jawaban ke-{i}: Data ini ditarik langsung dari Supabase Database secara mulus menggunakan Virtuoso.",
                "created_at": msg_time
            })
            
        print("✅ SUCCESS! 100 Dummy Chat berhasil dimasukkan ke Supabase.")

if __name__ == "__main__":
    asyncio.run(inject_dummy())
