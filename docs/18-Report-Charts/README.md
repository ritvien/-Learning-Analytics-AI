# Report Format Standard

> **Ngay cap nhat:** 2026-06-20  
> **Pham vi:** Chuan hoa format va do sau phan tich cho 5 loai bao cao trong Report Center.  
> **Code lien quan:** `backend/app/reports/service.py`, `frontend/src/app/(dashboard)/manager/reports/page.tsx`, `frontend/src/components/reports/report-charts.tsx`, `backend/app/agent/*`

---

## 1. Muc tieu

Bao cao hien tai khong duoc phep dung o muc "tom tat chi so". Moi bao cao phai doc nhu mot tai lieu ra quyet dinh cho dung actor:

- Quan ly truong/khoa: nhin duoc toan canh, vung rui ro, muc uu tien va noi can mo sau.
- Truong nganh: nhin duoc mon nen tang, PLO/CLO, nhom sinh vien va mon keo tien do.
- Giang vien: nhin duoc lop minh day, sinh vien can can thiep, diem thanh phan va CLO yeu.

Mot bao cao dat chuan phai tra loi duoc 6 cau hoi:

1. Dang noi ve pham vi nao va du lieu co dang tin khong?
2. Ket qua tong quan tot/xau den muc nao?
3. Diem yeu nam o dau: khoa, nganh, mon, lop, CLO/PLO hay sinh vien?
4. Bang chung nao chung minh diem yeu do?
5. Can bam vao dau de phan tich sau hon?
6. Ai can lam gi, uu tien nao, trong bao lau?

---

## 2. Format chung bat buoc cho moi report

Tat ca 5 loai report deu phai co cac section sau. Tuy report type ma noi dung tung section se thay doi.

### 2.1 Metadata

Muc dich: nguoi doc biet report dang noi ve cai gi.

Can co:

- Ten bao cao.
- Loai bao cao: toan truong / khoa / nganh / mon / lop hoc phan.
- Pham vi: `scope_type`, `scope_id`, ten khoa/nganh/mon/lop neu co.
- Actor xem bao cao: manager / lecturer.
- Hoc ky, ngay sinh, trang thai report.
- Nguon du lieu: he thong diem, enrollment, CLO/PLO mapping, report history.

### 2.2 Tom tat dieu hanh

Khong viet 1 cau ngan. Can 1 doan 3-5 cau:

- Cau 1: ket luan tong the.
- Cau 2: 2-3 con so quan trong nhat.
- Cau 3: diem nghen chinh.
- Cau 4: muc rui ro va he qua neu khong xu ly.
- Cau 5: huong hanh dong uu tien.

Vi du tot:

> Khoa Co khi - o to va Xay dung co ty le dat 85.0%, nhung rui ro khong nam o toan khoa ma tap trung vao mot so mon nen tang va nganh co nhieu luot truot. Du lieu gom 5.544 luot hoc phan hoan tat, 102 sinh vien dang hoc va 12 sinh vien GPA duoi 2.0. Cac mon Ky thuat nhiet 1, Vat lieu hoc va Toan cao cap 1 dang tao diem nghen chinh. Can mo phan tich nganh va mon de xac dinh lop hoc phan, giang vien va thanh phan diem keo ket qua xuong.

### 2.3 Pham vi va do tin cay du lieu

Can phan tich:

- Co bao nhieu sinh vien/lop/mon/luot hoc phan?
- Bao nhieu du lieu da hoan tat, bao nhieu con thieu diem?
- Co du co mau de ket luan khong?
- Neu co mau nho, phai canh bao ro.

Bang goi y:

| Truong | Y nghia |
|---|---|
| `active_students` / `student_count` | Quy mo nguoi hoc |
| `completed_enrollments` / `graded_count` | Co mau da co ket qua |
| `missing_grade_count` | Diem chua chot |
| `mapping_coverage` | Muc du day du cua CLO/PLO mapping |
| `confidence` | Do tin cay tong hop |

### 2.4 Toan canh ket qua

Can co:

- Ty le dat/truot.
- GPA trung binh hoac diem trung binh.
- Phan bo GPA/diem, khong chi lay trung binh.
- So sanh nhom tot nhat va nhom yeu nhat.
- Neu co trend: so sanh voi cac ky truoc.

### 2.5 Phan tich sau tu du lieu

