import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.memory import redis_client

key = "user:63e206b6-9b8c-4413-b4eb-b4a8284dc9ff:session:00000000-0000-0000-0000-000000000000"
redis_client.delete(key)
print(f"Cache for {key} has been cleared.")
