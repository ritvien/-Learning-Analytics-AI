# UX Simplification Review

> Ngay review: 24/06/2026  
> Muc tieu: don gian hoa he thong, giam thao tac thua, giu cac luong co gia tri cao cho demo va nguoi dung that.  
> Pham vi doc code: frontend dashboard, analytics filters, report center, chat, navigation, preload, CRUD va RBAC surface.

## 1. Ket luan nhanh

He thong da co nen tang chuc nang tot: dashboard tong quan dung API aggregate, dashboard nganh co filter ro, report center sau, chat co session va stream, RBAC backend/UI da co huong dung. Diem can sua khong phai them nhieu tinh nang nua, ma la giam so man hinh va giam so filter nguoi dung phai tu hieu.

Cap nhat thuc thi ngay 24/06/2026:

- Da don sidebar theo nhom Dieu hanh / Theo doi / Du lieu / He thong; an Departments Analytics va Student Analytics khoi sidebar, giu route noi bo.
- Da cat preload raw lon sau login; `DashboardPreloader` chi con route prefetch va API nhe.
- Da dua date range vao "Bo loc nang cao" tren cac dashboard analytics chinh va them nut Dat lai.
- Da Viet hoa cac label dashboard con sot nhu Program Overview Table, Course Performance in Program, Credit progress, Risk Explanation, Student Transcript Table, Course Analytics dialog.
- Da sua cac loi lint chan build lien quan den nhom file vua cham; frontend lint con warning khong chan.

Quyet dinh san pham de de dung hon:

| Hang muc | Quyet dinh | Ly do |
|---|---|---|
| Dashboard tong quan | Giu lam landing chinh sau login | Tra loi nhanh "truong/khoa/nganh dang on khong?" |
| Co cau dao tao tree | Giu, nhung doi thanh "Cay dao tao" va dung nhu drill-down | Hien dang trung vai tro voi dashboard tong quan |
| Analytics theo Khoa/Ngành | Gop vao tong quan hoac an khoi sidebar | Trang nay trung voi tong quan va nganh dao tao |
| Analytics theo Ngành | Giu, nhung mo tu drill-down va filter it hon | Co gia tri cao cho truong khoa/truong nganh |
| Analytics theo Môn | Giu, nhung can backend aggregate, khong tai 50k enrollment | Hien tai nang va co nhieu bieu do chuyen sau |
| Analytics theo Lớp | Giu nhu man hinh canh bao lop va SV rui ro | Co gia tri hanh dong ro cho lecturer/covan |
| Analytics theo Sinh viên | Chuyen thanh drill-down tu danh sach SV, khong de sidebar mac dinh | Select 1000 SV khong phu hop UX |
| Date range | Dua vao "Bo loc nang cao" | Nguoi dung chinh thuong hay chon hoc ky, khong chon ngay raw |
| Global preloader | Cat bot preload raw lon | Dang tai nen qua nhieu, co nguy co lam app cham |
| Report Center | Giu, nhung chia 2 tab "Tao bao cao" va "Thu vien bao cao" | Trang hien rat manh nhung qua day |
| Chat AI | Giu global chat, chat full page de lich su/phien | Tranh de 2 entry point gay roi bang copy va hanh vi khac nhau |

## 2. Actor va viec can lam

### Superadmin / Admin

Muc tieu that:

- Quan ly tai khoan va quyen.
- Xem suc khoe toan truong.
- Dieu tra loi/hanh vi neu co su co.

Trai nghiem nen co:

- Sau login vao "Tong quan" voi KPI, canh bao, top khoa/nganh/mon can chu y.
- Sidebar chi hien cac muc quan tri that su can: Tong quan, Cay dao tao, Bao cao, Tai khoan, Quan sat he thong.
- Observability API T53 nen co UI sau, nhung khong can len demo chinh neu chua co thoi gian.

Can giam:

- Khong day admin vao nhieu trang analytics con ngay tu sidebar.
- Khong bat admin phai hieu "course/section/enrollment" neu chi can xem rui ro cap truong.

### Manager / Truong khoa / Truong nganh

Muc tieu that:

- Biet khoa/nganh nao dang giam.
- Tim mon/lop keo ket qua xuong.
- Tao bao cao va action plan.

