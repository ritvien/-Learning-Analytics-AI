"""EduInsight AI Agent — Streamlit Demo 1 Prototype.

Tab 1: Real LangGraph Agent chat (connected to PostgreSQL via sql_query_tool).
Tab 2: Academic Tree & KPI (mock data — to be connected in Phase 2).
Tab 3: Eval test cases table.
"""

import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# ── Make backend importable from root ──────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import streamlit as st
import pandas as pd
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

# ── Page config (must be first Streamlit call) ─────────────────────────
st.set_page_config(
    page_title="EduInsight AI Agent - Demo 1",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Premium CSS ────────────────────────────────────────────────────────
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
    
    .sql-code {
        font-family: 'Courier New', Courier, monospace;
        background-color: #1e1e2e;
        color: #f8f8f2;
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid #44475a;
    }
</style>
""", unsafe_allow_html=True)


# ── Agent singleton (cached) ──────────────────────────────────────────
@st.cache_resource
def get_agent():
    """Build the LangGraph agent once and cache across reruns."""
    try:
        from app.agent import create_agent
        return create_agent()
    except Exception as exc:
        st.error(f"Không thể khởi tạo Agent: {exc}")
        return None


agent = get_agent()


# ── SIDEBAR ────────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/fluent/96/000000/artificial-intelligence.png", width=80)
    st.markdown("## EduInsight AI Portal")
    st.caption("Sprint 2 MVP — Demo 1 (Real Agent)")

    st.divider()

    st.markdown("### ⚙️ Cấu hình Tác nhân")
    provider = st.selectbox("LLM Provider", ["OpenAI (Recommended)", "Gemini", "Ollama (Local)"], index=0)
    model = st.selectbox("Core Agent Model", ["gpt-5.4-nano", "gpt-5.4", "gpt-4o"], index=0)
    router_model = st.selectbox("Router Model", ["gpt-5.4-nano", "gpt-4o-mini", "gemini-1.5-flash"], index=0)

    st.divider()

    st.markdown("### 💡 Câu hỏi gợi ý cho Demo 1")
    tcs = [
        "TC1: Top 5 môn có tỷ lệ trượt cao nhất ngành KTPM?",
        "TC2: GPA trung bình khóa K18 ngành KTPM là bao nhiêu?",
        "TC3: So sánh tỷ lệ trượt giữa K17 và K18 ngành CNTT",
        "TC4: Chào bạn, bạn là ai?",
        "TC5: CLO nào đạt thấp nhất ở môn Toán rời rạc?",
    ]
    demo_selected = st.selectbox("Chọn test case:", ["-- Tự nhập câu hỏi --"] + tcs)

    st.divider()
    st.markdown("### 📊 Trạng thái Hệ thống")
    if agent:
        st.success("🟢 LangGraph Agent: Ready")
    else:
        st.error("🔴 LangGraph Agent: Failed to load")
    st.success("🟢 Database: PostgreSQL (Docker :5433)")
    st.info("💡 Tip: Chọn test case ở trên hoặc tự nhập câu hỏi bất kỳ.")


# ── MAIN LAYOUT ────────────────────────────────────────────────────────
st.markdown('<div class="main-header">EduInsight AI Agent Dashboard</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">Phân tích kết quả học tập, chương trình đào tạo & cảnh báo sớm chuẩn đầu ra</div>', unsafe_allow_html=True)

tab_chat, tab_tree, tab_eval = st.tabs(["💬 AI Agent Chat (ReAct)", "🌳 Cây học thuật & KPI", "🧪 Kịch bản Test (Eval)"])


# =====================================================================
# TAB 1: AI AGENT CHAT — REAL LANGGRAPH
# =====================================================================
with tab_chat:
    st.markdown("### 🤖 LangGraph Agent — Live Terminal")

    # Init chat history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Display past messages
    for msg in st.session_state.messages:
        role = msg.get("role", "assistant")
        with st.chat_message(role):
            st.markdown(msg["content"])

    # Determine user query
    current_query = ""
    if demo_selected != "-- Tự nhập câu hỏi --":
        # Strip "TCx: " prefix for cleaner input
        current_query = demo_selected.split(": ", 1)[-1]
        st.info(f"👉 Đang chọn: **{demo_selected}**")

    user_input = st.chat_input("Nhập câu hỏi phân tích học vụ...")

    if user_input:
        current_query = user_input

    if current_query:
        # Add user message to history
        st.session_state.messages.append({"role": "user", "content": current_query})
        with st.chat_message("user"):
            st.markdown(current_query)

        # Run Agent
        with st.chat_message("assistant"):
            if not agent:
                st.error("Agent chưa được khởi tạo. Kiểm tra cấu hình API key.")
            else:
                try:
                    # ── Stream agent execution node-by-node ──────────
                    import asyncio

                    async def process_agent_stream():
                        f_res = ""
                        t_shown = False
                        async for event in agent.astream(
                            {"messages": [HumanMessage(content=current_query)]},
                            stream_mode="updates",
                        ):
                            for node_name, state_update in event.items():

                                # ── Router Node ──────────────────────────
                                if node_name == "router":
                                    ctx = state_update.get("context", {})
                                    intent = ctx.get("intent", "unknown")
                                    label_map = {
                                        "core_agent": "complex → Core Agent",
                                        "fast_response": "simple → Fast Response",
                                    }
                                    with st.status("🧠 **Router Node** phân loại intent...", expanded=True) as s:
                                        st.write(f"🔍 Đầu vào: `\"{current_query}\"`")
                                        st.markdown(f"**Kết quả:** `{label_map.get(intent, intent)}`")
                                        s.update(label="✅ Router: Định tuyến hoàn tất", state="complete")

                                # ── Core Agent Node ──────────────────────
                                elif node_name == "core_agent":
                                    msgs = state_update.get("messages", [])
                                    for m in msgs:
                                        if isinstance(m, AIMessage):
                                            # Check for tool calls
                                            if hasattr(m, "tool_calls") and m.tool_calls:
                                                with st.status("⚙️ **Core Agent** suy luận...", expanded=True) as s:
                                                    st.markdown("**Quyết định:** Gọi `sql_query_tool`")
                                                    for tc in m.tool_calls:
                                                        query_arg = tc.get("args", {}).get("query", "")
                                                        st.code(query_arg, language="sql")
                                                    s.update(label="✅ Core Agent: Đã quyết định gọi tool", state="complete")
                                                    t_shown = True
                                            else:
                                                # Final answer from agent
                                                f_res = m.content

                                # ── Tool Node ────────────────────────────
                                elif node_name == "tools":
                                    msgs = state_update.get("messages", [])
                                    for m in msgs:
                                        if isinstance(m, ToolMessage):
                                            with st.status("💾 **Tool Node:** Thực thi SQL...", expanded=True) as s:
                                                try:
                                                    data = json.loads(m.content)
                                                    st.write(f"📊 Trả về {len(data)} dòng dữ liệu:")
                                                    if data and len(data) <= 20:
                                                        st.dataframe(pd.DataFrame(data), use_container_width=True)
                                                    elif data:
                                                        st.json(data[:10])
                                                        st.caption(f"... (hiển thị 10/{len(data)} dòng)")
                                                except (json.JSONDecodeError, TypeError):
                                                    st.code(m.content[:500])
                                                s.update(label="✅ Tool Node: Thực thi thành công", state="complete")

                                # ── Fast Response Node ───────────────────
                                elif node_name == "fast_response":
                                    msgs = state_update.get("messages", [])
                                    for m in msgs:
                                        if isinstance(m, AIMessage):
                                            f_res = m.content
                        return f_res, t_shown

                    # Execute the async stream
                    final_response, tool_calls_shown = asyncio.run(process_agent_stream())

                    # ── Display final response ───────────────────────
                    if final_response:
                        if tool_calls_shown:
                            with st.status("✨ **Core Agent** tổng hợp câu trả lời...", expanded=False) as s:
                                s.update(label="✅ Hoàn tất luồng ReAct", state="complete")

                        st.markdown("---")
                        st.markdown(final_response)
                        st.session_state.messages.append({"role": "assistant", "content": final_response})
                    else:
                        st.warning("Agent không trả về câu trả lời. Vui lòng thử lại.")

                except Exception as exc:
                    st.error(f"Lỗi khi chạy Agent: {exc}")
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": f"⚠️ Đã xảy ra lỗi: {exc}",
                    })


# =====================================================================
# TAB 2: ACADEMIC TREE & KPI (Mock data — Phase 2 sẽ kết nối DB)
# =====================================================================
with tab_tree:
    st.markdown("### 🌳 Sơ đồ Cây học thuật EPU")
    st.caption("Dữ liệu trực quan phân cấp Khoa và Ngành tại Trường Đại học Điện Lực")

    col1, col2 = st.columns([1.5, 1])

    with col1:
        st.markdown("#### Chọn Khoa / Ngành đào tạo")
        dept_data = [
            ("dept-1", "Khoa Công nghệ Thông tin", ["Công nghệ thông tin"]),
            ("dept-2", "Khoa Điều khiển và Tự động hóa", ["Công nghệ kỹ thuật điều khiển và tự động hoá", "Trí tuệ nhân tạo"]),
            ("dept-3", "Khoa Cơ khí - ô tô và Xây dựng", ["Công nghệ kỹ thuật cơ điện tử", "Công nghệ kỹ thuật cơ khí", "Công nghệ kỹ thuật công trình xây dựng"]),
            ("dept-4", "Khoa Điện tử Viễn thông", ["Công nghệ kỹ thuật điện tử - viễn thông"]),
            ("dept-5", "Khoa Kỹ thuật điện", ["Công nghệ kỹ thuật điện, điện tử"]),
            ("dept-6", "Khoa Kế toán - Tài chính", ["Kiểm toán", "Tài chính – Ngân hàng"]),
            ("dept-7", "Khoa Quản trị Kinh doanh và Du lịch", ["Quản trị kinh doanh"]),
            ("dept-8", "Khoa Quản lý Công nghiệp và Năng lượng", ["Logistics và quản lý chuỗi cung ứng"]),
        ]
        selected_node = st.session_state.get("selected_node", "Công nghệ thông tin")
        for dept_id, dept_name, majors in dept_data:
            with st.expander(f"📁 {dept_name}", expanded=(dept_id in ("dept-1", "dept-2"))):
                for major in majors:
                    if st.button(f"🎓 {major}", key=f"btn-{major}"):
                        st.session_state.selected_node = major
                        st.rerun()

    with col2:
        st.markdown(f"#### 📊 Chỉ số KPI: **{selected_node}**")
        metrics = {
            "Công nghệ thông tin": {"sv": 315, "gpa": 3.14, "fail": 15.2, "courses": 42, "insights": [
                "Cần chú ý hỗ trợ thêm môn Toán đại cương và Lập trình C",
                "Triển khai hoạt động học nhóm hỗ trợ cho các lớp D17CNTT",
            ]},
            "Trí tuệ nhân tạo": {"sv": 48, "gpa": 3.42, "fail": 8.5, "courses": 15, "insights": [
                "GPA trung bình rất cao do điểm tuyển sinh đầu vào vượt trội",
                "Đề xuất tăng cường thêm các seminar thực tế về Machine Learning",
            ]},
            "Công nghệ kỹ thuật điều khiển và tự động hoá": {"sv": 180, "gpa": 2.85, "fail": 17.8, "courses": 35, "insights": [
                "Tỷ lệ trượt môn Kỹ thuật số khá cao, cần bổ sung tài liệu hướng dẫn thí nghiệm",
            ]},
        }
        node_meta = metrics.get(selected_node, {"sv": 120, "gpa": 2.92, "fail": 11.5, "courses": 28, "insights": [
            "Các chỉ số học tập ở mức ổn định.",
            "Cần chuẩn bị tốt cho đợt thực tập tốt nghiệp sắp tới.",
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
        """, unsafe_allow_html=True)

        st.markdown("##### 💡 Phân tích & Đề xuất tự động")
        for ins in node_meta["insights"]:
            st.info(ins)


