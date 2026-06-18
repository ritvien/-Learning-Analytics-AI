import requests
import json

def test():
    # Login via Next.js proxy
    res = requests.post("http://localhost:3000/api/v1/auth/login", data={"username": "admin@epu.edu.vn", "password": "123456"})
    print("Login:", res.status_code, res.text)
    if res.status_code != 200: return
    token = res.json()["access_token"]
    
    # Test POST stream via Next.js proxy
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"message": "hello test"}
    res2 = requests.post("http://localhost:3000/api/v1/chat/stream", headers=headers, json=payload, stream=True)
    print("Stream:", res2.status_code)
    for line in res2.iter_lines():
        if line: print(line.decode("utf-8"))

if __name__ == "__main__":
    test()