Day la section quan trong nhat. Moi report phai co it nhat 3 insight. Moi insight gom:

- **Nhan dinh:** dieu he thong ket luan.
- **Bang chung:** so lieu cu the.
- **Hanh dong:** can lam gi tiep.
- **Link mo sau:** trang analytics/report lien quan.

Format:

| # | Nhan dinh | Bang chung | Hanh dong | Mo sau |
|---|---|---|---|---|
| 1 | Mon A keo ket qua xuong | 243 luot truot, chiem 4.2% tong fail | Mo phan tich mon/lop | `/manager/analytics/courses?...` |

### 2.6 Bottleneck / diem nghen

Khong duoc chi liet ke ten mon. Phai noi:

- Diem nghen la gi?
- Anh huong bao nhieu?
- Ty trong trong tong fail/rui ro?
- La hien tuong cuc bo hay lan rong?
- Link mo sau.

### 2.7 Nguyen nhan kha di

Phai tach ro:

- **Dau hieu tu du lieu:** co so that su thay duoc.
- **Gia thuyet can kiem chung:** chua ket luan neu thieu bang chung.

Vi du:

- Dau hieu: Lop X co ty le dat 0%, co mau 12 sinh vien, diem TB 3.8.
- Gia thuyet: Co the do de/rubric kho, sinh vien mat kien thuc nen, hoac lop chua du diem thanh phan.
- Can kiem chung: Mo diem thanh phan, so sanh giang vien/lop khac cung mon.

### 2.8 CLO/PLO

Neu co du lieu:

- CLO/PLO nao duoi nguong.
- Gap bao nhieu so voi target.
- Thanh phan diem nao keo xuong.
- Mon/lop nao lien quan.
- Link mo sau.

Neu khong co du lieu:

- Khong duoc bo trong im lang.
- Phai hien banner: "Chua co mapping thanh phan diem -> CLO" hoac "Chua co ma tran CLO -> PLO".
- Dua action cap nhat mapping.

### 2.9 Action plan

Moi action phai co:

- Ai lam.
- Lam gi.
- Vi sao.
- Uu tien.
- Deadline goi y.
- Link du lieu lien quan.

Khong viet action chung chung nhu "can theo doi them".

---

## 3. Loai 1: `school_overview` - Bao cao toan truong

### 3.1 Actor chinh

- Ban giam hieu.
- Phong dao tao.
- Quan ly cap truong.

### 3.2 Cau hoi can tra loi

- Suc khoe hoc vu toan truong dang o muc nao?
- Rui ro tap trung o khoa/nganh/mon nao?
- Tong the on nhung co diem nghen cuc bo khong?
- Sinh vien nguy co tap trung o dau?
- Can giao viec xuong cap khoa/nganh nao truoc?

### 3.3 Du lieu phai dung

Bat buoc:

- `active_students`
- `program_count`
- `completed_enrollments`
- `passed_enrollments`
- `failed_enrollments`
- `pass_rate`
- `avg_gpa`
- `at_risk_students`
- `risk_level`

Nen co them:

- `gpa_distribution`
- `program_stats`
- `best_programs`
- `weak_programs`
- `bottlenecks`
- `pass_rate_trend`
- `deep_insights`

### 3.4 Format phan tich

1. **Toan canh**
   - Ty le dat toan truong.
   - Tong luot hoc phan da hoan tat.
   - Tong luot truot.
   - GPA trung binh.
   - So sinh vien GPA < 2.0.

2. **Phan bo rui ro**
   - Phan bo GPA: `<2.0`, `2.0-2.49`, `2.5-3.19`, `>=3.2`.
   - Top nganh co ty le dat thap.
   - Top mon tao nhieu luot truot.

3. **Diem nghen**
   - Top 5 mon nghen.
   - Top 5 nganh yeu.
   - Ty trong top 5 mon trong tong fail.

4. **Hanh dong**
   - Giao khoa/nganh mo report chi tiet.
   - Uu tien mon nen tang co nhieu luot truot.
   - Yeu cau cap nhat CLO/PLO neu thieu mapping.

### 3.5 Charts

- Donut: dat vs chua dat.
- Bar: top mon nghen.
- Bar: top nganh yeu.
- GPA distribution.
- Trend line: pass rate qua cac ky.

### 3.6 Drill-down links