# =====================================================================
# TAB 3: EVAL TEST CASES
# =====================================================================
with tab_eval:
    st.markdown("### 🧪 Danh sách 5 Kịch bản Kiểm thử cho Gate G2")
    st.caption("Các kịch bản đánh giá chất lượng agent — Sprint 2")

    eval_df = pd.DataFrame([
        {"Kịch bản": "TC1", "Câu hỏi": "Top 5 môn có tỷ lệ trượt cao nhất ngành KTPM?", "Tool": "sql_query_tool", "Tiêu chuẩn": "Trả về đúng 5 môn, đúng tỉ lệ %", "Kết quả": "⏳ Chưa chạy"},
        {"Kịch bản": "TC2", "Câu hỏi": "GPA trung bình khóa K18 ngành KTPM?", "Tool": "sql_query_tool", "Tiêu chuẩn": "GPA chính xác từ DB", "Kết quả": "⏳ Chưa chạy"},
        {"Kịch bản": "TC3", "Câu hỏi": "So sánh tỷ lệ trượt K17 vs K18 ngành CNTT", "Tool": "sql_query_tool", "Tiêu chuẩn": "So sánh 2 khóa chính xác", "Kết quả": "⏳ Chưa chạy"},
        {"Kịch bản": "TC4", "Câu hỏi": "Chào bạn, bạn là ai?", "Tool": "Không (Fast Response)", "Tiêu chuẩn": "Router → fast_response, không gọi DB", "Kết quả": "⏳ Chưa chạy"},
        {"Kịch bản": "TC5", "Câu hỏi": "CLO nào đạt thấp nhất ở môn Toán rời rạc?", "Tool": "sql_query_tool", "Tiêu chuẩn": "Trả về CLO cụ thể với % đạt", "Kết quả": "⏳ Chưa chạy"},
    ])
    st.table(eval_df)
    st.info("ℹ️ Chạy từng test case tại Tab 'AI Agent Chat' để kiểm chứng kết quả thực tế.")
