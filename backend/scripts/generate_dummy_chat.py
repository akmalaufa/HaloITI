import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

# Menambahkan root project ke sys.path supaya bisa import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tools.supabase_tool import admin_engine

async def main():
    session_id = "00000000-0000-0000-0000-000000000000"
    
    async with admin_engine.begin() as conn:
        # Get one valid id_lead
        result = await conn.execute(text("SELECT id_lead FROM leads LIMIT 1"))
        row = result.fetchone()
        
        if not row:
            print("Tidak ada data user di tabel leads. Silakan login dulu 1x.")
            return
            
        id_lead = str(row[0])
        print(f"Menggunakan id_lead: {id_lead}")
        
        # Insert 50 pairs
        base_time = datetime.now(timezone.utc) - timedelta(days=10) # 10 days ago
        
        for i in range(1, 51):
            user_query = f"Pertanyaan dummy ke-{i} dari user untuk ngetest Virtuoso dan Pagination limit=20."
            bot_response = f"Ini adalah jawaban panjang dari bot untuk pertanyaan ke-{i}. \n\nSistem menguji Infinite Scroll dan Reverse Pagination DOM Virtualization menggunakan react-virtuoso dan firstItemIndex."
            
            created_at = base_time + timedelta(minutes=i*10)
            
            insert_sql = """
                INSERT INTO chat_logs 
                (id_lead, session_id, user_query, bot_response, routed_to, prompt_tokens, completion_tokens, response_time_ms, created_at)
                VALUES 
                (CAST(:id_lead AS uuid), CAST(:session_id AS uuid), :user_query, :bot_response, 'general', 0, 0, 100, :created_at)
            """
            await conn.execute(text(insert_sql), {
                "id_lead": id_lead,
                "session_id": session_id,
                "user_query": user_query,
                "bot_response": bot_response,
                "created_at": created_at
            })
            
        print("Berhasil memasukkan 100 pesan dummy (50 pasang) ke Supabase!")

if __name__ == "__main__":
    asyncio.run(main())
