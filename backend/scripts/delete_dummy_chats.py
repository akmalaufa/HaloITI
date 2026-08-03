import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.tools.supabase_tool import admin_engine
from app.core.memory import redis_client

async def main():
    async with admin_engine.begin() as conn:
        delete_sql = """
            DELETE FROM chat_logs 
            WHERE user_query LIKE 'Pertanyaan dummy ke-%'
        """
        result = await conn.execute(text(delete_sql))
        print(f"Berhasil menghapus {result.rowcount} pesan dummy dari Supabase.")
        
    # Clear cache again
    key = "user:63e206b6-9b8c-4413-b4eb-b4a8284dc9ff:session:00000000-0000-0000-0000-000000000000"
    redis_client.delete(key)
    print(f"Cache Redis untuk user tersebut telah dihapus.")

if __name__ == "__main__":
    asyncio.run(main())