- Mon nghen -> `/manager/analytics/courses?course_id=...`
- Nganh yeu -> `/manager/analytics/programs?program_id=...`
- Report ky cu -> `/manager/reports?report=...`

---

## 4. Loai 2: `department_health` - Bao cao khoa

### 4.1 Actor chinh

- Truong khoa.
- Pho khoa phu trach dao tao.
- Quan ly chat luong cap khoa.

### 4.2 Cau hoi can tra loi

- Khoa dang on hay rui ro?
- Nganh nao trong khoa yeu nhat?
- Mon nao keo ket qua cua khoa xuong?
- Rui ro nam o sinh vien, mon nen tang, lop hoc phan hay CLO/PLO?
- Truong khoa can giao viec cho ai?

### 4.3 Du lieu phai dung

Bat buoc:

- `department_name`
- `program_count`
- `course_count`
- `active_students`
- `completed_enrollments`
- `pass_rate`
- `avg_gpa`
- `at_risk_students`
- `risk_level`
- `weak_programs`
- `bottlenecks`

Nen co them:

- `program_stats`
- `gpa_distribution`
- `deep_insights`
- `pass_rate_trend`

### 4.4 Format phan tich

1. **Tong quan khoa**
   - Quy mo sinh vien, so nganh, so mon.
   - Ty le dat va GPA trung binh.
   - So sinh vien GPA < 2.0.

2. **So sanh noi bo nganh**
   - Nganh co ty le dat thap nhat.
   - Nganh co nhieu luot truot nhat.
   - Nganh co co mau qua nho thi can canh bao.

3. **Mon nghen trong khoa**
   - Top mon co fail count cao.
   - Ty trong fail cua top mon.
   - Phan biet mon nen tang va mon chuyen nganh neu co metadata.

4. **Nguyen nhan kha di**
   - Neu fail tap trung vao 1-2 mon: kha nang mon/rubric/lop.
   - Neu fail trai rong nhieu nganh: kha nang nen tang dau vao/chuong trinh.
   - Neu GPA yeu nhieu: can co van hoc tap.

5. **Action plan**
   - Truong khoa giao truong nganh review nganh yeu.
   - Truong bo mon review mon nghen.
   - Giang vien lop yeu trich diem thanh phan.

### 4.5 Charts

- Bar: top mon nghen.
- Bar: top nganh yeu.
- KPI cards: pass rate, GPA, at-risk.
- Trend line neu co lich su.

### 4.6 Drill-down links

- Nganh yeu -> program analytics.
- Mon nghen -> course analytics.
- Trend dot -> report cu.

---

## 5. Loai 3: `program_health` - Bao cao nganh

### 5.1 Actor chinh

- Truong nganh.
- Hoi dong chuong trinh dao tao.
- Quan ly kiem dinh/OBE.

### 5.2 Cau hoi can tra loi

- Nganh co dat muc an toan khong?
- Mon nao la mon nen tang/rui ro?
- PLO nao yeu?
- Sinh vien nguy co co tap trung theo khoa/khoa hoc/lop khong?
- Can dieu chinh chuong trinh, rubric hay ho tro sinh vien?

### 5.3 Du lieu phai dung

Bat buoc:

- `program_name`
- `active_students`
- `completed_enrollments`
- `pass_rate`
- `avg_gpa`
- `at_risk_students`
- `risk_level`
- `bottlenecks`

Nen co them:

- `course_stats`
- `gpa_distribution`
- `plo_attainment`
- `weak_plos`
- `deep_insights`
- `pass_rate_trend`

### 5.4 Format phan tich

1. **Suc khoe nganh**
   - Ty le dat, GPA, so sinh vien, so luot hoc phan.
   - So sinh vien nguy co.

2. **Phan tich theo mon**
   - Mon co ty le dat thap nhat.
   - Mon co nhieu luot truot nhat.
   - Mon co co mau lon thi uu tien hon mon co co mau nho.

3. **PLO/OBE**
   - PLO nao duoi 70/75%.
   - PLO yeu do CLO nao keo xuong.
   - Mon nao lien quan PLO yeu.
   - Neu chua co mapping: can ghi ro thieu ma tran CLO -> PLO.

4. **Nguyen nhan kha di**
   - Mon nen tang yeu -> rui ro tien do hoc ky sau.
   - PLO yeu -> rui ro kiem dinh/OBE.
   - GPA thap nhung pass rate on -> can kiem tra diem sat nguong.

