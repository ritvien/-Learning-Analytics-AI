/****************************************************
 * GOOGLE FORM KHẢO SÁT AI PHÂN TÍCH HỌC TẬP
 * BẢN PRUNED + MỞ RỘNG KHÍA CẠNH TRẢI NGHIỆM
 ****************************************************/

const ROLE_QUESTION_TITLE = "Anh/chị thuộc nhóm đối tượng nào?";
const ROLE_STUDENT = "Sinh viên";
const ROLE_TEACHER = "Giáo viên/Giảng viên môn học";
const ROLE_MANAGER = "Ban quản lý trường/khoa/phòng đào tạo";

const SHEET_STUDENT = "Sinh viên";
const SHEET_TEACHER = "Giáo viên";
const SHEET_MANAGER = "Ban quản lý";

function setupLearningAnalyticsSurveyPruned() {
  deleteOldRoutingTriggers_();

  const ss = SpreadsheetApp.create("Kết quả khảo sát AI Phân tích học tập - bản tối ưu");
  prepareOutputSheets_(ss);

  const form = FormApp.create("Khảo sát nhu cầu hệ thống AI Phân tích học tập");
  form.setDescription(
    "Khảo sát này nhằm tìm hiểu cách sinh viên, giảng viên và ban quản lý hiện đang theo dõi, quản lý và cải thiện quá trình học tập; từ đó xác định điểm nghẽn thực tế và đề xuất hệ thống AI Phân tích học tập phù hợp."
  );
  form.setConfirmationMessage("Cảm ơn anh/chị đã hoàn thành khảo sát!");
  form.setProgressBar(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const roleItem = form.addMultipleChoiceItem()
    .setTitle(ROLE_QUESTION_TITLE)
    .setRequired(true);

  renderQuestions_(form, getCommonQuestions_());

  const studentPage = form.addPageBreakItem()
    .setTitle("A. Câu hỏi dành cho sinh viên")
    .setHelpText("Phần này tập trung vào cách bạn nhận thông tin, tìm tài liệu, tự học, làm bài và theo dõi kết quả học tập.")
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  renderQuestions_(form, getStudentQuestions_());

  const teacherPage = form.addPageBreakItem()
    .setTitle("B. Câu hỏi dành cho giáo viên/giảng viên môn học")
    .setHelpText("Phần này tập trung vào cách thầy/cô quản lý lớp học, tài liệu, deadline, bài tập, phản hồi và phát hiện sinh viên cần hỗ trợ.")
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  renderQuestions_(form, getTeacherQuestions_());

  const managerPage = form.addPageBreakItem()
    .setTitle("C. Câu hỏi dành cho ban quản lý trường/khoa/phòng đào tạo")
    .setHelpText("Phần này tập trung vào dữ liệu học tập, báo cáo, dashboard, cảnh báo sớm và hỗ trợ ra quyết định quản lý đào tạo.")
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  renderQuestions_(form, getManagerQuestions_());

  roleItem.setChoices([
    roleItem.createChoice(ROLE_STUDENT, studentPage),
    roleItem.createChoice(ROLE_TEACHER, teacherPage),
    roleItem.createChoice(ROLE_MANAGER, managerPage)
  ]);

  ScriptApp.newTrigger("routeResponsesByRole")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log("FORM EDIT URL: " + form.getEditUrl());
  Logger.log("FORM PUBLIC URL: " + form.getPublishedUrl());
  Logger.log("SHEET URL: " + ss.getUrl());
}


/****************************************************
 * CÂU HỎI CHUNG
 ****************************************************/

function getCommonQuestions_() {
  return [
    {
      type: "header",
      title: "0. Mức độ sử dụng AI hiện nay"
    },
    {
      type: "multiple_choice",
      title: "0.1. Hiện nay anh/chị có sử dụng AI trong học tập hoặc công việc không?",
      choices: [
        "Chưa từng sử dụng",
        "Đã từng thử nhưng không dùng thường xuyên",
        "Thỉnh thoảng sử dụng",
        "Thường xuyên sử dụng",
        "Sử dụng hằng ngày"
      ]
    },
    {
      type: "checkbox",
      title: "0.2. Anh/chị thường sử dụng công cụ AI nào?",
      choices: [
        "ChatGPT",
        "Gemini",
        "Copilot",
        "Claude",
        "Perplexity",
        "Notion AI",
        "Canva AI",
        "Grammarly/QuillBot",
        "Công cụ AI tích hợp trong hệ thống của trường/cơ quan",
        "Chưa từng sử dụng AI"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "0.3. Anh/chị có sẵn sàng sử dụng hệ thống AI do nhà trường cung cấp để hỗ trợ học tập/giảng dạy/quản lý không?",
      choices: [
        "Có",
        "Không",
        "Chưa chắc"
      ]
    },
    {
      type: "checkbox",
      title: "0.4. Yếu tố nào khiến anh/chị còn băn khoăn khi sử dụng hệ thống AI do nhà trường cung cấp?",
      choices: [
        "Lo ngại thông tin cá nhân/dữ liệu học tập bị sử dụng không phù hợp",
        "Không tin tưởng kết quả do AI đưa ra",
        "Sợ phụ thuộc vào AI",
        "Không biết cách sử dụng",
        "Sợ hệ thống phức tạp, mất thời gian",
        "Lo ngại AI đánh giá sai năng lực người học",
        "Chưa thấy rõ lợi ích thực tế",
        "Không có băn khoăn đáng kể"
      ],
      other: true
    }
  ];
}


/****************************************************
 * NHÁNH SINH VIÊN
 ****************************************************/

function getStudentQuestions_() {
  return [
    {
      type: "header",
      title: "1. Nhận thông tin học tập và deadline"
    },
    {
      type: "checkbox",
      title: "1.1. Bạn thường nhận thông tin học tập, deadline, tài liệu môn học qua kênh nào?",
      choices: [
        "Zalo nhóm lớp",
        "Messenger/Facebook Group",
        "Email",
        "Google Classroom",
        "Moodle/LMS của trường",
        "Microsoft Teams",
        "Google Drive",
        "Website/Portal sinh viên",
        "Thông báo trực tiếp trên lớp",
        "Bạn bè/lớp trưởng nhắc lại"
      ],
      other: true
    },
    {
      type: "grid",
      title: "1.2. Bạn đánh giá các kênh/công cụ hiện tại để nhận thông tin học tập theo các khía cạnh sau như thế nào?",
      rows: [
        "Dễ tìm lại thông tin cũ",
        "Thông báo đến kịp thời",
        "Ít bị trôi thông tin",
        "Biết được việc nào quan trọng/cần làm trước",
        "Dễ theo dõi deadline từng môn",
        "Dễ sử dụng trên điện thoại"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "1.3. Khó khăn lớn nhất khi theo dõi thông báo/deadline của bạn là gì?",
      choices: [
        "Thông báo nằm ở quá nhiều kênh khác nhau",
        "Tin nhắn trong nhóm bị trôi",
        "Không có nhắc lại trước hạn",
        "Nội dung thông báo quá dài/khó hiểu",
        "Không biết thông báo nào quan trọng hơn",
        "Không thường xuyên kiểm tra email/LMS/portal",
        "Phụ thuộc vào bạn bè/lớp trưởng nhắc lại",
        "Do bản thân chưa có thói quen theo dõi",
        "Hiếm khi gặp khó khăn"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "1.4. Nếu có công cụ tốt hơn để quản lý thông tin học tập/deadline, bạn muốn công cụ đó hỗ trợ gì?",
      choices: [
        "Gom tất cả thông báo, tài liệu, deadline vào một nơi",
        "Tự động nhắc deadline trước hạn",
        "Phân loại thông báo theo từng môn học",
        "Ưu tiên hiển thị các việc quan trọng/cần làm ngay",
        "Đồng bộ với lịch cá nhân",
        "Tóm tắt thông báo dài thành nội dung ngắn gọn"
      ],
      other: true
    },

    {
      type: "header",
      title: "2. Tìm kiếm và sử dụng tài liệu học tập"
    },
    {
      type: "checkbox",
      title: "2.1. Khi cần tìm tài liệu học tập, bạn thường sử dụng nguồn/công cụ nào?",
      choices: [
        "Slide/tài liệu giảng viên gửi",
        "Giáo trình/sách giấy",
        "Google Search",
        "YouTube",
        "Google Drive của lớp",
        "Thư viện trường",
        "Website/Portal của trường",
        "ChatGPT",
        "Gemini",
        "Copilot",
        "Tài liệu bạn bè chia sẻ",
        "Nhóm Facebook/Zalo học tập"
      ],
      other: true
    },
    {
      type: "grid",
      title: "2.2. Bạn đánh giá các nguồn/công cụ tìm tài liệu học tập hiện nay theo các khía cạnh sau như thế nào?",
      rows: [
        "Dễ tìm tài liệu phù hợp",
        "Tài liệu đúng trọng tâm môn học",
        "Tài liệu dễ hiểu",
        "Tài liệu đáng tin cậy",
        "Tiết kiệm thời gian tìm kiếm"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "2.3. Khó khăn lớn nhất khi tìm tài liệu học tập là gì?",
      choices: [
        "Có quá nhiều tài liệu, không biết chọn tài liệu nào",
        "Tài liệu khó hiểu",
        "Tài liệu không đúng trọng tâm môn học",
        "Không biết tài liệu có đáng tin cậy không",
        "Tài liệu bị phân tán ở nhiều nơi",
        "Không tìm được tài liệu phù hợp để ôn thi/làm bài",
        "Không có thời gian đọc hết tài liệu",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "2.4. Nếu có công cụ tốt hơn để hỗ trợ tìm tài liệu học tập, bạn muốn công cụ đó làm gì?",
      choices: [
        "Gợi ý tài liệu phù hợp theo từng môn học",
        "Tóm tắt tài liệu dài",
        "Giải thích nội dung khó hiểu",
        "Gợi ý tài liệu theo phần kiến thức đang yếu",
        "Đánh dấu tài liệu quan trọng để ôn thi",
        "Tìm tài liệu theo câu hỏi/vấn đề cụ thể",
        "Sắp xếp tài liệu theo chủ đề"
      ],
      other: true
    },

    {
      type: "header",
      title: "3. Tự học và ôn tập"
    },
    {
      type: "checkbox",
      title: "3.1. Khi không hiểu bài hoặc cần ôn tập, bạn thường làm gì?",
      choices: [
        "Đọc lại slide/tài liệu môn học",
        "Hỏi bạn bè",
        "Hỏi giảng viên",
        "Tìm trên Google",
        "Xem YouTube",
        "Dùng ChatGPT",
        "Dùng Gemini/Copilot",
        "Làm bài tập luyện thêm",
        "Học nhóm",
        "Dùng Quizlet/Anki",
        "Bỏ qua phần chưa hiểu"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "3.2. Khó khăn lớn nhất khi tự học/ôn tập của bạn là gì?",
      choices: [
        "Không biết bắt đầu từ đâu",
        "Không biết phần nào mình đang yếu",
        "Không có tài liệu phù hợp",
        "Không có người giải thích khi không hiểu",
        "Dễ mất tập trung",
        "Không biết học như vậy đã đủ chưa",
        "Không có bài tập tự luyện",
        "Không có cách tự kiểm tra kiến thức"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "3.3. Nếu có công cụ hỗ trợ tự học tốt hơn, bạn muốn tính năng nào?",
      choices: [
        "Chỉ ra phần kiến thức đang yếu",
        "Gợi ý lộ trình ôn tập cá nhân",
        "Tạo câu hỏi luyện tập theo từng chủ đề",
        "Giải thích bài học theo cách dễ hiểu hơn",
        "Tạo flashcard/tóm tắt nhanh",
        "Theo dõi tiến độ ôn tập",
        "Gợi ý thời điểm cần ôn lại",
        "Có chatbot hỏi đáp theo tài liệu môn học"
      ],
      other: true
    },

    {
      type: "header",
      title: "4. Làm bài tập, bài nhóm và bài kiểm tra"
    },
    {
      type: "checkbox",
      title: "4.1. Khi làm bài tập cá nhân/bài nhóm, bạn thường sử dụng công cụ nào?",
      choices: [
        "Word",
        "Google Docs",
        "PowerPoint",
        "Google Slides",
        "Canva",
        "Excel/Google Sheets",
        "Google Drive",
        "Zalo/Messenger nhóm",
        "Notion",
        "Trello",
        "Grammarly",
        "Turnitin",
        "ChatGPT/Gemini/Copilot"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "4.2. Khó khăn thường gặp nhất khi làm bài tập/bài nhóm là gì?",
      choices: [
        "Không hiểu yêu cầu đề bài",
        "Không biết bắt đầu từ đâu",
        "Khó phân chia công việc nhóm",
        "Khó theo dõi tiến độ thành viên",
        "Thiếu tài liệu",
        "Sợ sai/không chắc bài làm đúng",
        "Khó trình bày bài",
        "Không có phản hồi trước khi nộp"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "4.3. Nếu có công cụ tốt hơn để hỗ trợ làm bài tập/bài nhóm, bạn muốn công cụ đó hỗ trợ gì?",
      choices: [
        "Giải thích yêu cầu đề bài",
        "Gợi ý dàn ý/cách làm",
        "Kiểm tra bài trước khi nộp",
        "Gợi ý lỗi cần sửa",
        "Theo dõi tiến độ bài nhóm",
        "Chia việc nhóm",
        "Nhắc hạn nộp bài",
        "Gợi ý tài liệu liên quan"
      ],
      other: true
    },

    {
      type: "header",
      title: "5. Theo dõi điểm số và tiến độ học tập"
    },
    {
      type: "checkbox",
      title: "5.1. Bạn hiện đang theo dõi điểm số, chuyên cần, deadline và tiến độ học tập bằng cách nào?",
      choices: [
        "Portal sinh viên",
        "LMS trường",
        "Google Classroom",
        "Excel/Google Sheets",
        "Máy tính cá nhân",
        "Ghi chú điện thoại",
        "Hỏi lớp trưởng/bạn học",
        "Hỏi giảng viên",
        "Không theo dõi thường xuyên"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "5.2. Bạn có biết môn học nào hiện đang có nguy cơ điểm thấp, trượt môn hoặc cần cải thiện không?",
      choices: [
        "Biết rất rõ",
        "Biết tương đối",
        "Chỉ biết khi có điểm thấp",
        "Không biết rõ",
        "Chưa từng tự theo dõi"
      ]
    },
    {
      type: "grid",
      title: "5.3. Công cụ hiện tại có giúp bạn hiểu rõ tình trạng học tập của bản thân không?",
      rows: [
        "Biết điểm hiện tại của từng môn",
        "Biết điểm cần đạt để qua môn/đạt mục tiêu",
        "Biết môn nào đang có nguy cơ thấp điểm",
        "Biết phần kiến thức/kỹ năng đang yếu",
        "Nhận cảnh báo sớm trước khi kết quả xấu",
        "Nhận gợi ý việc cần làm để cải thiện"
      ],
      columns: [
        "Hoàn toàn không giúp",
        "Ít giúp",
        "Bình thường",
        "Có giúp",
        "Giúp rất rõ"
      ]
    },
    {
      type: "checkbox",
      title: "5.4. Nếu có dashboard học tập cá nhân, bạn muốn xem thông tin gì?",
      choices: [
        "Điểm hiện tại của từng môn",
        "Điểm cần đạt để qua môn/đạt mục tiêu",
        "Môn học có nguy cơ thấp điểm",
        "Số buổi nghỉ/chuyên cần",
        "Deadline chưa hoàn thành",
        "Tiến độ học tập theo từng môn",
        "So sánh kết quả giữa các giai đoạn",
        "Gợi ý việc cần làm để cải thiện điểm"
      ],
      other: true
    },

    {
      type: "paragraph",
      title: "6. Theo bạn, khó khăn lớn nhất trong quá trình học tập hiện nay là gì?"
    }
  ];
}


/****************************************************
 * NHÁNH GIÁO VIÊN
 ****************************************************/

function getTeacherQuestions_() {
  return [
    {
      type: "header",
      title: "1. Cung cấp tài liệu môn học"
    },
    {
      type: "checkbox",
      title: "1.1. Thầy/cô hiện cung cấp tài liệu học tập cho sinh viên qua kênh nào?",
      choices: [
        "Word/PowerPoint",
        "Google Docs/Google Slides",
        "Google Drive",
        "Email",
        "Zalo nhóm lớp",
        "Facebook Group/Messenger",
        "Google Classroom",
        "Moodle/LMS trường",
        "Microsoft Teams",
        "Website/Portal trường",
        "Tài liệu bản giấy"
      ],
      other: true
    },
    {
      type: "grid",
      title: "1.2. Thầy/cô đánh giá các công cụ/kênh đang sử dụng để cung cấp tài liệu học tập theo các khía cạnh sau như thế nào?",
      rows: [
        "Giao diện dễ sử dụng đối với giảng viên",
        "Giao diện dễ sử dụng đối với sinh viên",
        "Tài liệu được đăng tải/cập nhật thuận tiện",
        "Sinh viên nhận được thông báo kịp thời khi có tài liệu mới",
        "Có thể lưu trữ tài liệu theo từng lớp/học phần/học kỳ",
        "Có thể theo dõi sinh viên đã xem/tải tài liệu hay chưa",
        "Có thể tìm lại tài liệu cũ dễ dàng"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "1.3. Trong quá trình cung cấp tài liệu cho sinh viên, thầy/cô thường gặp khó khăn nào?",
      choices: [
        "Sinh viên không biết tài liệu nằm ở đâu",
        "Sinh viên bỏ sót tài liệu mới",
        "Có quá nhiều kênh gửi tài liệu khác nhau",
        "Tài liệu bị trùng phiên bản/cập nhật nhiều lần gây nhầm lẫn",
        "Khó biết sinh viên đã xem/tải tài liệu hay chưa",
        "Khó sắp xếp tài liệu theo từng chương/chủ đề",
        "Mất thời gian gửi lại tài liệu khi sinh viên hỏi",
        "Công cụ hiện tại khó dùng hoặc thao tác chậm",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },

    {
      type: "header",
      title: "2. Thông báo, deadline và lịch cá nhân của giảng viên"
    },
    {
      type: "checkbox",
      title: "2.1. Thầy/cô thường gửi thông báo, deadline, yêu cầu bài tập cho sinh viên qua kênh nào?",
      choices: [
        "Thông báo trực tiếp trên lớp",
        "Zalo nhóm lớp",
        "Messenger/Facebook Group",
        "Email",
        "Google Classroom",
        "Moodle/LMS trường",
        "Microsoft Teams",
        "Google Drive",
        "Cán bộ lớp/lớp trưởng truyền đạt"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "2.2. Thầy/cô có thường gặp tình trạng sinh viên bỏ sót thông báo, quên deadline hoặc hỏi lại thông tin đã gửi không?",
      choices: [
        "Không bao giờ: Gần như không xảy ra trong học kỳ",
        "Hiếm khi: Khoảng 1–2 lần trong học kỳ",
        "Thỉnh thoảng: Khoảng 1–2 lần mỗi tháng",
        "Thường xuyên: Gần như tuần nào cũng có sinh viên hỏi lại/quên deadline",
        "Rất thường xuyên: Xảy ra nhiều lần mỗi tuần hoặc ảnh hưởng rõ đến tiến độ lớp học"
      ]
    },
    {
      type: "grid",
      title: "2.3. Công cụ hiện tại có hỗ trợ thầy/cô quản lý deadline, lịch dạy, lịch họp và công việc cá nhân không?",
      rows: [
        "Tổng hợp deadline đã giao cho tất cả các lớp",
        "Tổng hợp deadline theo từng học phần/môn học",
        "Hiển thị lịch dạy, lịch họp, lịch chấm bài trong cùng một nơi",
        "Phân biệt công việc quan trọng và ít quan trọng",
        "Nhắc việc trước các mốc quan trọng",
        "Cảnh báo khi nhiều deadline/lịch họp/lịch chấm bài bị dồn cùng lúc"
      ],
      columns: [
        "Hoàn toàn không đáp ứng",
        "Ít đáp ứng",
        "Bình thường",
        "Đáp ứng tốt",
        "Đáp ứng rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "2.4. Khi quản lý nhiều lớp/môn cùng lúc, thầy/cô gặp khó khăn nào?",
      choices: [
        "Khó nhớ tất cả deadline đã giao",
        "Khó biết lớp nào còn bài chưa chấm/chưa phản hồi",
        "Khó theo dõi lớp nào có nhiều sinh viên chậm nộp bài",
        "Khó sắp xếp lịch chấm bài, lịch dạy, lịch họp",
        "Khó ưu tiên việc quan trọng trước",
        "Phải theo dõi nhiều file/nhiều nền tảng khác nhau",
        "Thông tin bị phân tán giữa email, Zalo, LMS, Excel",
        "Không có công cụ nhắc việc phù hợp",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },

    {
      type: "header",
      title: "3. Giao bài, thu bài, chấm bài"
    },
    {
      type: "checkbox",
      title: "3.1. Thầy/cô hiện giao bài, thu bài và quản lý tiến độ nộp bài bằng công cụ nào?",
      choices: [
        "Google Classroom",
        "Moodle/LMS trường",
        "Microsoft Teams",
        "Email",
        "Google Drive",
        "Zalo/Messenger",
        "Excel/Google Sheets",
        "Nộp bản giấy",
        "Form khảo sát/quiz"
      ],
      other: true
    },
    {
      type: "grid",
      title: "3.2. Thầy/cô đánh giá công cụ/cách thức giao và thu bài hiện nay theo các khía cạnh sau như thế nào?",
      rows: [
        "Dễ tạo bài tập và giao cho sinh viên",
        "Dễ gắn bài tập với chương/chủ đề của học phần",
        "Dễ theo dõi sinh viên đã nộp/chưa nộp",
        "Dễ phát hiện sinh viên nộp muộn",
        "Dễ quản lý file bài nộp",
        "Dễ chấm điểm và trả kết quả",
        "Dễ phát hiện dạng bài/nội dung sinh viên thường làm sai",
        "Dễ tổng hợp sinh viên đang yếu ở dạng bài/chương/kỹ năng nào"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "3.3. Khó khăn lớn nhất khi giao bài/thu bài/chấm bài là gì?",
      choices: [
        "Khó theo dõi sinh viên chưa nộp bài",
        "Sinh viên nộp bài muộn",
        "File bài nộp bị phân tán",
        "Mất thời gian tổng hợp danh sách nộp bài",
        "Khó theo dõi tiến độ bài nhóm",
        "Khó kiểm tra đạo văn/trùng lặp",
        "Khó phản hồi cho từng sinh viên",
        "Khó biết sinh viên yếu ở phần kiến thức nào",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },
    {
      type: "checkbox",
      title: "3.4. Nếu có hệ thống tốt hơn để hỗ trợ giao bài, thu bài và chấm bài, thầy/cô muốn hệ thống hỗ trợ gì?",
      choices: [
        "Tự động thống kê sinh viên đã/chưa nộp bài",
        "Nhắc sinh viên chưa nộp bài",
        "Cảnh báo bài nộp muộn",
        "Quản lý bài tập theo từng chủ đề/buổi học",
        "Theo dõi tiến độ bài nhóm",
        "Hỗ trợ kiểm tra bài trước khi chấm",
        "Tổng hợp điểm tự động",
        "Phân tích lỗi phổ biến của cả lớp"
      ],
      other: true
    },

    {
      type: "header",
      title: "4. Phát hiện sinh viên gặp khó khăn"
    },
    {
      type: "checkbox",
      title: "4.1. Thầy/cô thường dựa vào dấu hiệu nào để nhận biết sinh viên có nguy cơ học yếu hoặc cần hỗ trợ?",
      choices: [
        "Nghỉ học nhiều",
        "Không nộp bài",
        "Nộp bài muộn",
        "Điểm quiz/bài tập thấp",
        "Điểm giữa kỳ thấp",
        "Ít tương tác trên lớp",
        "Không tham gia làm việc nhóm",
        "Không phản hồi tin nhắn/email",
        "Phản ánh từ lớp trưởng/nhóm trưởng",
        "Chỉ biết khi có điểm cuối kỳ"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "4.2. Thầy/cô thường phát hiện sinh viên gặp khó khăn vào thời điểm nào?",
      choices: [
        "Rất sớm: Trong 1–2 tuần đầu khi sinh viên bắt đầu có dấu hiệu vắng học, ít tương tác hoặc không nộp bài",
        "Khá sớm: Trước bài kiểm tra giữa kỳ, khi vẫn còn nhiều thời gian để hỗ trợ",
        "Trung bình: Sau khi có điểm giữa kỳ hoặc sau một số bài tập lớn",
        "Muộn: Gần cuối học kỳ, khi sinh viên đã khó cải thiện kết quả",
        "Rất muộn: Chỉ phát hiện khi sinh viên trượt môn, nợ môn hoặc kết quả cuối kỳ đã xấu",
        "Chưa có cách phát hiện rõ ràng"
      ]
    },
    {
      type: "checkbox",
      title: "4.3. Nếu có hệ thống cảnh báo sớm, thầy/cô muốn hệ thống cảnh báo dựa trên tiêu chí nào?",
      choices: [
        "Nghỉ học nhiều",
        "Không nộp bài/nộp muộn",
        "Điểm bài tập/quiz thấp",
        "Kết quả giữa kỳ thấp",
        "Mức độ tương tác giảm",
        "Không truy cập tài liệu/LMS",
        "Kết quả giảm so với giai đoạn trước",
        "Kết hợp nhiều dấu hiệu để đánh giá rủi ro"
      ],
      other: true
    },

    {
      type: "header",
      title: "5. Tương tác và chia sẻ với sinh viên"
    },
    {
      type: "grid",
      title: "5.1. Mức độ tương tác, chia sẻ và cởi mở giữa sinh viên với thầy/cô hiện nay như thế nào?",
      rows: [
        "Sinh viên chủ động hỏi khi không hiểu bài",
        "Sinh viên sẵn sàng chia sẻ khó khăn học tập",
        "Sinh viên có kênh liên hệ thuận tiện với thầy/cô",
        "Thầy/cô dễ nhận biết sinh viên đang mất động lực học",
        "Môi trường lớp học tạo cảm giác an toàn để sinh viên đặt câu hỏi",
        "Các sinh viên yếu/ít nói vẫn có cơ hội được phát hiện và hỗ trợ"
      ],
      columns: [
        "Rất thấp",
        "Thấp",
        "Bình thường",
        "Cao",
        "Rất cao"
      ]
    },
    {
      type: "checkbox",
      title: "5.2. Những yếu tố nào khiến sinh viên khó chia sẻ khó khăn với thầy/cô?",
      choices: [
        "Sinh viên ngại bị đánh giá là yếu",
        "Sinh viên sợ ảnh hưởng đến điểm số/hình ảnh cá nhân",
        "Sinh viên không biết liên hệ qua kênh nào",
        "Lớp đông nên thầy/cô khó quan sát từng sinh viên",
        "Sinh viên không chủ động chia sẻ",
        "Thầy/cô thiếu dữ liệu để nhận biết sinh viên đang gặp khó",
        "Không có thời gian trao đổi riêng",
        "Khó phân biệt sinh viên lười học và sinh viên thực sự gặp khó khăn",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },

    {
      type: "header",
      title: "6. Nhu cầu hệ thống AI cho giảng viên"
    },
    {
      type: "checkbox",
      title: "6.1. Nếu có hệ thống AI Phân tích học tập, thầy/cô ưu tiên chức năng nào?",
      choices: [
        "Dashboard tình hình lớp học",
        "Cảnh báo sớm sinh viên có nguy cơ",
        "Tổng hợp deadline/bài tập đã giao",
        "Phân tích phần kiến thức sinh viên đang yếu",
        "Gợi ý tài liệu/bài tập bổ sung",
        "Hỗ trợ phản hồi cá nhân hóa",
        "Tự động tạo báo cáo kết quả lớp học"
      ],
      other: true
    },
    {
      type: "paragraph",
      title: "6.2. Theo thầy/cô, khó khăn lớn nhất hiện nay trong việc theo dõi và hỗ trợ sinh viên là gì?"
    }
  ];
}


/****************************************************
 * NHÁNH BAN QUẢN LÝ
 ****************************************************/

function getManagerQuestions_() {
  return [
    {
      type: "header",
      title: "1. Dữ liệu học tập hiện có"
    },
    {
      type: "checkbox",
      title: "1.1. Hiện nay đơn vị anh/chị đang thu thập dữ liệu học tập từ nguồn nào?",
      choices: [
        "Phòng đào tạo",
        "Portal sinh viên",
        "LMS trường",
        "Google Classroom/Microsoft Teams",
        "File Excel từ giảng viên",
        "Báo cáo từ khoa/bộ môn",
        "Dữ liệu điểm danh",
        "Dữ liệu điểm số",
        "Dữ liệu cố vấn học tập",
        "Khảo sát sinh viên",
        "Chưa có nguồn dữ liệu tập trung"
      ],
      other: true
    },
    {
      type: "grid",
      title: "1.2. Anh/chị đánh giá hệ thống/cách thức thu thập dữ liệu học tập hiện nay theo các khía cạnh sau như thế nào?",
      rows: [
        "Dữ liệu được cập nhật kịp thời",
        "Dữ liệu đầy đủ theo sinh viên/lớp/khoa/ngành/học phần",
        "Dữ liệu có độ tin cậy cao",
        "Dữ liệu dễ tổng hợp thành báo cáo",
        "Dữ liệu có thể kết nối từ nhiều nguồn khác nhau",
        "Dữ liệu đủ chi tiết để phát hiện vấn đề học tập",
        "Dữ liệu đảm bảo bảo mật và phân quyền truy cập"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },
    {
      type: "checkbox",
      title: "1.3. Nếu có hệ thống dữ liệu học tập tốt hơn, anh/chị muốn tích hợp dữ liệu nào?",
      choices: [
        "Điểm số",
        "Chuyên cần",
        "Tình trạng nộp bài",
        "Hoạt động trên LMS",
        "Phản hồi của sinh viên",
        "Kết quả khảo sát học phần",
        "Dữ liệu cố vấn học tập",
        "Tỷ lệ học lại/nợ môn",
        "Tiến độ hoàn thành chương trình",
        "Dữ liệu chuẩn đầu ra"
      ],
      other: true
    },

    {
      type: "header",
      title: "2. Báo cáo và dashboard quản lý"
    },
    {
      type: "checkbox",
      title: "2.1. Hiện nay đơn vị anh/chị tổng hợp báo cáo học tập/chất lượng đào tạo bằng công cụ nào?",
      choices: [
        "Excel",
        "Google Sheets",
        "Word",
        "Google Docs",
        "PowerPoint",
        "Power BI",
        "Tableau",
        "Hệ thống quản lý đào tạo nội bộ",
        "Báo cáo thủ công từ khoa/bộ môn",
        "Tổng hợp qua email"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "2.2. Việc tổng hợp báo cáo hiện nay có mất nhiều thời gian/thao tác thủ công không?",
      choices: [
        "Không mất nhiều thời gian",
        "Ít mất thời gian",
        "Bình thường",
        "Mất nhiều thời gian",
        "Rất mất nhiều thời gian"
      ]
    },
    {
      type: "grid",
      title: "2.3. Anh/chị đánh giá công cụ báo cáo/dashboard hiện nay theo các khía cạnh sau như thế nào?",
      rows: [
        "Dễ sử dụng",
        "Cập nhật số liệu kịp thời",
        "Hiển thị trực quan, dễ hiểu",
        "Có thể lọc theo khoa/ngành/lớp/học phần/học kỳ",
        "Có thể so sánh giữa các kỳ học/năm học",
        "Có thể phát hiện học phần/lớp có vấn đề",
        "Giảm thời gian tổng hợp thủ công"
      ],
      columns: [
        "Rất kém",
        "Kém",
        "Bình thường",
        "Tốt",
        "Rất tốt"
      ]
    },

    {
      type: "header",
      title: "3. Theo dõi chất lượng học phần"
    },
    {
      type: "checkbox",
      title: "3.1. Hiện nay đơn vị theo dõi chất lượng từng học phần dựa trên chỉ số nào?",
      choices: [
        "Điểm trung bình học phần",
        "Tỷ lệ sinh viên trượt",
        "Tỷ lệ sinh viên bỏ học phần",
        "Tỷ lệ sinh viên học lại",
        "Tỷ lệ chuyên cần",
        "Tỷ lệ hoàn thành bài tập",
        "Phản hồi của sinh viên",
        "Đánh giá của giảng viên",
        "Mức độ đạt chuẩn đầu ra",
        "Chưa có chỉ số theo dõi cụ thể"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "3.2. Các chỉ số hiện nay có giúp phát hiện học phần đang là điểm nghẽn trong chương trình đào tạo không?",
      choices: [
        "Không giúp phát hiện",
        "Ít giúp phát hiện",
        "Bình thường",
        "Có giúp phát hiện",
        "Giúp phát hiện rất rõ"
      ]
    },
    {
      type: "checkbox",
      title: "3.3. Nếu có hệ thống phân tích chất lượng học phần, anh/chị muốn hệ thống hỗ trợ gì?",
      choices: [
        "Phát hiện học phần có tỷ lệ trượt cao",
        "Phát hiện học phần có điểm trung bình thấp",
        "So sánh kết quả giữa các lớp",
        "So sánh kết quả giữa các học kỳ",
        "So sánh kết quả giữa các giảng viên phụ trách",
        "Phân tích phản hồi của sinh viên",
        "Gợi ý nguyên nhân học phần có kết quả thấp",
        "Gợi ý hướng cải thiện học phần"
      ],
      other: true
    },

    {
      type: "header",
      title: "4. Cảnh báo sớm sinh viên có nguy cơ"
    },
    {
      type: "checkbox",
      title: "4.1. Hiện nay đơn vị phát hiện sinh viên có nguy cơ học yếu, nợ môn, chậm tiến độ bằng cách nào?",
      choices: [
        "Báo cáo điểm cuối kỳ",
        "Báo cáo giữa kỳ",
        "Thông tin từ giảng viên",
        "Thông tin từ cố vấn học tập",
        "Dữ liệu chuyên cần",
        "Dữ liệu nộp bài",
        "Phản ánh từ lớp/cán bộ lớp",
        "Sinh viên chủ động báo cáo",
        "Chưa có cách phát hiện rõ ràng"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "4.2. Việc phát hiện sinh viên có nguy cơ hiện nay thường diễn ra vào thời điểm nào?",
      choices: [
        "Rất sớm: Trong 1–3 tuần đầu khi sinh viên bắt đầu có dấu hiệu rủi ro",
        "Khá sớm: Trước giữa kỳ, vẫn còn nhiều thời gian can thiệp",
        "Trung bình: Sau khi có điểm giữa kỳ hoặc sau một số bài đánh giá lớn",
        "Muộn: Cuối học kỳ, khi khả năng cải thiện đã hạn chế",
        "Rất muộn: Chỉ phát hiện khi sinh viên đã trượt môn, nợ môn hoặc chậm tiến độ",
        "Chưa có quy trình phát hiện rõ ràng"
      ]
    },
    {
      type: "checkbox",
      title: "4.3. Nếu có hệ thống cảnh báo sớm, anh/chị muốn hệ thống đánh giá rủi ro theo những khía cạnh nào?",
      choices: [
        "Rủi ro do nghỉ học/chuyên cần thấp",
        "Rủi ro do điểm số thấp",
        "Rủi ro do không nộp bài/nộp muộn",
        "Rủi ro do không tương tác với LMS/tài liệu học tập",
        "Rủi ro do GPA giảm so với kỳ trước",
        "Rủi ro do nợ môn/học lại nhiều",
        "Rủi ro do chậm tiến độ chương trình",
        "Rủi ro do phản ánh từ giảng viên/cố vấn học tập",
        "Rủi ro tổng hợp từ nhiều dấu hiệu"
      ],
      other: true
    },

    {
      type: "header",
      title: "5. Nhu cầu AI và ra quyết định quản lý"
    },
    {
      type: "grid",
      title: "5.1. Nếu triển khai hệ thống AI Phân tích học tập, anh/chị đánh giá mức độ quan trọng của các chức năng sau như thế nào?",
      rows: [
        "Dashboard theo dõi chất lượng học tập toàn trường/khoa",
        "Cảnh báo sớm sinh viên có nguy cơ",
        "Phân tích học phần có tỷ lệ trượt cao",
        "Phân tích nguyên nhân sinh viên học yếu",
        "Dự báo số lượng sinh viên cần hỗ trợ",
        "Theo dõi hiệu quả sau can thiệp",
        "Tự động tạo báo cáo định kỳ",
        "Hỗ trợ lãnh đạo ra quyết định cải tiến chương trình đào tạo"
      ],
      columns: [
        "Không quan trọng",
        "Ít quan trọng",
        "Bình thường",
        "Quan trọng",
        "Rất quan trọng"
      ]
    },
    {
      type: "paragraph",
      title: "5.2. Theo anh/chị, khó khăn lớn nhất hiện nay trong theo dõi chất lượng học tập/chất lượng đào tạo là gì?"
    }
  ];
}


/****************************************************
 * HÀM TẠO CÂU HỎI
 ****************************************************/

function renderQuestions_(form, questions) {
  questions.forEach(q => {
    if (q.type === "header") {
      form.addSectionHeaderItem()
        .setTitle(q.title);
    }

    if (q.type === "checkbox") {
      const item = form.addCheckboxItem()
        .setTitle(q.title)
        .setChoiceValues(q.choices)
        .setRequired(true);

      if (q.other === true) {
        item.showOtherOption(true);
      }
    }

    if (q.type === "multiple_choice") {
      form.addMultipleChoiceItem()
        .setTitle(q.title)
        .setChoiceValues(q.choices)
        .setRequired(true);
    }

    if (q.type === "scale") {
      form.addScaleItem()
        .setTitle(q.title)
        .setBounds(1, 5)
        .setLabels(q.low, q.high)
        .setRequired(true);
    }

    if (q.type === "grid") {
      form.addGridItem()
        .setTitle(q.title)
        .setRows(q.rows)
        .setColumns(q.columns)
        .setRequired(true);
    }

    if (q.type === "paragraph") {
      form.addParagraphTextItem()
        .setTitle(q.title)
        .setRequired(false);
    }

    if (q.type === "text") {
      form.addTextItem()
        .setTitle(q.title)
        .setRequired(q.required === true);
    }
  });
}


/****************************************************
 * TỰ ĐỘNG TÁCH RESPONSE THEO 3 NHÓM
 ****************************************************/

function routeResponsesByRole(e) {
  const sourceSheet = e.range.getSheet();
  const ss = sourceSheet.getParent();

  const headers = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const row = e.range.getValues()[0];

  const namedValues = e.namedValues || {};
  const role = namedValues[ROLE_QUESTION_TITLE]
    ? namedValues[ROLE_QUESTION_TITLE][0]
    : "";

  let targetSheetName = "";

  if (role === ROLE_STUDENT) {
    targetSheetName = SHEET_STUDENT;
  } else if (role === ROLE_TEACHER) {
    targetSheetName = SHEET_TEACHER;
  } else if (role === ROLE_MANAGER) {
    targetSheetName = SHEET_MANAGER;
  } else {
    targetSheetName = "Khác";
  }

  const targetSheet = getOrCreateSheet_(ss, targetSheetName);

  if (targetSheet.getLastRow() === 0) {
    targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    targetSheet.setFrozenRows(1);
  }

  targetSheet
    .getRange(targetSheet.getLastRow() + 1, 1, 1, row.length)
    .setValues([row]);
}


/****************************************************
 * HÀM CHUẨN BỊ SHEET ĐẦU RA
 ****************************************************/

function prepareOutputSheets_(ss) {
  const defaultSheet = ss.getSheets()[0];
  defaultSheet.setName("Hướng dẫn");

  defaultSheet.getRange("A1").setValue("File này lưu kết quả khảo sát AI Phân tích học tập.");
  defaultSheet.getRange("A2").setValue("Google Form sẽ tự tạo sheet gốc Form Responses 1.");
  defaultSheet.getRange("A3").setValue("Script sẽ tự động tách response vào 3 sheet: Sinh viên, Giáo viên, Ban quản lý.");

  getOrCreateSheet_(ss, SHEET_STUDENT);
  getOrCreateSheet_(ss, SHEET_TEACHER);
  getOrCreateSheet_(ss, SHEET_MANAGER);
}

function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function deleteOldRoutingTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "routeResponsesByRole") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}