Trai nghiem nen co:

- Mac dinh filter theo scope cua user. Neu manager thuoc khoa, dashboard mo san khoa do.
- Luong chinh: Tong quan -> chon khoa/nganh -> mon bottleneck -> lop/SV can ho tro -> tao bao cao.
- Bo loc can co thu tu: Hoc ky, Khoa, Nganh, Mon, Lop. Cac filter sau phu thuoc filter truoc.

Can giam:

- Trang "Phan tich theo Khoa/Ngành" rieng co the gop vao Tong quan.
- Date range nen an trong "Nang cao"; hoc ky la bo loc chinh.

### Lecturer / Co van hoc tap

Muc tieu that:

- Xem cac lop minh phu trach.
- Biet SV nao can chu y.
- Hoi AI hoac tao report section intervention.

Trai nghiem nen co:

- Sidebar cho lecturer nen uu tien: Lop cua toi, SV can chu y, Bao cao, Chat.
- Bo loc mac dinh theo lop cua giang vien, khong hien "Toan truong".
- Man hinh lop nen co CTA ro: "Mo danh sach SV can ho tro", "Tao bao cao lop", "Hoi AI ve lop nay".

Can giam:

- Khong hien cac dashboard toan truong neu backend da chan hoac user khong co scope.
- Khong de lecturer phai chon tu danh sach 5000 section.

### Nguoi dung moi / Demo viewer

Muc tieu that:

- Hieu san pham trong 30 giay.
- Thay duoc du lieu that va hanh dong tiep theo.

Trai nghiem nen co:

- First screen: 4-5 KPI, 3 canh bao uu tien, 1 bang "can xu ly".
- Moi chart can co hanh dong drill-down gan no.
- Tu ngu can thong nhat tieng Viet, han che label tieng Anh trong UI.

## 3. Review navigation hien tai

Sidebar hien tai co 4 nhom: Quan ly chung, Phan tich, Dao tao, He thong. Van de la nhom "Phan tich" co qua nhieu entry ngang hang:

- Tong quan toan truong
- Nganh dao tao
- Mon hoc
- Lop hoc phan
- Sinh vien

Kien nghi sidebar moi:

| Nhom | Muc giu | Ghi chu |
|---|---|---|
| Dieu hanh | Tong quan, Cay dao tao, Bao cao | 3 muc chinh cho manager/admin |
| Theo doi | Lop & SV can chu y, Mon bottleneck | Chi hien khi co quyen/scope |
| Du lieu | Sinh vien, Giang vien, Khoa/Ngành, Mon hoc, Diem so | CRUD/van hanh |
| He thong | Tai khoan, Upload CTDT, Quan sat he thong | Admin/superadmin only cho muc nhay cam |

Can thay:

- "Cơ cấu đào tạo" -> "Cây đào tạo".
- "Tổng quan toàn trường" -> "Tổng quan".
- "Ngành đào tạo" trong Phân tích -> "Chi tiết ngành".
- "Sinh viên" trong Phân tích -> bo khoi sidebar, chi mo tu search/drill-down.
- "Upload CTĐT" -> "Tài liệu CTĐT" neu chua that su upload/index RAG hoan chinh.

## 4. Review dashboard va bo loc

### 4.1 Tong quan toan truong

Trang tot:

- Dung API aggregate `/analytics/dashboard/overview`.
- Co KPI, trend, pass rate theo khoa, cohort, heatmap, bang program overview.
- Filter hoc ky/khoa/ngay ro rang.

Can sua:

- Date range nen an vao "Nang cao". Bo loc chinh nen chi la Hoc ky + Khoa.
- Bang "Program Overview Table" can doi title sang tieng Viet: "Tong quan nganh".
- Action "Xem ngành" tot, nen them action "Xem môn rủi ro" neu row co worst_course.
- Heatmap nganh x hoc ky nen dat sau bang canh bao, khong can o giua neu nguoi dung can hanh dong nhanh.
- Badge filter lap lai noi dung cua select, chi nen hien khi filter khac mac dinh.

Filter target:

```text
Hang mac dinh:
[Hoc ky: Hoc ky gan nhat] [Khoa: Theo scope / Toan truong]

Nang cao:
[Tu ngay] [Den ngay] [Reset]
```

