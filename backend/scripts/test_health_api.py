import asyncio
import sys
import os

# Ensure backend is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

def test_health_apis():
    client = TestClient(app)
    
    print("Testing GET /api/v1/analytics/health/course/1")
    response = client.get("/api/v1/analytics/health/course/1")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}\n")

    print("Testing GET /api/v1/analytics/health/program/1")
    response = client.get("/api/v1/analytics/health/program/1")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}\n")

    print("Testing GET /api/v1/analytics/health/department/1")
    response = client.get("/api/v1/analytics/health/department/1")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}\n")

if __name__ == "__main__":
    test_health_apis()
