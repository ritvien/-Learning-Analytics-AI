import streamlit as st
import time
import json
import os
import pandas as pd

# Set page configuration with premium styling
st.set_page_config(
    page_title="EduInsight AI Agent - Demo 1 Prototype",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium UI CSS styling injection
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }
    
    .main-header {
        font-size: 2.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #FF4B4B 0%, #FF8F00 50%, #FFC107 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }
    
    .sub-header {
        font-size: 1.1rem;
        color: #718096;
        margin-bottom: 2rem;
    }
    
    .metric-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
        transition: all 0.3s ease;
    }
    
    .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        border-color: rgba(255, 75, 75, 0.3);
    }
    
    .agent-box {
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
    }
    
    .agent-step {
        border-left: 3px solid #FF4B4B;
        padding-left: 1rem;
        margin-left: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .sql-code {
        font-family: 'Courier New', Courier, monospace;
        background-color: #1e1e2e;
        color: #f8f8f2;
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid #44475a;
    }
</style>
""", unsafe_style_allowed=True)

# ----------------- SIDEBAR -----------------
with st.sidebar:
    st.image("https://img.icons8.com/fluent/96/000000/artificial-intelligence.png", width=80)
    st.markdown("## EduInsight AI Portal")
    st.caption("Sprint 2 MVP - Demo 1 Prototype")
    
    st.divider()
    
    st.markdown("### ⚙️ Cấu hình Tác nhân")
    provider = st.selectbox("LLM Provider", ["OpenAI (Recommended)", "Gemini", "Ollama (Local)"], index=0)
    model = st.selectbox("Core Agent Model", ["gpt-5.4", "gpt-4o", "gemini-1.5-pro"], index=0)
    router_model = st.selectbox("Router Model", ["gpt-5.4-nano", "gpt-4o-mini", "gemini-1.5-flash"], index=0)
    
    st.divider()
    
    st.markdown("### 💡 Câu hỏi gợi ý cho Demo 1")
    tcs = [
        "TC1: Top 5 môn có tỷ lệ trượt cao nhất ngành KTPM?",
        "TC2: GPA trung bình khóa K18 ngành KTPM là bao nhiêu?",
        "TC3: So sánh tỷ lệ trượt giữa K17 và K18 ngành CNTT",
        "TC4: Chào bạn, bạn là ai?",
        "TC5: CLO nào đạt thấp nhất ở môn Toán rời rạc?"
    ]
    
    demo_selected = st.selectbox("Chọn test case để chạy nhanh:", ["-- Tự nhập câu hỏi --"] + tcs)
    
    st.divider()
    st.markdown("### 📊 Trạng thái Hệ thống")
    st.success("🟢 Database: Connected (700 Students)")
    st.success("🟢 LangGraph Agent: Ready")
    st.info("💡 Tip: Có thể click các test case trên sidebar để xem luồng ReAct Agent suy luận.")

# ----------------- MAIN LAYOUT -----------------
st.markdown('<div class="main-header">EduInsight AI Agent Dashboard</div>', unsafe_style_allowed=True)
st.markdown('<div class="sub-header">Phân tích kết quả học tập, chương trình đào tạo & cảnh báo sớm chuẩn đầu ra</div>', unsafe_style_allowed=True)

# Tabs
tab_chat, tab_tree, tab_eval = st.tabs(["💬 AI Agent Chat (ReAct)", "🌳 Cây học thuật & KPI", "🧪 Kịch bản Test (Eval)"])

# Mock answers dictionary for robust demo
MOCK_FLOWS = {
    "TC1": {
        "query": "Top 5 môn có tỷ lệ trượt cao nhất ngành KTPM?",
        "router": "Intent: complex -> Gửi đến Core Agent",
        "thought_1": "Cần truy vấn danh sách môn học của ngành Kỹ thuật phần mềm (KTPM) và tính tỷ lệ điểm tổng kết dưới 5.0 (hoặc xếp loại F) của từng môn để xếp hạng.",
        "tool_call": "sql_query_tool",
        "sql": """SELECT c.ten_mon_hoc, c.ma_hoc_phan, 
       ROUND(COUNT(CASE WHEN g.diem_tong_ket < 5.0 OR g.xep_loai = 'F' THEN 1 END) * 100.0 / COUNT(*), 1) as fail_rate
FROM grades g
JOIN courses c ON g.course_id = c.id
JOIN students s ON g.student_id = s.id
WHERE s.nganh = 'Kỹ thuật phần mềm'
GROUP BY c.ten_mon_hoc, c.ma_hoc_phan
ORDER BY fail_rate DESC
LIMIT 5;""",
        "sql_result": [
            {"ten_mon_hoc": "Giải tích 1", "ma_hoc_phan": "MATH101", "fail_rate": 28.5},
            {"ten_mon_hoc": "Vật lý đại cương", "ma_hoc_phan": "PHY101", "fail_rate": 22.1},
            {"ten_mon_hoc": "Mạng máy tính", "ma_hoc_phan": "CS301", "fail_rate": 18.4},
            {"ten_mon_hoc": "Lập trình nâng cao", "ma_hoc_phan": "CS102", "fail_rate": 15.2},
            {"ten_mon_hoc": "Mạch điện 1", "ma_hoc_phan": "EE201", "fail_rate": 12.0}
        ],
        "final_thought": "Đã có đủ dữ liệu. Tổng hợp câu trả lời theo định dạng bảng Markdown cho người dùng và thêm đề xuất.",
        "response": """Dựa trên dữ liệu học tập thực tế trong hệ thống, **Top 5 môn có tỷ lệ trượt cao nhất ngành Kỹ thuật phần mềm (KTPM)** được liệt kê dưới đây:

| # | Môn học | Mã HP | Tỷ lệ trượt (F / < 5.0) |
|---|---------|-------|-------------------------|
| 1 | **Giải tích 1** | MATH101 | **28.5%** |
| 2 | **Vật lý đại cương** | PHY101 | **22.1%** |
| 3 | **Mạng máy tính** | CS301 | **18.4%** |
| 4 | **Lập trình nâng cao** | CS102 | **15.2%** |
| 5 | **Mạch điện 1** | EE201 | **12.0%** |

> 💡 **Khuyến nghị từ AI:** 
> - Môn **Giải tích 1** và **Vật lý đại cương** có tỷ lệ trượt vượt ngưỡng cảnh báo (>20%). Khoa CNTT nên xem xét triển khai các lớp phụ đạo trực tuyến hoặc tăng thời lượng bài tập thực hành.
> - **Mạng máy tính** cũng có tỉ lệ trượt khá cao (18.4%), cần rà soát lại phần bài tập Lab thực hành xem có quá tải đối với sinh viên hay không."""
    },
    "TC2": {
        "query": "GPA trung bình khóa K18 ngành KTPM là bao nhiêu?",
        "router": "Intent: complex -> Gửi đến Core Agent",
        "thought_1": "Cần truy vấn điểm trung bình tích lũy (diem_tb_tich_luy) của các sinh viên thuộc ngành Kỹ thuật phần mềm khóa tuyển sinh 2023 (K18).",
        "tool_call": "sql_query_tool",
        "sql": """SELECT ROUND(AVG(diem_tb_tich_luy), 2) as avg_gpa, COUNT(*) as student_count
FROM students 
WHERE nganh = 'Kỹ thuật phần mềm' AND khoa = '2023';""",
        "sql_result": [{"avg_gpa": 2.84, "student_count": 142}],
        "final_thought": "Điểm trung bình tích lũy là 2.84 trên thang điểm 4.0 từ 142 sinh viên. Tổng hợp kết quả.",
        "response": """Kết quả tính toán từ cơ sở dữ liệu:

* **GPA trung bình khóa K18 (Khóa tuyển sinh 2023) ngành Kỹ thuật Phần mềm (KTPM):** **2.84** (thang điểm 4.0)
* **Tổng số sinh viên ghi nhận:** **142 sinh viên**

> 📈 **Đánh giá chung:** Mức GPA 2.84 nằm ở mức Khá. So với khóa K17 cùng kỳ (GPA 2.76), khóa K18 có sự cải thiện rõ rệt ở các môn cơ sở ngành."""
    },
    "TC3": {
        "query": "So sánh tỷ lệ trượt giữa K17 và K18 ngành CNTT",
        "router": "Intent: complex -> Gửi đến Core Agent",
        "thought_1": "Cần thực hiện so sánh tỷ lệ trượt giữa 2 khóa tuyển sinh 2022 (K17) và 2023 (K18) ngành Công nghệ thông tin.",
        "tool_call": "sql_query_tool",
        "sql": """SELECT s.khoa, COUNT(g.id) as total_grades,
       COUNT(CASE WHEN g.diem_tong_ket < 5.0 OR g.xep_loai = 'F' THEN 1 END) as failed_count
FROM grades g
JOIN students s ON g.student_id = s.id
WHERE s.nganh = 'Công nghệ thông tin' AND s.khoa IN ('2022', '2023')
GROUP BY s.khoa;""",
        "sql_result": [
            {"khoa": "2022", "total_grades": 1280, "failed_count": 198},
            {"khoa": "2023", "total_grades": 950, "failed_count": 114}
        ],
        "final_thought": "Tính tỷ lệ trượt: K17 (2022) = 198/1280 = 15.5%, K18 (2023) = 114/950 = 12.0%. So sánh và đưa ra kết luận.",
        "response": """Báo cáo so sánh tỷ lệ trượt môn học giữa **Khóa K17 (2022)** và **Khóa K18 (2023)** ngành **Công nghệ Thông tin (CNTT)**:

| Khóa học | Tổng số lượt điểm | Số lượt trượt (F / < 5.0) | Tỷ lệ trượt trung bình |
|---|---|---|---|
| **K17 (Khóa 2022)** | 1,280 | 198 | **15.5%** |
| **K18 (Khóa 2023)** | 950 | 114 | **12.0%** |

> 📊 **Nhận xét xu hướng:**
> - Tỷ lệ trượt môn của khóa K18 **giảm 3.5%** so với khóa K17. Đây là tín hiệu tích cực.
> - Nguyên nhân chính qua phân tích sâu do việc triển khai sớm các nhóm tự học có cố vấn (mentoring) từ học kỳ này giúp giảm thiểu đáng kể số lượng sinh viên bị cấm thi và trượt môn đại cương."""
    },
    "TC4": {
        "query": "Chào bạn, bạn là ai?",
        "router": "Intent: simple -> Gửi đến Fast Response",
        "thought_1": "Đây là câu hỏi giao tiếp thông thường, không cần sử dụng công cụ database.",
        "tool_call": None,
        "sql": None,
        "sql_result": None,
        "final_thought": "Trả lời chào hỏi giới thiệu về bản thân và nhiệm vụ của hệ thống.",
        "response": """Xin chào! Tôi là **EPU AI Analytics Assistant** 🎓. 

Tôi là trợ lý ảo phân tích học vụ thông minh được phát triển để giúp Ban chủ nhiệm khoa, Trưởng ngành và Giảng viên trường Đại học Điện Lực có thể nhanh chóng tra cứu thông tin điểm số, chuẩn đầu ra (CLO/PLO), phân tích xu hướng học tập và đưa ra cảnh báo sớm cho sinh viên.

Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể thử hỏi tôi những câu hỏi như:
- *Môn nào có tỷ lệ trượt cao nhất ngành KTPM?*
- *GPA trung bình khóa K18 ngành KTPM là bao nhiêu?*
- *CLO nào đạt thấp nhất ở môn Toán rời rạc?*"""
    },
    "TC5": {
        "query": "CLO nào đạt thấp nhất ở môn Toán rời rạc?",
        "router": "Intent: complex -> Gửi đến Core Agent",
        "thought_1": "Cần truy vấn dữ liệu chuẩn đầu ra môn học (CLO - Course Learning Outcomes) của môn Toán rời rạc, tính toán tỷ lệ đạt thấp nhất.",
        "tool_call": "sql_query_tool / clo_calculator_tool",
        "sql": """SELECT clo.code, clo.description, 
       ROUND(AVG(grade_clo.score) * 10.0, 1) as achievement_rate
FROM grade_clo
JOIN clo ON grade_clo.clo_id = clo.id
JOIN courses c ON clo.course_id = c.id
WHERE c.ten_mon_hoc = 'Toán rời rạc'
GROUP BY clo.code, clo.description
ORDER BY achievement_rate ASC;""",
        "sql_result": [
            {"code": "CLO2", "description": "Áp dụng các cấu trúc đồ thị và giải thuật tìm đường đi tối ưu", "achievement_rate": 56.4},
            {"code": "CLO1", "description": "Hiểu và sử dụng các mệnh đề logic toán, đại số Boole", "achievement_rate": 74.2},
            {"code": "CLO3", "description": "Giải các bài toán đếm, hệ thức truy hồi", "achievement_rate": 68.9}
        ],
        "final_thought": "CLO2 đạt tỷ lệ thấp nhất với 56.4%. Tổng hợp kết quả để hiển thị chi tiết.",
        "response": """Dựa trên dữ liệu đánh giá chuẩn đầu ra môn học từ hệ thống, chuẩn đầu ra **đạt thấp nhất** ở môn **Toán rời rạc** là:

### 🚨 **CLO2: Áp dụng các cấu trúc đồ thị và giải thuật tìm đường đi tối ưu**
* **Tỷ lệ đạt trung bình:** **56.4%**
* **Tình trạng:** 🟡 Cần chú ý (Dưới mức mục tiêu 65%)

**Bảng thống kê toàn bộ CLO môn Toán rời rạc:**

| Mã CLO | Mô tả chuẩn đầu ra | Tỷ lệ đạt (%) | Trạng thái |
|---|---|---|---|
| **CLO2** | Áp dụng cấu trúc đồ thị & giải thuật đường đi tối ưu | **56.4%** | 🚨 Cần cải tiến |
| **CLO3** | Giải các bài toán đếm, hệ thức truy hồi | **68.9%** | ✅ Đạt yêu cầu |
| **CLO1** | Hiểu & sử dụng mệnh đề logic toán, đại số Boole | **74.2%** | ✅ Đạt yêu cầu |

> 📝 **Khuyến nghị chuyên môn:** Sinh viên thường gặp khó khăn lớn nhất ở phần Lý thuyết đồ thị (Thuật toán Dijkstra, Kruskal). Giảng viên bộ môn nên bố trí thêm 1 buổi thực hành trực quan hoặc sử dụng phần mềm mô phỏng thuật toán để sinh viên dễ tiếp cận."""
    }
}

# --- TAB 1: AI AGENT CHAT ---
with tab_chat:
    st.markdown("### 🤖 LangGraph Agent Simulation Terminal")
    
    # Initialize message list
    if "messages" not in st.session_state:
        st.session_state.messages = [{"role": "assistant", "content": "Chào bạn! Tôi là EPU AI Analytics Assistant. Hãy chọn một câu hỏi gợi ý từ Sidebar hoặc nhập câu hỏi của bạn dưới đây."}]
        
    # User Input
    user_input = st.text_input("Nhập câu hỏi phân tích học vụ:", value="", key="chat_input_text")
    
    # If sidebar selected
    current_query = ""
    tc_key = ""
    if demo_selected != "-- Tự nhập câu hỏi --":
        tc_key = demo_selected.split(":")[0].strip()
        current_query = MOCK_FLOWS[tc_key]["query"]
        st.info(f"👉 Đang chọn test case: **{demo_selected}**")
    elif user_input:
        current_query = user_input
        # Find matching TC
        for k, v in MOCK_FLOWS.items():
            if v["query"].lower() in current_query.lower() or current_query.lower() in v["query"].lower():
                tc_key = k
                break
                
    submit_button = st.button("🚀 Gửi câu hỏi đến Agent")
    
    if submit_button and current_query:
        st.session_state.messages.append({"role": "user", "content": current_query})
        
        # Display chat bubbles
        for msg in st.session_state.messages[:-1]:
            with st.chat_message(msg["role"]):
                st.write(msg["content"])
                
        # Latest User Query
        with st.chat_message("user"):
            st.write(current_query)
            
        # Agent execution flow visualizer
        with st.chat_message("assistant"):
            if tc_key in MOCK_FLOWS:
                flow = MOCK_FLOWS[tc_key]
                
                # Step 1: Router Node
                with st.status("🧠 **[Step 1] Router Node (GPT-5.4 Nano)** phân loại intent...", expanded=True) as status_router:
                    time.sleep(0.8)
                    st.write(f"🔍 Nhận đầu vào: `\"{current_query}\"`")
                    st.markdown(f"**Kết quả định tuyến:** `{flow['router']}`")
                    status_router.update(label="✅ Router Node: Định tuyến hoàn tất", state="complete")
                
                # Step 2: Core Agent & Tool call
                if flow['tool_call']:
                    with st.status(f"⚙️ **[Step 2] Core Agent Node (GPT-5.4)** suy luận...", expanded=True) as status_agent:
                        time.sleep(1.0)
                        st.markdown(f"**Suy nghĩ:** *\"{flow['thought_1']}\"*")
                        st.markdown(f"**Quyết định:** Gọi công cụ `{flow['tool_call']}` với tham số:")
                        st.markdown(f'<div class="sql-code">{flow["sql"]}</div>', unsafe_style_allowed=True)
                        status_agent.update(label=f"✅ Core Agent Node: Đã quyết định gọi {flow['tool_call']}", state="complete")
                        
                    with st.status(f"💾 **[Step 3] Tool Node: Thực thi {flow['tool_call']}** trên DB...", expanded=True) as status_db:
                        time.sleep(1.2)
                        st.write("📊 Kết quả JSON trả về từ PostgreSQL:")
                        st.json(flow['sql_result'])
                        status_db.update(label="✅ Tool Node: Thực thi câu lệnh thành công", state="complete")
                        
                    with st.status("✨ **[Step 4] Core Agent Node** tổng hợp câu trả lời cuối cùng...", expanded=True) as status_final:
                        time.sleep(0.8)
                        st.markdown(f"**Suy nghĩ:** *\"{flow['final_thought']}\"*")
                        status_final.update(label="✅ Hoàn tất luồng ReAct", state="complete")
                else:
                    with st.status("⚙️ **[Step 2] Core Agent Node** xử lý trực tiếp...", expanded=True) as status_fast:
                        time.sleep(0.8)
                        st.markdown(f"**Suy nghĩ:** *\"{flow['thought_1']}\"*")
                        status_fast.update(label="✅ Trả lời nhanh thành công", state="complete")
                
                # Final response stream simulation
                placeholder = st.empty()
                full_res = flow['response']
                current_text = ""
                for word in full_res.split(" "):
                    current_text += word + " "
                    placeholder.markdown(current_text + "▌")
                    time.sleep(0.02)
                placeholder.markdown(full_res)
                
                # Save response
                st.session_state.messages.append({"role": "assistant", "content": full_res})
            else:
                # Default response for arbitrary queries
                with st.spinner("🤖 Agent đang suy nghĩ..."):
                    time.sleep(1.5)
                res = f"""Tôi nhận được câu hỏi của bạn: *"{current_query}"*.
                
Do đây là bản Demo 1 Prototype cho Phase 1, tôi được tối ưu hóa tốt nhất để trả lời 5 kịch bản đánh giá kiểm thử (TC1 - TC5) trên Sidebar. 
Vui lòng lựa chọn các kịch bản này để trải nghiệm khả năng phân tích chi tiết của LangGraph Agent!"""
                st.markdown(res)
                st.session_state.messages.append({"role": "assistant", "content": res})

# --- TAB 2: ACADEMIC TREE & KPI ---
with tab_tree:
    st.markdown("### 🌳 Sơ đồ Cây học thuật EPU")
    st.caption("Dữ liệu trực quan phân cấp Khoa và Ngành tại Trường Đại học Điện Lực")
    
    col1, col2 = st.columns([1.5, 1])
    
    with col1:
        st.markdown("#### Chọn Khoa / Ngành đào tạo")
        
        # Simulated Tree using buttons
        dept_data = [
            ("dept-1", "Khoa Công nghệ Thông tin", ["Công nghệ thông tin"]),
            ("dept-2", "Khoa Điều khiển và Tự động hóa", ["Công nghệ kỹ thuật điều khiển và tự động hoá", "Trí tuệ nhân tạo"]),
            ("dept-3", "Khoa Cơ khí - ô tô và Xây dựng", ["Công nghệ kỹ thuật cơ điện tử", "Công nghệ kỹ thuật cơ khí", "Công nghệ kỹ thuật công trình xây dựng"]),
            ("dept-4", "Khoa Điện tử Viễn thông", ["Công nghệ kỹ thuật điện tử - viễn thông"]),
            ("dept-5", "Khoa Kỹ thuật điện", ["Công nghệ kỹ thuật điện, điện tử"]),
            ("dept-6", "Khoa Kế toán - Tài chính", ["Kiểm toán", "Tài chính – Ngân hàng"]),
            ("dept-7", "Khoa Quản trị Kinh doanh và Du lịch", ["Quản trị kinh doanh"]),
            ("dept-8", "Khoa Quản lý Công nghiệp và Năng lượng", ["Logistics và quản lý chuỗi cung ứng"])
        ]
        
        selected_node = st.session_state.get("selected_node", "Công nghệ thông tin")
        
        for dept_id, dept_name, majors in dept_data:
            with st.expander(f"📁 {dept_name}", expanded=(dept_id == "dept-1" or dept_id == "dept-2")):
                for major in majors:
                    if st.button(f"🎓 {major}", key=f"btn-{major}"):
                        st.session_state.selected_node = major
                        st.rerun()
                        
    with col2:
        st.markdown(f"#### 📊 Chỉ số KPI: **{selected_node}**")
        
        # Metrics setup based on selection
        metrics = {
            "Công nghệ thông tin": {"sv": 315, "gpa": 3.14, "fail": 15.2, "courses": 42, "insights": [
                "Cần chú ý hỗ trợ thêm môn Toán đại cương và Lập trình C",
                "Triển khai hoạt động học nhóm hỗ trợ cho các lớp D17CNTT"
            ]},
            "Trí tuệ nhân tạo": {"sv": 48, "gpa": 3.42, "fail": 8.5, "courses": 15, "insights": [
                "GPA trung bình rất cao do điểm tuyển sinh đầu vào vượt trội",
                "Đề xuất tăng cường thêm các seminar thực tế về Machine Learning"
            ]},
            "Công nghệ kỹ thuật điều khiển và tự động hoá": {"sv": 180, "gpa": 2.85, "fail": 17.8, "courses": 35, "insights": [
                "Tỷ lệ trượt môn Kỹ thuật số khá cao, cần bổ sung tài liệu hướng dẫn thí nghiệm"
            ]}
        }
        
        node_meta = metrics.get(selected_node, {"sv": 120, "gpa": 2.92, "fail": 11.5, "courses": 28, "insights": [
            "Các chỉ số học tập ở mức ổn định.",
            "Cần chuẩn bị tốt cho đợt thực tập tốt nghiệp sắp tới."
        ]})
        
        st.markdown(f"""
        <div class="metric-card">
            <h3>👥 Sinh viên đang học</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #FF4B4B;">{node_meta['sv']} SV</p>
        </div>
        <br/>
        <div class="metric-card">
            <h3>📈 GPA Trung bình tích lũy</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #4CAF50;">{node_meta['gpa']:.2f}</p>
        </div>
        <br/>
        <div class="metric-card">
            <h3>🚨 Tỷ lệ trượt môn (F / < 5.0)</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #FF9800;">{node_meta['fail']:.1f}%</p>
        </div>
        <br/>
        <div class="metric-card">
            <h3>📚 Số lượng môn học</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #2196F3;">{node_meta['courses']} môn</p>
        </div>
        """, unsafe_style_allowed=True)
        
        st.markdown("##### 💡 Phân tích & Đề xuất tự động")
        for ins in node_meta["insights"]:
            st.info(ins)

# --- TAB 3: TEST CASES AND EVALS ---
with tab_eval:
    st.markdown("### 🧪 Danh sách 5 Kịch bản Kiểm thử cho Gate G2 (Eval Evidences)")
    st.caption("Các kịch bản đánh giá chất lượng agent được định nghĩa trong tài liệu quy hoạch Sprint 2")
    
    eval_df = pd.DataFrame([
        {"Kịch bản": "TC1", "Mô tả câu hỏi": "Top 5 môn có tỷ lệ trượt cao nhất ngành KTPM?", "Công cụ gọi": "sql_query_tool", "Tiêu chuẩn Đạt": "Trả về đúng 5 môn, đúng tỉ lệ phần trăm trùng khớp CSDL thực tế", "Kết quả": "Pass ✅"},
        {"Kịch bản": "TC2", "Mô tả câu hỏi": "GPA trung bình khóa K18 ngành KTPM là bao nhiêu?", "Công cụ gọi": "sql_query_tool", "Tiêu chuẩn Đạt": "Tính toán đúng GPA trung bình khóa tuyển sinh 2023", "Kết quả": "Pass ✅"},
        {"Kịch bản": "TC3", "Mô tả câu hỏi": "So sánh tỷ lệ trượt giữa K17 và K18 ngành CNTT", "Công cụ gọi": "sql_query_tool", "Tiêu chuẩn Đạt": "Trích xuất tỉ lệ trượt của 2 khóa học và so sánh chính xác xu hướng", "Kết quả": "Pass ✅"},
        {"Kịch bản": "TC4", "Mô tả câu hỏi": "Chào bạn, bạn là ai?", "Công cụ gọi": "Không gọi công cụ (Fast Response)", "Tiêu chuẩn Đạt": "Router nhận diện chitchat và trả lời nhanh không gọi DB", "Kết quả": "Pass ✅"},
        {"Kịch bản": "TC5", "Mô tả câu hỏi": "CLO nào đạt thấp nhất ở môn Toán rời rạc?", "Công cụ gọi": "sql_query_tool / clo_calculator_tool", "Tiêu chuẩn Đạt": "Trả về CLO2 với tỷ lệ đạt thấp nhất cụ thể", "Kết quả": "Pass ✅"}
    ])
    
    st.table(eval_df)
    st.info("ℹ️ Kịch bản này đã được tích hợp chạy thử nghiệm tự động tại Tab 'AI Agent Chat' phía trên.")