### 4.2 Phan tich Khoa / Nganh

Trang hien co:

- Filter Hoc ky, Khoa, Nganh, Tu ngay, Den ngay.
- Co chart pass rate, diem TB, SV co luot truot, heatmap, drill-down top mon/lop bat thuong.

Nhan dinh:

- Chuc nang trung nhieu voi Tong quan va Chi tiet nganh.
- Nen khong de thanh muc sidebar rieng trong demo.

Kien nghi:

- Gop chart pass rate theo khoa va heatmap vao Tong quan.
- Gop drill-down top mon/lop vao "Chi tiet khoa" mo khi click khoa.
- Neu chua kip gop code, an link sidebar `/manager/analytics/departments` va chi giu route de deep-link noi bo.

### 4.3 Chi tiet nganh

Trang tot:

- Dung API aggregate `/analytics/dashboard/programs/{id}`.
- Filter nganh/hoc ky/khoa/ngay.
- Co trend, phan bo ket qua, heatmap khoa x hoc ky, course performance.

Can sua:

- Select nganh can co search/combobox; select dai se kho dung khi nhieu nganh.
- Khi vao tu Tong quan, filter nganh da co query param la dung.
- Doi label tieng Anh "Course Performance in Program" -> "Môn kéo kết quả ngành xuống".
- Bo loc "Khóa" chi nen hien khi dang phan tich cohort; neu khong, de trong Nang cao.

Quy uoc de tranh nham:

- Heatmap "Ty le dat theo khoa nhap hoc va hoc ky" tra loi: **khoa sinh vien nao dang giam ket qua qua cac hoc ky?** Moi o la pass rate, khong phai diem trung binh va khong phai mot mon hoc.
- Bang "Mon keo ket qua nganh xuong" tra loi: **mon nao can dao sau?** Day la diem bat dau cho drill-down sang chi tiet mon va lop hoc phan.
- Huong dan onboarding phai tro dung tung khu vuc; khong dung selector chung `table` vi trang co nhieu bang.

### 4.4 Phan tich mon hoc

Trang hien co:

- Filter Khoa -> Nganh -> Mon -> Date.
- Neu khong chon mon, trang keo `enrollments limit: 50000`, `sections limit: 5000`, health batch nhieu mon.
- Co overview top/bottom mon va khi chon mon thi co trend, phan bo diem, chi tiet lop.

Van de:

- Tai raw enrollment lon tren frontend la diem can sua P0.
- Filter Khoa bi bat buoc truoc Nganh, nhung neu nguoi dung co mon cu the tu search/deep-link thi nen di thang.
- Trang vua lam "mon bottleneck overview" vua lam "chi tiet mon", nen hoi qua tai.

Kien nghi:

- Tach thanh 2 che do trong cung route:
  - Mac dinh: "Mon can chu y" bang aggregate/top bottom.
  - Sau khi chon mon: "Chi tiet mon".
- Backend nen co API aggregate cho course analytics, khong tai 50k enrollments.
- Date range dua vao Nang cao.
- Them search mon theo ma/ten.

### 4.5 Lop hoc phan & SV nguy co

Trang hien co:

- Filter Hoc ky -> Mon -> Lop, date range.
- Neu khong chon lop/mon, co the keo raw enrollment `limit: 50000`.
- Co bang lop pass rate thap, danh sach SV can chu y khi chon lop.

Trang nay co gia tri hanh dong cao, nen giu.

Can sua:

- Mac dinh lecturer: chi hien lop cua minh.
- Select lop dang disabled neu chua chon mon; nen cho search lop truc tiep theo ma lop.
- Neu chon Hoc ky, list Mon/Lop nen la dependent options dung.
- Bang "Tat ca lop trong pham vi" nen co action "Mo lop", "Tao bao cao", "Hoi AI".
- Backend aggregate section overview can thay raw enrollment.

### 4.6 Dashboard ca nhan sinh vien

Trang hien co:

- Load `students limit: 1000`, sections, courses, semesters, programs.
- Chon SV bang Select list 1000 dong.
- Sau do load enrollments cua SV.

Van de UX:

- Khong nen la muc sidebar mac dinh.
- Select 1000 SV khong search la kho dung.
- Trang dung nhieu label tieng Anh: "Credit progress", "Risk Explanation", "Student Transcript Table".

