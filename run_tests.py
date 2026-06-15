import urllib.request
import json

test_cases = [
    "Top 5 môn có tỷ lệ trượt cao nhất ngành Công nghệ thông tin?",
    "GPA trung bình khóa K21 ngành Công nghệ thông tin là bao nhiêu?",
    "So sánh tỷ lệ trượt môn Cơ sở dữ liệu của K21 và K22?",
    "Chào bạn, chức năng chính của bạn là gì?",
    "CLO nào đạt thấp nhất ở môn Tiếng Anh 1?",
    "Khóa K21 ngành Công nghệ thông tin có bao nhiêu sinh viên?",
    "Liệt kê 3 sinh viên có GPA tích lũy cao nhất ngành Trí tuệ nhân tạo.",
    "Tỷ lệ qua môn (pass) của môn Hệ quản trị cơ sở dữ liệu là bao nhiêu?",
    "Điểm trung bình môn Toán cao cấp 1 của khóa K22 có thấp hơn K21 không?",
    "Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?"
]

results = []
url = "http://localhost:8000/api/v1/chat"
headers = {"Content-Type": "application/json"}

for i, tc in enumerate(test_cases, 1):
    req = urllib.request.Request(url, data=json.dumps({"message": tc}).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            print(f"TC{i} done: {data.get('intent', 'Unknown')}")
            results.append({
                "tc": f"TC{i}",
                "input": tc,
                "response": data.get("response", ""),
                "intent": data.get("intent", ""),
                "status": "Pass"
            })
    except Exception as e:
        print(f"TC{i} failed: {e}")
        results.append({
            "tc": f"TC{i}",
            "input": tc,
            "response": str(e),
            "intent": "Error",
            "status": "Fail"
        })

with open("docs/12-Evaluation/results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Saved results to docs/12-Evaluation/results.json")
