import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def check_schema():
    print("Mencoba koneksi ke database Supabase...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.connect() as conn:
        print("[SUCCESS] Terkoneksi!")
        
        # Cek daftar tabel yang ada
        print("\n--- DAFTAR TABEL DI DATABASE ---")
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        tables = [row[0] for row in result.fetchall()]
        
        for table in tables:
            print(f"[TABLE] {table}")
            
            # Kalau nemu tabel knowledge, kita cek detail kolomnya
            if "knowledge" in table:
                print(f"   Mengintip struktur kolom tabel {table}:")
                col_result = await conn.execute(text(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}'
                """))
                for col in col_result.fetchall():
                    print(f"   - {col[0]} ({col[1]})")
                print("   -------------------------")

if __name__ == "__main__":
    asyncio.run(check_schema())