Kien nghi:

- Chuyen thanh route detail mo tu danh sach SV, lop/SV rui ro, hoac search global.
- Thay select bang search combobox theo MSSV/ten/lop.
- Doi label tieng Viet:
  - "Credit progress" -> "Tien do tin chi"
  - "Risk Explanation" -> "Ly do can theo doi"
  - "Student Transcript Table" -> "Bang diem hoc phan"

## 5. Review cac chuc nang khac

### Auth, RBAC, users

Tot:

- Sidebar da an "Tai khoan & phan quyen" voi role superadmin/admin.
- Backend co guard cho user management.

Can sua:

- Can route guard UI that su cho cac path bi an, khong chi an sidebar.
- Role label trong header dang hien raw `superadmin/admin/manager`; nen doi thanh "Superadmin", "Quan tri", "Quan ly khoa", "Giang vien".
- Trang users nen them filter/search theo email/role/status neu so user tang.

### CRUD sinh vien, giang vien, khoa/nganh, mon hoc, diem

Tot:

- Day la nhom van hanh du lieu can giu.

Can sua:

- Dat nhom nay sau "Theo doi" trong sidebar, vi nguoi dung vao dashboard de ra quyet dinh truoc.
- Cac form CRUD nen co scope mac dinh theo role, vi manager khong nen chon nham khoa ngoai scope.
- Khi tao/sua xong nen co link "Xem phan tich" neu entity co dashboard lien quan.

### Report Center

Tot:

- Report center co gia tri cao: template theo actor, scheduled report, export, report agent.
- Co logic chart/report kha day du.

Van de:

- File/page qua lon, man hinh nhieu vai tro va nhieu che do cung luc.
- Nguoi dung moi co the khong biet nen "tao bao cao" hay "doc bao cao co san".

Kien nghi UX:

- Tach UI thanh 3 tab ro:
  - "Tao bao cao"
  - "Thu vien bao cao"
  - "Lich tu dong"
- Khi tao bao cao, dung wizard 3 buoc:
  - Chon muc tieu: Khoa/Nganh/Mon/Lop/Toan truong
  - Chon pham vi va hoc ky
  - Xem truoc va tao
- Report Agent nen xuat hien sau khi user chon mot report, khong can hien day du luc chua co context.

### Chat AI

Tot:

- Co session history, stream status, suggested prompts.
- Co global chat shell va full chat page.

Can sua:

- Global chat va full chat can thong nhat copy, suggested prompts, va session behavior.
- Neu global chat chi dung de hoi nhanh theo context, nen label "Hoi nhanh" va co nut "Mo trong Chat".
- Hien tai welcome message co emoji; neu style he thong nghiem tuc, nen giam trang tri.
- Suggested prompts nen phu thuoc trang hien tai: tong quan, nganh, lop, report.

### Upload CTDT / RAG

Nhan dinh:

- Ten hien tai "Upload CTDT" co the lam nguoi dung ky vong upload that + index that.
- Neu RAG chua hoan chinh, nen doi thanh "Tai lieu CTDT" va ghi ro trang thai index.

Can sua:

- Chi hien cho role co quyen.
- Co trang thai file: "Da tai len", "Dang index", "Da san sang", "Loi".
- Co CTA tiep theo: "Hoi AI ve tai lieu nay" khi index xong.

### Observability / Superadmin

Backend T53 da co API doc/list/aggregate. UX chua can lam ngay, nhung nen dua vao roadmap:

- "Quan sat he thong" chi hien superadmin.
- First view: active users, error rate, slow routes, sessions gan day.
- Drill-down: user -> session -> event log.

## 6. Van de he thong can xu ly

### 6.1 Preload dang qua nang

`DashboardPreloader` dang tai nhieu endpoint nen, gom ca:

- `getSections({ limit: 5000 })`
- `getGradeComponents({ limit: 10000 })`
- `getEnrollments({ limit: 50000 })`
- `getStudents({ limit: 1000 })`
- `getCourses({ limit: 1000 })`

Tac dong:

- Trang dau sau login co the cham, dac biet khi demo bang ngrok.
- Log observability bi noise vi request nen qua nhieu.
- Nguoi dung co the thay dashboard giat hoac data tranh nhau cap nhat.