5. **Action plan**
   - Truong nganh review mon nen tang.
   - Bo mon review CLO/PLO mapping.
   - Co van hoc tap tach sinh vien GPA < 2.0.

### 5.5 Charts

- Radar/bar PLO attainment.
- Bar top mon nghen.
- Bar mon theo pass rate.
- GPA distribution.
- Trend line.

### 5.6 Drill-down links

- Mon nghen -> course analytics.
- PLO yeu -> neu chua co trang PLO rieng, link ve program analytics kem query.
- Report ky cu -> report history.

---

## 6. Loai 4: `course_health` - Bao cao mon hoc

### 6.1 Actor chinh

- Truong bo mon.
- Giang vien phu trach mon.
- Truong nganh co mon trong chuong trinh.

### 6.2 Cau hoi can tra loi

- Mon nay co dang la diem nghen khong?
- Lop hoc phan nao yeu bat thuong?
- Giang vien/lop/hoc ky nao can mo sau?
- CLO nao yeu?
- Diem thanh phan nao keo CLO/ket qua xuong?

### 6.3 Du lieu phai dung

Bat buoc:

- `course_code`
- `course_name`
- `credits`
- `section_count`
- `student_count`
- `completed_enrollments`
- `pass_rate`
- `avg_grade`
- `risk_level`
- `weak_sections`

Nen co them:

- `section_stats`
- `grade_distribution`
- `missing_grade_count`
- `clo_attainment`
- `weak_clos`
- `clo_components`
- `deep_insights`
- `pass_rate_trend`

### 6.4 Format phan tich

1. **Toan canh mon**
   - So lop, so sinh vien, so luot da co ket qua.
   - Ty le dat, diem trung binh.
   - Phan bo diem theo band: `<4.0`, `4.0-5.4`, `5.5-6.9`, `7.0-8.4`, `>=8.5`.
   - So luot chua chot diem.

2. **So sanh lop hoc phan**
   - Lop co pass rate thap nhat.
   - Lop co diem TB thap nhat.
   - Lop co co mau du lon va ket qua bat thuong.
   - Giang vien phu trach neu co.

3. **CLO**
   - CLO nao duoi nguong.
   - Gap so voi target.
   - Diem thanh phan nao keo CLO xuong.
   - Neu chua co CLO: action cap nhat mapping.

4. **Nguyen nhan kha di**
   - Nhieu lop cung yeu -> van de mon/de/rubric.
   - Mot lop yeu rieng -> can xem giang vien, lich hoc, sinh vien dau vao.
   - CLO yeu nhung pass rate on -> co the de phu hop qua mon nhung chua phu hop chuan dau ra.

5. **Action plan**
   - Truong bo mon review de/rubric.
   - Giang vien lop yeu trich diem thanh phan.
   - Cap nhat CLO mapping.
   - Mo lop phu dao neu watchlist lon.

### 6.5 Charts

- Bar CLO attainment.
- Bar weak sections.
- Grade distribution.
- Trend line pass rate.

### 6.6 Drill-down links

- Lop yeu -> section analytics.
- CLO yeu -> course analytics.
- Trend dot -> old report.

---

## 7. Loai 5: `section_intervention` - Bao cao can thiep lop hoc phan

### 7.1 Actor chinh

- Giang vien day lop.
- Truong bo mon.
- Co van hoc tap neu co sinh vien nguy co.

### 7.2 Cau hoi can tra loi

- Lop nay co can can thiep ngay khong?
- Sinh vien nao can ho tro?
- Diem yeu nam o giua ky, cuoi ky, chuyen can hay CLO nao?
- Du lieu da du ket luan chua?
- Giang vien can lam gi trong 1-2 tuan toi?

### 7.3 Du lieu phai dung

Bat buoc:

- `section_code`
- `course_name`
- `teacher_name`
- `semester`
- `student_count`
- `graded_count`
- `pass_rate`
- `avg_grade`
- `watchlist_count`
- `risk_level`
- `watchlist`

Nen co them:

- `grade_distribution`
- `missing_grade_count`
- `clo_attainment`
- `clo_components`
- `weak_clos`
- `deep_insights`

### 7.4 Format phan tich

1. **Tinh trang lop**
   - Si so.
   - Da co diem bao nhieu / tong bao nhieu.
   - Ty le hoan tat diem.
   - Neu co mau nho, can canh bao.

