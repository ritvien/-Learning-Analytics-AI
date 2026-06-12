/****************************************************
 * GOOGLE FORM KHẢO SÁT AI PHÂN TÍCH HỌC TẬP
 * BẢN MỚI: TẬP TRUNG GIẢNG VIÊN VÀ BAN QUẢN LÝ
 ****************************************************/

const ROLE_QUESTION_TITLE = "Thầy/cô/Anh/chị thuộc nhóm đối tượng nào?";
const ROLE_TEACHER = "Giảng viên/Trưởng bộ môn";
const ROLE_MANAGER = "Ban quản lý (Trưởng khoa/Phòng Đào tạo/Phòng Đảm bảo chất lượng)";

const SHEET_TEACHER = "Giảng viên";
const SHEET_MANAGER = "Ban quản lý";

function setupLearningAnalyticsSurveyPruned() {
  deleteOldRoutingTriggers_();

  const ss = SpreadsheetApp.create("Kết quả khảo sát AI Phân tích học tập - Giảng viên & Quản lý");
  prepareOutputSheets_(ss);

  const form = FormApp.create("Khảo sát nhu cầu hệ thống AI Phân tích học tập (Dành cho Giảng viên & Ban Quản lý)");
  form.setDescription(
    "Khảo sát này nhằm tìm hiểu cách giảng viên và ban quản lý hiện đang theo dõi kết quả học tập, đánh giá mức đạt chuẩn đầu ra (ABET/AUN) và cải tiến chương trình đào tạo; từ đó xác định điểm nghẽn và đề xuất hệ thống AI Phân tích học tập phù hợp."
  );
  form.setConfirmationMessage("Cảm ơn thầy/cô/anh/chị đã hoàn thành khảo sát!");
  form.setProgressBar(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const roleItem = form.addMultipleChoiceItem()
    .setTitle(ROLE_QUESTION_TITLE)
    .setRequired(true);

  renderQuestions_(form, getCommonQuestions_());

  const teacherPage = form.addPageBreakItem()
    .setTitle("A. Câu hỏi dành cho Giảng viên")
    .setHelpText("Phần này tập trung vào cách thầy/cô theo dõi kết quả, phân tích môn học, đánh giá chuẩn đầu ra và đề xuất cải tiến chương trình.")
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  renderQuestions_(form, getTeacherQuestions_());

  const managerPage = form.addPageBreakItem()
    .setTitle("B. Câu hỏi dành cho Ban quản lý/Khoa/Phòng")
    .setHelpText("Phần này tập trung vào việc tổng hợp dữ liệu, phân tích hiệu quả chương trình đào tạo qua các khóa, và hỗ trợ ra quyết định cải tiến/kiểm định.")
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  renderQuestions_(form, getManagerQuestions_());

  roleItem.setChoices([
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
      type: "multiple_choice",
      title: "0.1. Vai trò cụ thể hiện tại của thầy/cô/anh/chị là gì?",
      choices: [
        "Giảng viên bộ môn",
        "Trưởng/Phó Bộ môn",
        "Trưởng/Phó Khoa",
        "Chuyên viên/Lãnh đạo Phòng Đào tạo",
        "Chuyên viên/Lãnh đạo Phòng Đảm bảo chất lượng/Kiểm định"
      ]
    },
    {
      type: "multiple_choice",
      title: "0.2. Số năm kinh nghiệm tham gia giảng dạy/quản lý đào tạo?",
      choices: [
        "Dưới 3 năm",
        "3 - 5 năm",
        "5 - 10 năm",
        "Trên 10 năm"
      ]
    },
    {
      type: "multiple_choice",
      title: "0.3. Mức độ sử dụng các công cụ AI (ChatGPT, Gemini, Copilot...) trong công việc hiện nay?",
      choices: [
        "Chưa từng sử dụng",
        "Thỉnh thoảng dùng cho các việc đơn giản",
        "Thường xuyên sử dụng để hỗ trợ soạn bài/lập báo cáo",
        "Sử dụng hàng ngày, là công cụ không thể thiếu"
      ]
    },
    {
      type: "checkbox",
      title: "0.4. Đơn vị hiện có thể cung cấp những dữ liệu nào theo từng học kỳ?",
      choices: [
        "Danh sách sinh viên và chương trình/khóa học",
        "Danh sách môn và số tín chỉ",
        "Đăng ký lớp học phần của từng sinh viên",
        "Điểm thành phần có thời điểm ghi nhận",
        "Điểm tổng kết và trạng thái pass/trượt",
        "Dữ liệu CLO/PLO",
        "Chưa rõ hoặc cần xin từ nhiều đơn vị"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "0.5. Nếu hệ thống dự đoán xác suất pass/trượt từng môn và tổng tín chỉ pass/trượt kỳ vọng, mức độ hữu ích là?",
      choices: [
        "Rất hữu ích — có thể dùng để ưu tiên hỗ trợ sớm",
        "Khá hữu ích — cần kèm giải thích và nguồn dữ liệu",
        "Bình thường — chỉ dùng để tham khảo",
        "Không hữu ích hoặc không phù hợp"
      ]
    }
  ];
}


/****************************************************
 * NHÁNH GIẢNG VIÊN
 ****************************************************/

function getTeacherQuestions_() {
  return [
    {
      type: "header",
      title: "1. Theo dõi kết quả học tập môn phụ trách"
    },
    {
      type: "checkbox",
      title: "1.1. Hiện nay thầy/cô theo dõi kết quả học tập của SV trong lớp mình bằng cách nào?",
      choices: [
        "Xem trên hệ thống Phòng Đào Tạo",
        "Lưu trữ file Excel cá nhân",
        "Dựa vào trí nhớ/Đánh giá chủ quan",
        "Xem trên LMS/Google Classroom",
        "Chỉ xem khi cần gửi báo cáo điểm",
        "Xin dữ liệu từ giáo vụ/phòng đào tạo khi cần"
      ],
      other: true
    },
    {
      type: "grid",
      title: "1.2. Đánh giá mức độ thuận tiện của công cụ hiện tại khi thực hiện các việc sau:",
      rows: [
        "Xem tỷ lệ đạt/trượt của môn học",
        "So sánh kết quả giữa các lớp đang dạy",
        "So sánh kết quả môn học qua các học kỳ khác nhau",
        "Xác định sớm những sinh viên có nguy cơ trượt/điểm thấp",
        "Phân tích kết quả theo từng phần nội dung/chương của môn học"
      ],
      columns: [
        "Không thể",
        "Rất khó",
        "Bình thường",
        "Dễ",
        "Rất dễ"
      ]
    },
    {
      type: "checkbox",
      title: "1.3. Khó khăn lớn nhất khi theo dõi kết quả học tập của SV là gì?",
      choices: [
        "Dữ liệu phân tán ở nhiều hệ thống khác nhau",
        "Phải tự tổng hợp thủ công bằng Excel mất nhiều thời gian",
        "Hệ thống chỉ có điểm tổng kết, không có dữ liệu chi tiết theo từng bài kiểm tra/chủ đề",
        "Không có sẵn công cụ để so sánh qua các học kỳ/khóa",
        "Khó biết sinh viên nào đang yếu cho đến khi đã có điểm thi",
        "Mất thời gian xin dữ liệu từ giáo vụ/phòng đào tạo"
      ],
      other: true
    },
    {
      type: "paragraph",
      title: "1.4. Nếu có một hệ thống tự động phân tích dữ liệu lớp học, thầy/cô muốn nhìn thấy thông tin gì đầu tiên khi mở hệ thống lên?"
    },

    {
      type: "header",
      title: "2. Phân tích môn khó & chủ đề sinh viên hay sai"
    },
    {
      type: "checkbox",
      title: "2.1. Thầy/cô thường làm cách nào để biết sinh viên yếu ở nội dung/chương nào nhất?",
      choices: [
        "Phân tích phổ điểm từng câu hỏi trong đề thi",
        "Quan sát sinh viên làm bài/trả lời trên lớp",
        "Dựa vào kinh nghiệm giảng dạy nhiều năm",
        "Dựa vào bài tập lớn/đồ án của sinh viên",
        "Hiện tại chưa có cách đo lường chính xác, chủ yếu dựa vào điểm tổng"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "2.2. Việc xác định các \"điểm mù kiến thức\" của sinh viên hiện nay phụ thuộc vào điều gì?",
      choices: [
        "Kinh nghiệm và trực giác của giảng viên (Vấn đề con người)",
        "Dữ liệu bài thi/điểm số có sẵn (Vấn đề dữ liệu)",
        "Công cụ hỗ trợ phân tích trên LMS/hệ thống thi (Vấn đề kỹ thuật)",
        "Không xác định được"
      ]
    },
    {
      type: "checkbox",
      title: "2.3. Đề cương (Syllabus) môn học của thầy/cô hiện đang được quản lý như thế nào?",
      choices: [
        "Lưu file Word/PDF cá nhân, gửi khi được yêu cầu",
        "Upload lên hệ thống LMS/cổng thông tin nội bộ",
        "Theo mẫu chuẩn của khoa/trường, nộp đầu học kỳ",
        "Không có mẫu chuẩn, mỗi giảng viên tự biên soạn khác nhau"
      ],
      other: true
    },

    {
      type: "header",
      title: "3. Đánh giá mức đạt chuẩn đầu ra (CLO) & Kiểm định"
    },
    {
      type: "checkbox",
      title: "3.1. Thầy/cô thực hiện việc đánh giá mức đạt Chuẩn đầu ra môn học (CLO) như thế nào?",
      choices: [
        "Map điểm các bài kiểm tra/câu hỏi thi vào từng CLO bằng Excel",
        "Sử dụng phần mềm nội bộ của nhà trường",
        "Chỉ điền form/báo cáo chung chung khi được yêu cầu",
        "Nhờ giáo vụ tổng hợp giúp",
        "Chưa từng thực hiện đánh giá CLO"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "3.2. Việc tính toán và minh chứng mức đạt CLO phục vụ kiểm định (ABET/AUN/MOET...) tốn khoảng bao nhiêu thời gian mỗi học kỳ?",
      choices: [
        "Dưới 2 giờ",
        "Từ 2 - 5 giờ",
        "Từ 5 - 10 giờ",
        "Hơn 10 giờ",
        "Không đo lường được / Không trực tiếp làm"
      ]
    },

    {
      type: "header",
      title: "4. Phân tích hiệu quả CTĐT & đề xuất thay đổi"
    },
    {
      type: "checkbox",
      title: "4.1. Thầy/cô có tham gia vào quá trình rà soát/cải tiến Chương trình đào tạo (CTĐT) của ngành mình không?",
      choices: [
        "Có, thường xuyên (thành viên ban kiến tạo/hội đồng khoa)",
        "Có, nhưng hiếm khi (chỉ đóng góp ý kiến khi được hỏi)",
        "Chỉ cập nhật đề cương môn mình dạy khi có yêu cầu",
        "Chưa từng tham gia"
      ]
    },
    {
      type: "checkbox",
      title: "4.2. Khi rà soát/cải tiến nội dung môn học hoặc CTĐT, thầy/cô thường dựa vào thông tin nào?",
      choices: [
        "Kinh nghiệm giảng dạy cá nhân",
        "Phản hồi trực tiếp từ sinh viên",
        "Dữ liệu tỷ lệ trượt/điểm thấp của các môn",
        "Thông tin/Yêu cầu từ doanh nghiệp và thị trường",
        "Yêu cầu từ các tổ chức kiểm định (ABET/AUN...)",
        "So sánh với CTĐT của trường khác",
        "Không có dữ liệu cụ thể, chủ yếu dựa vào cảm tính"
      ],
      other: true
    },
    {
      type: "grid",
      title: "4.3. Đánh giá mức độ thuận tiện khi phân tích hiệu quả CTĐT hiện tại:",
      rows: [
        "So sánh kết quả học tập của SV qua các khóa (VD: K17 vs K18 vs K19)",
        "Đánh giá xem một môn tiên quyết có thực sự hỗ trợ môn sau không",
        "Xác định môn học nào nên thêm/bỏ/chuyển vị trí trong kỳ học",
        "Phân tích xu hướng kết quả học tập theo thời gian",
        "Đánh giá mức độ đạt chuẩn đầu ra (PLO) của toàn chương trình"
      ],
      columns: [
        "Không thể",
        "Rất khó",
        "Bình thường",
        "Dễ",
        "Rất dễ"
      ]
    },
    {
      type: "paragraph",
      title: "4.4. Theo thầy/cô, chương trình đào tạo ngành mình hiện đang có điểm nghẽn (bottleneck) nào rõ ràng nhất? (VD: Sinh viên thường kẹt ở môn nào? Thiếu kỹ năng gì?)"
    },

    {
      type: "header",
      title: "4B. Nhu cầu về công cụ phân tích & AI"
    },
    {
      type: "multiple_choice",
      title: "4B.1. Khi cần tìm hiểu kết quả học tập, thầy/cô thường muốn nhìn dữ liệu theo cấp nào đầu tiên?",
      choices: [
        "Toàn khoa (tổng quan tất cả các ngành)",
        "Theo ngành cụ thể (các môn trong 1 ngành)",
        "Theo môn học cụ thể (chi tiết 1 môn)",
        "Theo khóa/học kỳ cụ thể",
        "Tùy tình huống, cần linh hoạt chuyển đổi giữa các cấp"
      ]
    },
    {
      type: "multiple_choice",
      title: "4B.2. Nếu có một hệ thống AI cho phép thầy/cô đặt câu hỏi bằng tiếng Việt (VD: 'Môn nào trượt nhiều nhất K18?', 'So sánh GPA K17 vs K18') và nhận câu trả lời kèm biểu đồ tự động, thầy/cô đánh giá tính năng này thế nào?",
      choices: [
        "Rất hữu ích — đây chính là thứ tôi đang cần",
        "Khá hữu ích — nhưng tôi cần xem demo thực tế mới đánh giá được",
        "Bình thường — tôi quen dùng Excel/báo cáo truyền thống hơn",
        "Không cần thiết — tôi thích tự thao tác trên bảng số liệu"
      ]
    },
    {
      type: "multiple_choice",
      title: "4B.3. Nếu hệ thống hiển thị dữ liệu dạng cây phân cấp (Khoa → Ngành → Môn học), mỗi mục có chỉ số sức khỏe (xanh/vàng/đỏ), click vào sẽ hiện phân tích chi tiết — thầy/cô có thấy cách trình bày này trực quan không?",
      choices: [
        "Rất trực quan — phù hợp với cách tôi tư duy về cấu trúc chương trình",
        "Khá trực quan — nhưng cần kết hợp thêm bảng biểu/dashboard",
        "Bình thường — tôi quen xem dữ liệu dạng bảng Excel hơn",
        "Không phù hợp — tôi thích cách trình bày khác"
      ]
    },

    {
      type: "header",
      title: "5. Xác định điểm nghẽn & Sẵn sàng chi trả (Willingness to Pay)"
    },
    {
      type: "grid",
      title: "5.1. Trong các workflow quản lý/giảng dạy sau, mức độ khó khăn/phiền toái hiện tại như thế nào?",
      rows: [
        "Theo dõi và tổng hợp kết quả học tập của sinh viên",
        "Phân tích và tìm ra các chủ đề/môn học sinh viên hay sai",
        "Đánh giá và làm minh chứng mức đạt chuẩn đầu ra (CLO/PLO)",
        "Lập báo cáo cải tiến môn học/chương trình đào tạo",
        "Phân tích dữ liệu học tập qua nhiều khóa/học kỳ"
      ],
      columns: [
        "Không khó",
        "Hơi khó",
        "Khó vừa",
        "Rất khó",
        "Cực kỳ khó"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.2. Theo thầy/cô, nguyên nhân chính gây ra khó khăn lớn nhất là gì?",
      choices: [
        "Do hệ thống/công cụ không hỗ trợ tốt (Vấn đề technique/Hạ tầng)",
        "Do chưa quen sử dụng công cụ hoặc thiếu kỹ năng phân tích dữ liệu (Vấn đề kỹ năng)",
        "Do quy trình của nhà trường/khoa rườm rà, thiếu thống nhất (Vấn đề quy trình)",
        "Do thiếu dữ liệu chuẩn xác và đầy đủ",
        "Kết hợp nhiều nguyên nhân"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.3. Thầy/cô ước tính mình lãng phí bao nhiêu thời gian mỗi tháng cho các việc tổng hợp dữ liệu, báo cáo thủ công kể trên?",
      choices: [
        "Dưới 2 giờ",
        "Từ 2 - 5 giờ",
        "Từ 5 - 10 giờ",
        "Từ 10 - 20 giờ",
        "Hơn 20 giờ"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.4. Nếu có một giải pháp AI tự động hóa hoàn toàn các quy trình này (phân tích điểm, đánh giá chuẩn đầu ra, sinh báo cáo cải tiến), giúp tiết kiệm toàn bộ thời gian lãng phí trên, thầy/cô sẵn sàng chi trả ở mức nào?",
      choices: [
        "Chỉ sử dụng nếu nhà trường mua và cấp tài khoản miễn phí",
        "Khoảng 50.000 - 100.000 VNĐ / tháng",
        "Khoảng 100.000 - 300.000 VNĐ / tháng",
        "Khoảng 300.000 - 500.000 VNĐ / tháng",
        "Sẵn sàng trả hơn 500.000 VNĐ / tháng nếu thực sự giải quyết được khó khăn"
      ]
    },
    {
      type: "paragraph",
      title: "5.5. Nếu được thay đổi MỘT điều duy nhất trong cách phân tích và cải tiến chất lượng đào tạo hiện nay, thầy/cô muốn thay đổi gì nhất?"
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
      title: "1. Tổng hợp dữ liệu kết quả học tập toàn chương trình"
    },
    {
      type: "checkbox",
      title: "1.1. Khi cần tổng hợp dữ liệu kết quả học tập của toàn khoa/trường, đơn vị anh/chị phải lấy dữ liệu từ đâu?",
      choices: [
        "Từ hệ thống Phòng Đào tạo (chỉ có điểm tổng kết)",
        "Gom các file Excel từ từng bộ môn/giảng viên",
        "Từ hệ thống LMS dùng chung",
        "Tự xây dựng cơ sở dữ liệu nội bộ",
        "Nhiều nguồn khác nhau, không đồng bộ"
      ],
      other: true
    },
    {
      type: "multiple_choice",
      title: "1.2. Mất bao lâu để đơn vị hoàn thành một báo cáo tổng hợp kết quả học tập toàn chương trình (VD: báo cáo tổng kết năm)?",
      choices: [
        "Chỉ vài cú click chuột (vài phút)",
        "Vài giờ làm việc",
        "Khoảng 1 - 2 ngày",
        "Khoảng 1 tuần",
        "Nhiều tuần"
      ]
    },
    {
      type: "multiple_choice",
      title: "1.3. Khi cần đánh giá tình hình đào tạo, anh/chị thường bắt đầu từ góc nhìn nào?",
      choices: [
        "Nhìn tổng thể toàn trường/khoa trước, rồi drill-down xuống từng ngành",
        "Bắt đầu từ một ngành cụ thể, rồi so sánh với các ngành khác",
        "Bắt đầu từ các môn có vấn đề (tỷ lệ trượt cao, phản ánh nhiều)",
        "Xem báo cáo tổng hợp định kỳ (cuối kỳ/cuối năm)",
        "Không có quy trình cố định, tùy vào yêu cầu/vấn đề phát sinh"
      ]
    },

    {
      type: "header",
      title: "2. Phân tích hiệu quả Chương trình đào tạo (CTĐT) qua các khóa"
    },
    {
      type: "checkbox",
      title: "2.1. Khi cần đánh giá hiệu quả của một CTĐT, đơn vị thường phân tích những gì?",
      choices: [
        "So sánh tỷ lệ tốt nghiệp qua các khóa",
        "So sánh GPA trung bình qua các khóa",
        "Xác định các môn học có tỷ lệ trượt cao nhất (điểm nghẽn)",
        "So sánh kết quả trước và sau khi có sự thay đổi CTĐT (VD: CTĐT cũ vs CTĐT mới)",
        "Đánh giá tính hợp lý của các môn tiên quyết (sinh viên qua môn tiên quyết có học tốt môn sau không?)",
        "Phân tích phân bố tín chỉ theo từng học kỳ",
        "Chưa từng thực hiện phân tích có hệ thống"
      ],
      other: true
    },
    {
      type: "grid",
      title: "2.2. Đánh giá mức độ thuận tiện khi thực hiện các phân tích sau bằng công cụ hiện tại:",
      rows: [
        "So sánh kết quả sinh viên giữa các khóa học (VD: K17 vs K18)",
        "Đánh giá hiệu quả của CTĐT cũ so với CTĐT mới",
        "Xác định môn học nào đang làm chậm tiến độ ra trường của sinh viên",
        "Phân tích mối liên hệ/nhân quả giữa các môn (tiên quyết → hậu quyết)",
        "Dự báo tác động nếu quyết định thay đổi nội dung CTĐT"
      ],
      columns: [
        "Không thể",
        "Rất khó",
        "Bình thường",
        "Dễ",
        "Rất dễ"
      ]
    },
    {
      type: "multiple_choice",
      title: "2.3. Các quyết định thay đổi CTĐT hiện nay (thêm/bớt môn, đổi môn tiên quyết...) chủ yếu được dựa trên cơ sở nào?",
      choices: [
        "Dữ liệu phân tích kết quả học tập cụ thể",
        "Kinh nghiệm và cảm tính của giảng viên, hội đồng khoa học",
        "Yêu cầu bắt buộc từ tổ chức kiểm định",
        "Tham khảo rập khuôn CTĐT của trường khác",
        "Kết hợp nhiều nguồn nhưng thiếu dữ liệu chứng minh"
      ]
    },
    {
      type: "paragraph",
      title: "2.4. Đơn vị có thể chia sẻ một ví dụ cụ thể về lần gần nhất phải thay đổi CTĐT không? (Thay đổi gì? Dựa trên căn cứ nào? Kết quả sau thay đổi ra sao?)"
    },

    {
      type: "header",
      title: "3. Đánh giá chuẩn đầu ra & Kiểm định (ABET/AUN)"
    },
    {
      type: "checkbox",
      title: "3.1. Việc thu thập minh chứng và tính toán mức độ đạt chuẩn đầu ra chương trình (PLO) phục vụ kiểm định hiện nay gặp khó khăn gì?",
      choices: [
        "Phải thu thập thủ công từ nhiều giảng viên (chậm trễ, thiếu sót)",
        "Dữ liệu gửi lên không đồng nhất về định dạng",
        "Rất khó để đối chiếu/map từ CLO môn học lên PLO chương trình",
        "Mất quá nhiều thời gian làm báo cáo thủ công",
        "Chỉ làm đối phó khi sắp có đoàn kiểm định, không duy trì thường xuyên",
        "Không gặp khó khăn đáng kể"
      ],
      other: true
    },

    {
      type: "header",
      title: "4. Phát hiện xu hướng, bất thường & Ra quyết định"
    },
    {
      type: "checkbox",
      title: "4.1. Đơn vị thường xử lý các vấn đề bất thường trong kết quả đào tạo như thế nào?",
      choices: [
        "Nhận cảnh báo sớm ngay khi môn học có tỷ lệ trượt tăng bất thường giữa kỳ",
        "Chỉ nhận ra tỷ lệ trượt tăng đột biến khi xem báo cáo cuối kỳ",
        "Họp hội đồng để tìm hiểu nguyên nhân khi GPA toàn khóa có xu hướng giảm",
        "Chủ yếu dựa vào sinh viên hoặc giảng viên phản ánh mới biết",
        "Thường không phát hiện kịp thời"
      ]
    },

    {
      type: "header",
      title: "4B. Nhu cầu về công cụ phân tích & AI"
    },
    {
      type: "multiple_choice",
      title: "4B.1. Nếu có một hệ thống AI cho phép anh/chị hỏi bằng tiếng Việt (VD: 'Ngành nào có tỷ lệ trượt cao nhất?', 'So sánh hiệu quả CTĐT K17 vs K18') và nhận câu trả lời kèm biểu đồ tự động, anh/chị đánh giá tính năng này thế nào?",
      choices: [
        "Rất hữu ích — giúp lãnh đạo nắm tình hình nhanh mà không cần chờ chuyên viên tổng hợp",
        "Khá hữu ích — nhưng cần đảm bảo dữ liệu chính xác và có nguồn trích dẫn",
        "Bình thường — tôi quen nhận báo cáo từ nhân viên/bộ môn gửi lên",
        "Không cần thiết"
      ]
    },
    {
      type: "multiple_choice",
      title: "4B.2. Nếu hệ thống hiển thị dữ liệu dạng cây phân cấp (Trường → Khoa → Ngành → Môn), mỗi mục có chỉ số sức khỏe đào tạo (xanh/vàng/đỏ), click vào sẽ hiện phân tích AI tự động — anh/chị thấy cách tiếp cận này thế nào?",
      choices: [
        "Rất phù hợp — đúng cách tôi muốn giám sát tình hình từ trên xuống",
        "Khá phù hợp — nhưng cần kết hợp thêm dashboard tổng hợp",
        "Bình thường — tôi quen xem báo cáo dạng văn bản/bảng biểu",
        "Không phù hợp với quy trình hiện tại của đơn vị"
      ]
    },

    {
      type: "header",
      title: "5. Xác định điểm nghẽn & Sẵn sàng chi trả (Willingness to Pay)"
    },
    {
      type: "grid",
      title: "5.1. Mức độ khó khăn/tốn nguồn lực của các quy trình quản lý đào tạo hiện nay:",
      rows: [
        "Tổng hợp dữ liệu kết quả học tập từ nhiều nguồn",
        "Làm báo cáo minh chứng đạt chuẩn đầu ra cho kiểm định",
        "Phân tích hiệu quả của một CTĐT qua các khóa",
        "Ra quyết định thay đổi CTĐT dựa trên dữ liệu",
        "Phát hiện xu hướng bất thường về chất lượng dạy/học"
      ],
      columns: [
        "Không khó",
        "Hơi khó",
        "Khó vừa",
        "Rất khó",
        "Cực kỳ khó"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.2. Khó khăn lớn nhất trong việc ra quyết định dựa trên dữ liệu là do:",
      choices: [
        "Thiếu hệ thống/công cụ phân tích mạnh mẽ (Technique)",
        "Nhân sự quản lý chưa có thói quen hoặc kỹ năng phân tích dữ liệu (Kỹ năng)",
        "Thiếu quy trình rõ ràng về việc sử dụng dữ liệu để ra quyết định (Quy trình)",
        "Dữ liệu gốc từ các bộ môn cung cấp không đầy đủ/chính xác",
        "Khác"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.3. Ước tính tổng thời gian nhân sự của đơn vị dành cho các việc tổng hợp dữ liệu, phân tích, làm báo cáo đào tạo thủ công mỗi HỌC KỲ là bao nhiêu?",
      choices: [
        "Dưới 1 tuần làm việc (< 40 giờ)",
        "Từ 1 - 2 tuần làm việc (40 - 80 giờ)",
        "Từ 2 - 4 tuần làm việc (80 - 160 giờ)",
        "Hơn 1 tháng làm việc (> 160 giờ)",
        "Không ước tính được"
      ]
    },
    {
      type: "multiple_choice",
      title: "5.4. Giả sử hệ thống AI giúp tự động hóa phần lớn công việc kể trên (gom dữ liệu, phân tích, tính CLO/PLO, sinh báo cáo), và đơn vị đã được demo thấy hiệu quả thực tế. Khi đó, mức chi phí nào là hợp lý để đơn vị cân nhắc đầu tư (tính trên 1 ngành đào tạo/năm)?",
      choices: [
        "Chỉ sử dụng nếu nhà trường/khoa cấp kinh phí và triển khai tập trung",
        "Dưới 10 triệu VNĐ / năm",
        "Từ 10 - 30 triệu VNĐ / năm",
        "Từ 30 - 50 triệu VNĐ / năm",
        "Tùy thuộc vào ROI — nếu tiết kiệm được nhân sự tương đương, sẵn sàng đầu tư cao hơn"
      ]
    },
    {
      type: "paragraph",
      title: "5.4. Mong muốn lớn nhất của đơn vị về một hệ thống AI hỗ trợ quản lý chất lượng đào tạo là gì?"
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
 * TỰ ĐỘNG TÁCH RESPONSE THEO NHÓM
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

  if (role === ROLE_TEACHER) {
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
  defaultSheet.getRange("A3").setValue("Script sẽ tự động tách response vào 2 sheet: Giảng viên, Ban quản lý.");

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
