import json
import datetime
import subprocess
import os

tz = datetime.timezone(datetime.timedelta(hours=7))
repo = 'C2-App-056'
branch = 'hoang'
commit_hash = 'dce8af8'
student = 'viethoangbale11@gmail.com'
model = 'gemini'

prompts = [
    'TC4: Xin lỗi thầy/cô, hiện tại tôi không truy vấn được các view thống kê trong CSDL... Nếu thầy/cô xác nhận “tính theo bảng gốc”, tôi sẽ chạy ngay truy vấn...',
    'Vậy sửa lại 10 test casé cho tôi, tôi làm dev, phát triền phầm mềm này, không khải thầy cô',
    'Dưới đây là kết quả report của 10 test cases trên... Hãy phân tich kết quả, lỗi, problem và đề xuất để cải thiện',
    'được rồi, giờ hãy commit và push lên branch hoang trên repo, nhớ đảm bảo đầy đủ hook ai-logs',
    'tại sao lại : [antigravity-log] No new prompts (any repo, window=24h). [ai-log] No logs to submit. Hãy log thủ công các prompt, dựa vào mẫu @[c:\\Users\\Admin\\Work\\AI In Action\\C2-App-056\\.ai-log\\archive\\2026-06-11.jsonl] và các cuộc trò chuyện trong project cho tới hiện tại'
]

os.makedirs('.ai-log', exist_ok=True)
with open('.ai-log/session.jsonl', 'a', encoding='utf-8') as f:
    for i, p in enumerate(prompts):
        now = datetime.datetime.now(tz)
        ts = now.isoformat()
        entry_id = f'antigravity-{now.strftime("%Y%m%d-%H%M%S")}-{i}'
        entry = {
            'ts': ts,
            'tool': 'antigravity',
            'event': 'TaskComplete',
            'entry_id': entry_id,
            'model': model,
            'repo': repo,
            'branch': branch,
            'commit': commit_hash,
            'student': student,
            'prompt': p,
            'response_summary': f'[Antigravity] {p[:100]}...'
        }
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