Kien nghi P0:

- Preload chi giu route prefetch va API nhe: `getTree`, `getDashboardOverview`, `getReports({ limit: 20 })`.
- Bo preload raw enrollment/grade components.
- Chi preload khi user hover/focus link hoac sau khi user dung trang > 5 giay.

### 6.2 Raw analytics tren frontend

Mot so trang da dung aggregate API tot, nhung course/section/student van keo raw data lon.

Can chuyen:

| Trang | Hien tai | Nen thay bang |
|---|---|---|
| Course analytics | `getEnrollments limit 50000`, `getSections limit 5000`, health batch | `/analytics/dashboard/courses` aggregate |
| Section analytics | `getEnrollments limit 50000`, `getStudents limit 1000`, sections all | `/analytics/dashboard/sections` aggregate |
| Student analytics | load students 1000 + detail enrollment | `/analytics/dashboard/students/{id}` detail |

### 6.3 Filter chua co model chung

Hien tai moi trang tu tao filter rieng. He qua:

- Ten field khac nhau: `semesterCode`, `selSem`, `semester`.
- Reset cascade khong dong nhat.
- Badge filter lap lai o nhieu trang.
- Date conversion lap lai nhieu file.

Kien nghi:

- Tao `DashboardFilterBar` dung chung.
- Tao helper `dateStartIso/dateEndIso` trong `frontend/src/lib/api.ts` hoac `utils.ts`.
- Tao convention query params:
  - `semester_code`
  - `department_id`
  - `program_id`
  - `course_id`
  - `section_id`
  - `student_id`
  - `date_from`
  - `date_to`

## 7. Bo loc moi de de dung hon

### Nguyen tac

- Mac dinh it filter: chi hien nhung gi actor can 80% thoi gian.
- Filter phu thuoc nhau: chon Khoa moi thu hep Nganh; chon Mon moi thu hep Lop.
- Co nut Reset ro rang.
- Co active chips chi hien khi filter khac mac dinh.
- Date range la advanced filter, khong de ngang hang voi Hoc ky.
- Select danh sach dai phai la combobox search.

### Mau filter de xuat

```text
[Hoc ky: Gan nhat] [Pham vi: Khoa/Nganh theo quyen] [Tim mon/lop/SV...]

Bo loc nang cao
  [Khoa] [Nganh] [Mon] [Lop] [Tu ngay] [Den ngay] [Reset]

Dang loc: Hoc ky 2024-2025 HK2 · Khoa CNTT · 3 filter
```

### Mac dinh theo actor

| Actor | Default scope | Filter hien |
|---|---|---|
| Superadmin/Admin | Toan truong | Hoc ky, Khoa |
| Manager khoa | Khoa cua minh | Hoc ky, Nganh |
| Truong nganh | Nganh cua minh | Hoc ky, Mon |
| Lecturer | Lop cua minh | Hoc ky, Mon/Lop |
| Co van | SV/lop phu trach | Hoc ky, Lop/SV |

## 8. Nhung thu nen bo/an ngay

P0 de demo gon hon:

- An `/manager/analytics/departments` khoi sidebar, giu route noi bo.
- An `/manager/analytics/students` khoi sidebar, chi mo tu drill-down/search.
- Bo preload `getEnrollments({ limit: 50000 })`, `getGradeComponents({ limit: 10000 })`, `getSections({ limit: 5000 })`.
- Doi cac title tieng Anh con lai sang tieng Viet.
- Dua date range vao advanced filter tren cac dashboard.

P1 sau demo:

- Gop "Khoa/Ngành analytics" vao "Tong quan" + "Chi tiet khoa".
- Viet aggregate API cho course/section/student analytics.
- Lam combobox search cho nganh/mon/lop/SV.
- Them route guard UI `/forbidden` dong bo voi sidebar role.

P2:

- Lam UI superadmin observability.
- Luu preset filter theo user.
- Them "Saved views" cho manager.

## 9. Backlog de trien khai

