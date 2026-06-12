/****************************************************
 * GOOGLE FORM: KHẢO SÁT ĐIỂM MẠNH & PHÂN CÔNG TASK
 * DÀNH CHO: TEAM 056 - AI20K BUILD COHORT 2
 ****************************************************/

function createTeamSkillsSurvey() {
  // 1. Tạo Spreadsheet để lưu kết quả
  const ss = SpreadsheetApp.create("Kết quả Khảo sát Năng lực Team 056 - AI20K");
  const sheet = ss.getSheets()[0];
  sheet.setName("Responses");

  // 2. Tạo Form
  const form = FormApp.create("Khảo sát Điểm mạnh & Phân công Task - Team 056");
  
  form.setDescription(
    "Mục đích của form này là để Leader hiểu rõ điểm mạnh, kinh nghiệm và mong muốn học hỏi của từng thành viên trong team.\n\n" +
    "Dựa vào kết quả này, team sẽ 'break' và phân bổ task một cách hợp lý nhất, đảm bảo vừa phát huy thế mạnh, vừa giúp mọi người học thêm kỹ năng mới trong suốt 6 tuần của Cohort 2."
  );
  
  // Liên kết Form với Spreadsheet
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  
  // --- PHẦN 1: THÔNG TIN CƠ BẢN ---
  form.addSectionHeaderItem()
    .setTitle("Phần 1: Thông tin & Định hướng Vai trò");

  form.addTextItem()
    .setTitle("1. Họ và Tên")
    .setRequired(true);
  
  form.addCheckboxItem()
    .setTitle("2. Bạn tự tin hoặc muốn đảm nhận những vai trò cốt lõi nào nhất trong dự án này? (Chọn tối đa 2-3)")
    .setChoiceValues([
      "Frontend Developer (UI/UX, Next.js, React, Tailwind)",
      "Backend Developer (FastAPI, Database, API Design, Security)",
      "AI/Data Engineer (LangGraph, Prompting, RAG, Vector DB)",
      "DevOps Engineer (Docker, CI/CD, Deploy lên Render/Vercel)",
      "Product Owner / Business Analyst (Viết PRD, vẽ flow, nghiên cứu user)",
      "QA / Tester (Viết Unit test, tìm bug, đảm bảo chất lượng)",
      "Scrum Master / PM (Quản lý thẻ việc, đốc thúc tiến độ)"
    ])
    .setRequired(true);

  // --- PHẦN 2: HARD SKILLS ---
  form.addSectionHeaderItem()
    .setTitle("Phần 2: Tự đánh giá Kỹ năng cốt lõi (Hard Skills)")
    .setHelpText("Đánh giá mức độ: 1 = Chưa biết, 2 = Biết cơ bản, 3 = Làm được việc, 4 = Tự tin ít cần hỗ trợ, 5 = Chuyên gia/Có thể gánh team");

  const scaleColumns = [
    "1 (Chưa biết)", 
    "2 (Biết cơ bản)", 
    "3 (Làm được việc)", 
    "4 (Tự tin, ít hỗ trợ)", 
    "5 (Chuyên gia)"
  ];

  form.addGridItem()
    .setTitle("3. Nhóm Kỹ năng FRONTEND & DESIGN")
    .setRows([
      "React / Next.js", 
      "Tailwind CSS / Styling / Animation", 
      "Tích hợp REST API / SSE Streaming vào Frontend", 
      "Thiết kế Figma / Wireframe"
    ])
    .setColumns(scaleColumns)
    .setRequired(true);

  form.addGridItem()
    .setTitle("4. Nhóm Kỹ năng BACKEND & DEVOPS")
    .setRows([
      "Python / FastAPI", 
      "Thiết kế Database (SQL/NoSQL)", 
      "Alembic Migration / Data Warehouse / ETL",
      "Docker / Tự động hoá CI-CD (GitHub Actions)", 
      "Deploy hệ thống (Render, Vercel, AWS...)"
    ])
    .setColumns(scaleColumns)
    .setRequired(true);

  form.addGridItem()
    .setTitle("5. Nhóm Kỹ năng AI & DATA")
    .setRows([
      "Xây dựng AI Agent (LangChain / LangGraph)", 
      "Kỹ thuật RAG & Vector Database (ChromaDB...)", 
      "Prompt Engineering & Tối ưu LLM", 
      "Thu thập, xử lý và làm sạch dữ liệu",
      "Machine Learning / Feature Engineering / Model Evaluation"
    ])
    .setColumns(scaleColumns)
    .setRequired(true);

  // --- PHẦN 3: SOFT SKILLS ---
  form.addSectionHeaderItem()
    .setTitle("Phần 3: Phong cách làm việc & Điểm mạnh mềm (Soft Skills)");

  form.addCheckboxItem()
    .setTitle("6. Trong quá trình code và làm việc nhóm, bạn thấy mình thuộc 'Hệ' nào nhất? (Chọn 1-2)")
    .setChoiceValues([
      "Hệ 'Xung kích' (Executor): Khởi tạo dự án nhanh, code tốc độ cao, ra prototype lẹ.",
      "Hệ 'Kiến trúc sư' (Architect): Thích suy nghĩ kỹ về hệ thống, design pattern, code gọn gàng.",
      "Hệ 'Thợ săn Bug' (Debugger): Giỏi dò lỗi, fix bug tài tình, kiên nhẫn khi hệ thống sập.",
      "Hệ 'Ngoại giao' (Presenter): Trình bày tốt, làm slide đẹp, thuyết trình hay, viết docs mượt.",
      "Hệ 'Ý tưởng' (Innovator): Nhiều sáng kiến tính năng, tư duy UX tốt."
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("7. Khi gặp một bug khó hoặc công nghệ mới chưa từng làm, phản xạ đầu tiên của bạn là:")
    .setChoiceValues([
      "Tự search Google/StackOverflow/đọc Docs đến cùng để hiểu bản chất.",
      "Hỏi thẳng AI (ChatGPT/Claude/Gemini) để xin code mẫu giải quyết nhanh nhất.",
      "Nhờ đồng đội hỗ trợ hoặc pair-programming cùng nhau làm."
    ])
    .setRequired(true);

  // --- PHẦN 4: THỜI GIAN & CAM KẾT ---
  form.addSectionHeaderItem()
    .setTitle("Phần 4: Cam kết & Mong muốn phát triển");

  form.addMultipleChoiceItem()
    .setTitle("8. Bạn có thể dành bao nhiêu thời gian cho dự án mỗi tuần? (Tính cả họp nhóm và tự code)")
    .setChoiceValues([
      "Dưới 10h/tuần",
      "10 - 15h/tuần",
      "15 - 20h/tuần",
      "Trên 20h/tuần (Sẵn sàng cháy hết mình)"
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle("9. Khung giờ bạn thường hoạt động và code năng suất nhất? (Ví dụ: 8h-11h tối, full cuối tuần...)")
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("10. Trong dự án AI20K lần này, bạn đặc biệt muốn HỌC THÊM hoặc CẢI THIỆN kỹ năng gì nhất? (Leader sẽ ưu tiên giao task liên quan)")
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("11. Bạn có góp ý hay lo lắng gì về cách vận hành/giao task của team không?")
    .setRequired(false);

  // --- LOG URLs ---
  Logger.log("=========================================");
  Logger.log("FORM TẠO THÀNH CÔNG!");
  Logger.log("1. Link để gửi cho Team điền: " + form.getPublishedUrl());
  Logger.log("2. Link để bạn sửa Form: " + form.getEditUrl());
  Logger.log("3. Link file Excel kết quả: " + ss.getUrl());
  Logger.log("=========================================");
}