2. **Ket qua lop**
   - Ty le dat.
   - Diem trung binh.
   - Phan bo diem.
   - So sinh vien can chu y.

3. **Watchlist**
   - Sinh vien truot.
   - Sinh vien can rui ro.
   - Ly do: khong dat, can rui ro, thieu diem.
   - Khong nen hien qua nhieu; top 20 la du.

4. **CLO va diem thanh phan**
   - CLO nao yeu.
   - Thanh phan nao keo xuong.
   - Bang chung: diem TB / max score, sample.

5. **Can thiep**
   - Giang vien lien he sinh vien trong watchlist.
   - To chuc buoi on tap theo CLO yeu.
   - Ra lai rubric/de neu nhieu sinh vien cung yeu mot thanh phan.
   - Cap nhat diem con thieu.

### 7.5 Charts

- Donut: da co diem / chua co diem / watchlist.
- Bar CLO attainment.
- Bar diem thanh phan theo CLO.
- Grade distribution.

### 7.6 Drill-down links

- Lop -> section analytics.
- Sinh vien -> student analytics neu co route.
- CLO yeu -> section analytics.

---

## 8. Prompt template cho LLM/Agent

LLM khong duoc chi viet summary. Prompt phai yeu cau tra ve JSON co cau truc sau:

```json
{
  "summary": "3-5 cau dieu hanh, co ket luan + so lieu + rui ro + huong xu ly",
  "good_signals": ["cau day du, co bang chung"],
  "issues": ["van de + so lieu + vi sao dang lo"],
  "risks": ["rui ro + he qua neu khong xu ly"],
  "root_causes": [
    {
      "evidence": "dau hieu tu du lieu",
      "hypothesis": "gia thuyet can kiem chung",
      "next_check": "can mo du lieu nao"
    }
  ],
  "deep_insights": [
    {
      "title": "ten insight",
      "finding": "nhan dinh",
      "evidence": "so lieu",
      "action": "hanh dong",
      "href": "/manager/analytics/..."
    }
  ],
  "actions": [
    {
      "owner": "ai phu trach",
      "task": "lam gi",
      "reason": "vi sao",
      "priority": "Cao/Trung binh/Thap",
      "deadline": "7 ngay/30 ngay/cuoi ky",
      "href": "/manager/analytics/..."
    }
  ]
}
```

Neu backend hien tai van luu `actions` la list string, can convert object action thanh cau day du de UI khong vo.

---

## 9. UI format de doc khong nong

Report preview nen theo thu tu:

1. Metadata.
2. Tom tat dieu hanh.
3. Pham vi va do tin cay du lieu.
4. Toan canh ket qua.
5. Phan tich sau tu du lieu.
6. Chart theo report type.
7. Bottleneck / diem nghen.
8. CLO/PLO neu co.
9. Rui ro va root cause.
10. Action plan.
11. Phu luc du lieu.

Khong nen de tat ca trong 3 card ngan. Bao cao phai co table, chart, insight va link.

---

## 10. Definition of Done

Mot report duoc coi la dat chuan khi:

- [ ] Co summary 3-5 cau, khong phai 1 cau.
- [ ] Co it nhat 3 `deep_insights`.
- [ ] Moi insight co bang chung so lieu.
- [ ] Moi diem yeu co link mo sau neu co route.
- [ ] Co phan chat luong du lieu/co mau.
- [ ] Co phan phan bo, khong chi diem trung binh.
- [ ] Co chart meaningful theo report type.
- [ ] Co action plan co owner, viec can lam, uu tien va deadline.
- [ ] Neu thieu CLO/PLO mapping thi noi ro thieu gi va can cap nhat gi.
- [ ] Export markdown/PDF va UI preview dung cung mot logic, khong lech noi dung.

---

## 11. Viec can lam tiep

- Backend: chuan hoa `deep_insights`, `root_causes`, `actions` thanh schema ro rang thay vi string/list tu do.
- Backend: them percentile/median cho diem va GPA neu can phan tich sau hon trung binh.
- Frontend: render `root_causes` thanh bang rieng.
- Frontend: render action object neu backend tra ve owner/priority/deadline.
- Agent: khi nguoi dung hoi "vi sao", uu tien doc `deep_insights`, `root_causes`, `clo_components`, trend va drill-down links.
- Data: bo sung route/student analytics link cho watchlist trong `section_intervention`.