| ID | Viec can lam | Uu tien | Tac dong |
|---|---|---:|---|
| UX22-01 | Cat preload raw lon trong `DashboardPreloader` | P0 | Tang toc login/dashboard, giam noise |
| UX22-02 | Don sidebar: an Departments Analytics va Student Analytics | P0 | Giam roi, tao luong drill-down ro |
| UX22-03 | Doi label tieng Anh con lai sang tieng Viet | P0 | Chuyen nghiep hon khi demo |
| UX22-04 | Dua date range vao advanced filter | P0 | Filter de hieu hon |
| UX22-05 | Them nut Reset filter chung | P0 | Giam bi ket trong bo loc |
| UX22-06 | Tao `DashboardFilterBar` dung chung | P1 | Giam lap code, filter dong nhat |
| UX22-07 | Combobox search cho Nganh/Mon/Lop/SV | P1 | Tim nhanh khi data lon |
| UX22-08 | Aggregate API cho course analytics | P1 | Bo tai 50k enrollment tren FE |
| UX22-09 | Aggregate API cho section analytics | P1 | Bo tai raw enrollment/students tren FE |
| UX22-10 | Student detail route tu drill-down thay vi sidebar | P1 | Dung dung ngu canh |
| UX22-11 | Report Center wizard 3 buoc | P1 | Tao bao cao de hon |
| UX22-12 | Context-aware chat prompts | P2 | Chat huu ich hon |
| UX22-13 | Observability UI cho superadmin | P2 | Hoan thien T53 ve mat UI |

## 10. Luong de xuat cho demo/nguoi dung

Luong manager:

```text
Login
-> Tong quan
-> Click khoa/nganh dang do
-> Chi tiet nganh
-> Click mon bottleneck
-> Chi tiet mon hoac Lop/SV nguy co
-> Tao bao cao
-> Hoi AI ve action plan
```

Luong lecturer:

```text
Login
-> Lop & SV can chu y
-> Chon lop cua minh
-> Xem SV can ho tro
-> Tao report lop
-> Hoi AI de goi y can thiep
```

Luong superadmin:

```text
Login
-> Tong quan
-> Tai khoan/RBAC neu can
-> Quan sat he thong neu co loi
-> Drill session/event
```

## 11. Definition of Done cho UX simplification

- [x] Sidebar con toi da 6-8 muc chinh cho manager.
- [ ] Dashboard dau tien co cau tra loi ro: "dang on/khong on, can xu ly gi".
- [x] Khong con preload raw data lon sau login.
- [x] Khong con label tieng Anh trong dashboard chinh.
- [x] Moi dashboard analytics chinh co Reset filter.
- [x] Date range nam trong advanced filter.
- [ ] Select danh sach dai dung combobox search.
- [ ] Course/section/student analytics khong tai 50k enrollment ve frontend.
- [ ] Actor nao chi thay scope lien quan actor do.
- [ ] Drill-down tu overview toi report/chat lien mach.

## 12. Trang thai sau dot sua 24/06/2026

Da lam:

- `frontend/src/components/layout/app-sidebar.tsx`: don navigation theo actor/task, doi ten cac muc de hieu hon.
- `frontend/src/components/layout/dashboard-preloader.tsx`: bo preload sections/enrollments/grade components/students/courses quy mo lon.
- `frontend/src/app/(dashboard)/manager/analytics/page.tsx`: date range vao advanced filter, active chip chi hien khi co filter, them Dat lai, Viet hoa title bang nganh.
- `frontend/src/app/(dashboard)/manager/analytics/programs/page.tsx`: dua cohort/date vao advanced filter, them Dat lai, Viet hoa title bang course performance.
- `frontend/src/app/(dashboard)/manager/analytics/courses/page.tsx`: dua date vao advanced filter, them Dat lai, Viet hoa label pass rate/health/trend, bo ky hieu canh bao thua.
- `frontend/src/app/(dashboard)/manager/analytics/sections/page.tsx`: dua date vao advanced filter, them Dat lai, bo emoji trong risk label.
- `frontend/src/app/(dashboard)/manager/analytics/students/page.tsx`: Viet hoa KPI/card/table title va dua date vao advanced filter.
- `frontend/src/app/(dashboard)/manager/courses/components/course-analytics-dialog.tsx`: Viet hoa dialog analytics mon hoc.

Can lam tiep:

