from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user_id

# Bikin robot tester
client = TestClient(app)

# Trik Sakti: Kita suruh FastAPI buat ngelewatin satpam (Bypass Token) khusus pas lagi dites
def override_get_current_user_id():
    return "user-tes-123"

app.dependency_overrides[get_current_user_id] = override_get_current_user_id

def test_health_check():
    # Robot nembak endpoint /health
    response = client.get("/health")
    
    # PERBAIKAN 1: Sesuaikan dengan kenyataan di main.py ("sehat")
    assert response.status_code == 200
    assert response.json()["status"] == "sehat"

def test_chat_sapaan():
    # Robot ngetes nanya ke chatbot
    payload = {
        "message": "Halo, ini tes otomatis",
        "session_id": "123e4567-e89b-12d3-a456-426614174000"
    }
    # Karena satpam udah di-bypass, robot bisa masuk tanpa token
    response = client.post("/api/chat", json=payload)
    
    # Ekspektasi: Chatbot berhasil jawab (200 OK)
    assert response.status_code == 200
    
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
