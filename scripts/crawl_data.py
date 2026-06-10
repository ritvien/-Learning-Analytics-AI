"""Crawl EPU grades module."""

import json
import sys
from typing import Any

import requests
import urllib3
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def crawl_epu_grades(token: str) -> dict[str, Any] | None:
    """Crawl grades for a student using their token."""
    url = f"https://sinhvien.epu.edu.vn/XemDiem.aspx?k={token}"
    try:
        response = requests.get(url, verify=False, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"  -> Lỗi kết nối: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    student_info = {}
    title_group = soup.find('div', class_='title-group')
    if title_group:
        parts = list(title_group.stripped_strings)
        if len(parts) >= 2:
            student_info['Họ và tên'] = parts[1]

    ma_sv_div = soup.find('div', class_='ma-sinhvien')
    if ma_sv_div:
        student_info['MSSV'] = ma_sv_div.text.replace('MSSV:', '').strip()
        
    group_right = soup.find('div', class_='group-right')
    if group_right:
        tds = group_right.find_all('td')
        for td in tds:
            text = td.get_text(strip=True)
            if ':' in text:
                key, val = text.split(':', 1)
                if key.strip() and val.strip():
                    student_info[key.strip()] = val.strip()

    grades = []
    current_semester = None
    table = soup.find('table', class_='tblKetQuaHocTap')
    
    if table:
        rows = table.find_all('tr')
        for row in rows:
            if 'quater' in row.get('class', []):
                current_semester = row.text.strip()
                continue
            if 'markRow' in row.get('class', []):
                cols = row.find_all('td')
                if len(cols) >= 15:
                    grades.append({
                        'Học kỳ': current_semester,
                        'STT': cols[0].text.strip(),
                        'Tên môn học': cols[1].text.strip(),
                        'Mã lớp': cols[2].text.strip(),
                        'TC': cols[3].text.strip(),
                        'TX1': cols[4].text.strip(),
                        'TX2': cols[5].text.strip(),
                        'TX3': cols[6].text.strip(),
                        'TX4': cols[7].text.strip(),
                        'TB Thường kỳ': cols[8].text.strip(),
                        'Kết thúc L1': cols[10].text.strip(),
                        'Kết thúc L2': cols[11].text.strip(),
                        'Điểm tổng kết': cols[12].text.strip(),
                        'Xếp loại': cols[13].text.strip(),
                        'Ghi chú': cols[14].text.strip()
                    })

    return {
        'token': token,
        'student_info': student_info,
        'total_courses': len(grades),
        'grades': grades
    }

def main(html_file: str, output_file: str = 'epu_data.json') -> None:
    """Parse HTML file for tokens and crawl their data."""
    print(f"Đang đọc file: {html_file}")
    try:
        with open(html_file, encoding='utf-8') as f:
            html_content = f.read()
    except Exception as e:
        print(f"Lỗi khi đọc file: {e}")
        return

    soup = BeautifulSoup(html_content, 'html.parser')
    links = soup.find_all('a')
    
    tokens = []
    seen = set()
    for link in links:
        href = link.get('href', '')
        if 'XemDiem.aspx?k=' in href:
            token = href.split('k=')[1]
            if token not in seen:
                seen.add(token)
                tokens.append(token)
                
    print(f"Đã tìm thấy {len(tokens)} sinh viên hợp lệ.")
    if not tokens:
        return

    all_data = []
    for idx, token in enumerate(tokens, 1):
        progress = f"[{idx:02}/{len(tokens):02}]"
        print(f"{progress} Đang cào dữ liệu sinh viên có token {token[:8]}...", end="", flush=True)
        data = crawl_epu_grades(token)
        if data:
            mssv = data.get('student_info', {}).get('MSSV', 'Unknown')
            name = data.get('student_info', {}).get('Họ và tên', 'Unknown')
            print(f" OK! ({mssv} - {name} - {data['total_courses']} môn)")
            all_data.append(data)
            
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
        
    print("-" * 50)
    print(f"Thành công! Đã crawl xong {len(all_data)} sinh viên và lưu tại {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Cách sử dụng: python crawl_data.py <đường_dẫn_file_html>")
        sys.exit(1)
    
    html_file = sys.argv[1]
    main(html_file)