- Viet aggregate API cho course/section/student analytics de bo han viec tai `limit: 50000` trong frontend.
- Doi cac select dai sang combobox search theo MSSV/ten/ma mon/ma lop.
- Lam scope mac dinh theo actor va route guard UI dong bo RBAC.
- Tach/gon Report Center thanh wizard va thu vien bao cao trong mot dot rieng.

## 13. Nang cap trang Lop hoc phan & SV nguy co (24/06/2026)

Trang chi tiet lop khong nen chi la mot bang "SV nguy co". Nguoi quan ly can phan biet duoc ket qua hoc tap, muc do day du cua du lieu cham diem, va viec can xu ly truoc mat.

Da bo sung tren `/manager/analytics/sections`:

- Hien thi diem tong ket neu co; neu chua co, dung dau diem dau tien co diem (uu tien giua ky) va gan nhan ro la diem tam tinh.
- Phan loai Giỏi, Khá, Trung binh, Yeu, Truot va Chua co diem. Bam vao tung nhom de loc roster; co them tim MSSV/ho ten.
- KPI co diem trung binh lop, pass rate, so SV da co diem, trượt va can trượt.
- Bieu do do tin cay ket qua phan tach: Tong ket, tam tinh tu dau diem, chua co diem.
- Bang tien do tung dau diem: so da nhap/tong so, ty le hoan thanh, diem TB quy doi thang 10 va so vang thi.
- Hang doi can thiep uu tien thieu diem truoc, sau do trượt, can trượt va qua yeu. Danh sach nay khac voi roster day du, khong lam mat sinh vien an toan.
- Bieu do so sanh voi mon ghi ro chi dung diem tong ket, tranh dien giai sai khi lop hien dang dung diem giua ky.

Gioi han hien tai:

- Dau diem duoc lay qua API tung lop. Khi quy mo lon, can aggregate API theo lop de tranh tai raw enrollment va danh sach SV lon ve trinh duyet (`UX22-09`).
- Chua co du lieu chuyen can/hoat dong hoc tap trong contract hien tai; khong suy dien "nguy co" tu cac tin hieu khong co that.

## 14. Don gian hoa Trung tam bao cao (24/06/2026)

Review theo actor cho thay trang Bao cao co ba luong chinh: mo mot bao cao co san, tao bao cao theo pham vi, va quan ly lich tu dong. Giao dien cu tron ca ba luong nay voi nhieu thong tin trang thai va tuy chon khong tac dong den ket qua.

Da dieu chinh:

- Bo cac the trang thai lap lai (dinh dang, do tin cay, bao cao moi nhat) khoi dau trang; thong tin nay van co trong ban xem bao cao va lich tu dong.
- Thu gon bo loc thu vien: tim kiem va loai bao cao hien truoc; khoang hoc ky/ngay nam trong "Bo loc nang cao", co nut dat lai.
- Doi "Bao cao tu dong" thanh "Thu vien bao cao" de phan biet voi chuc nang Lich tu dong.
- Dialog tao bao cao chi giu loai bao cao, pham vi va khoang thoi gian. Bo lua chon muc dich va dinh dang dau ra vi chung khong thay doi request/API; PDF duoc xuat tu ban xem sau khi tao.

Luong sau khi don:

```text
Mo ban gan nhat trong Thu vien
hoac
Tao bao cao -> chon loai -> chon pham vi -> tao -> xem/hoi tro ly -> xuat PDF
```

## 15. Actor-first cho Bao cao

Trang Bao cao duoc to chuc lai quanh cong viec thay vi danh sach tai lieu:

- `Can xu ly`: chi cac snapshot co canh bao/rui ro hoac danh sach can theo doi; day la diem vao mac dinh cho manager, truong khoa/nganh, giang vien va co van.
- `Thu vien`: tat ca snapshot trong scope duoc cap quyen, co bo loc de truy vet.
- `Lich tu dong`: khu vuc rieng cho quan ly/admin, khong tron voi viec doc bao cao hang ngay.
- Quick starts phan biet ba nhu cau pho bien: can thiep lop, suc khoe nganh, tom tat toan truong.

Buoc tiep theo can dua role that cua nguoi dung vao template/scope mac dinh o backend va frontend. UI khong duoc tu cho phep mo rong pham vi; API phai la lop chap han cuoi cung.
