# Menggunakan Python versi 3.11 Slim yang ringan
FROM python:3.11-slim

# Mencegah Python menulis file .pyc (sampah cache) dan memastikan output terminal real-time
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Tentukan direktori kerja di dalam container (ibarat kita masuk ke folder /app)
WORKDIR /app

# 1. Kertas Belanjaan: Copy daftar dependensi
COPY requirements.txt .

# 2. Belanja: Install dependensi (termasuk gcc jika dibutuhkan oleh beberapa library, lalu dihapus lagi biar hemat memori)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    pip install --no-cache-dir -r requirements.txt && \
    python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords')" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. Pindahin Kodingan: Copy seluruh kodingan backend lu ke dalam mesin Docker
COPY . .

# 4. Buka Pintu Warung: Expose port internal FastAPI (Uvicorn)
EXPOSE 8000

# 5. Nyalain Kompor: Perintah pamungkas untuk menjalankan FastAPI
# Karena kodingan lu ada di app/main.py, maka perintahnya adalah app.main:app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
