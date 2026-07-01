# T54 - UI Data Gap Audit

> Date: 29/06/2026
> Owner: Hung
> Output: route/page data gaps -> T55a-e, V59, H49

## 1. Summary

Audit da bat Docker backend/db va smoke API bang cac account seed:

| Role | Email | Smoke |
|:--|:--|:--|
| superadmin | `superadmin@epu.edu.vn` | OK |
| admin | `admin@epu.edu.vn` | OK |
| manager | `manager@epu.edu.vn` | OK |
| lecturer | `lecturer@epu.edu.vn` | OK |

Ket luan ngan gon:

| Muc thieu | Bang chung | Can bo sung ngay |
|:--|:--|:--|
| Dropout prediction chua co | `ml.model_run=0`, `ml.student_dropout_prediction=0`; MSSV `21810310019` prediction API 404 | **T55a** train/score dropout |
| Lecturer student/homeroom page rong | lecturer `/homeroom/classes` tra `0` | **T55b** gan homeroom/section cho lecturer demo |
| Section gan GV qua it | `sections=5891`, `sections_with_teacher=28` | **T55b** synthetic GV + section assignment |
| Nhieu nganh khong co/qua it SV | `25/38` programs co `<10` active students | **V59 -> T55c** crawl/import bo sung SV nganh thua |
| Report Center rat mong | manager `/reports?limit=80` chi tra `1` report | **T55d/T55e** bo sung CLO/lineage va refresh golden/report evidence |
| CLO van can lineage | `student_clo_achievements=108789` nhung `4/549` courses thieu CLO evidence; CLO seed unofficial | **T55d** ghi source/lineage + synthetic warning |
| Chat data-access chua ro scope | dropout 404, CTDT RAG da co MVP sau H51, CLO lineage chua chot | **H49** capability matrix; **H51 done** cho CTDT Q&A 3 nganh MVP |

## 2. Manifest baseline

Source: `backend/db/seed-academic-v2.manifest.json`

| Field | Count |
|:--|--:|
| `unique_students` | 1,277 |
| `courses` | 549 |
| `enrollments` | 56,301 |
| `grade_components` | 147,286 |
| `specializations` | 26 |
| `class_mappings` | 80 |

Manifest tong co du lieu lon, nhung smoke cho thay du lieu phan bo khong deu theo route demo.

## 3. Routes empty/thin

| Page/route | Smoke/API | Trang thai | Thieu gi | Task |
|:--|:--|:--|:--|:--|
| `/manager/analytics/students` | lecturer `GET /homeroom/classes` -> `0` | **EMPTY** | Lecturer demo khong co lop chu nhiem/homeroom class | **T55b** |
| `/manager/analytics/students/[studentId]` | student demo co id `110`; dropout API -> `404` | **BROKEN for dropout demo** | Chua co ML dropout prediction persisted | **T55a** |
| `/chat` - hoi dropout MSSV `21810310019` | prediction API -> `404`; eval TC28 partial | **BROKEN for dropout Q&A** | Chua train/score dropout batch | **T55a**, H49 |
| `/manager/analytics/programs` | DB: `25/38` programs `<10` active students | **THIN/EMPTY for many programs** | Nhieu nganh 0 SV hoac qua it SV de hien heatmap/trend | **V59 -> T55c** |
| `/manager/analytics` | overview OK: `1157` active students, `38` programs | **OK overall, but program rows thin** | Program list co nhieu nganh rong, can chon/bo sung nganh demo | **V59 -> T55c** |
| `/manager/analytics/sections` | lecturer sees `8` sections, `10` enrollments | **THIN** | Lop cua lecturer qua it; section assignment coverage thap | **T55b**, T56a |
| `/manager/sections` | manager sees `311` sections; DB only `28/5891` sections have teacher | **THIN assignment data** | Thieu `sections.teacher_id` tren phan lon section | **T55b** |
| `/manager/teachers` | manager sees `3` teachers; DB has `8` teachers | **THIN** | Can them/gan GV demo theo khoa/nganh/section | **T55b**, T57a |
| `/manager/grades` | lecturer sees `10` enrollments | **THIN for lecturer demo** | Enrollment trong scope lecturer qua it | **T55b** |
| `/manager/reports` | manager gets `1` report | **THIN** | It report seed/evidence; report CLO/PLO can yeu lineage | **T55d**, T55e |
| `/manager/analytics/courses` | API OK; DB `4/549` courses missing CLO evidence | **MOSTLY OK, CLO gap** | 4 course thieu CLO evidence; `course_group` chua official | **T55d** |
| `/manager/observability` | superadmin sessions `235`, events `4248` | **OK** | Khong phai data gap T55 | H59/D58 |
| `/manager` | tree OK: manager root `student_count=162` | **OK in manager scope** | Van bi anh huong neu drill vao nganh rong | V59/T55c |
| `/manager/students` | manager gets `142` students | **OK in manager scope** | Filter theo nganh rong se trong | V59/T55c |

## 4. Program gaps for V59/T55c

DB smoke:

- `25/38` programs co `<10` active students.
- Nhieu program co `0` active students.

Top program rong/mong can V59 audit va T55c bo sung:

| Program code | Program name | Active students |
|:--|:--|--:|
| `7220201` | Ngon ngu Anh | 0 |
| `7340115` | Marketing | 0 |
| `7340120` | Kinh doanh quoc te | 0 |
| `7340205` | Cong nghe tai chinh | 0 |
| `7340301` | Ke toan | 0 |
| `7380107` | Luat kinh te | 0 |
| `7460108` | Khoa hoc du lieu | 0 |
| `7460117` | Toan tin | 0 |
| `7480102` | Mang may tinh va truyen thong du lieu | 0 |
| `7480106` | Ky thuat may tinh | 0 |

Can bo sung ngay:

- V59 liet ke day du program `<10` active students.
- V59 chon nganh demo uu tien.
- T55c import/crawl bo sung sao cho nganh demo co toi thieu `>=10` active students va co enrollment du de heatmap/trend khong rong.

## 5. T55 mapping

| Task | Gap can xu ly | Viec can lam ngay | Acceptance smoke |
|:--|:--|:--|:--|
| **T55a** | Dropout prediction rong | Train dropout model neu chua co; batch score active students; persist `ml.student_dropout_prediction` | MSSV `21810310019` co prediction; `/predictions/students/{id}/dropout-risk` tra 200 |
| **T55b** | Lecturer/GV/section/homeroom thieu | Tao/bo sung GV demo; gan `sections.teacher_id`; gan homeroom class cho lecturer demo; dam bao lecturer co data | Lecturer login thay class o `/manager/analytics/students`; thay sections/enrollments du demo |
| **T55c** | Nganh thua SV | Nhan artifact V59; import/crawl bo sung SV; dedupe theo MSSV; chay ETL | Nganh demo `>=10` active students; analytics program heatmap/list khong rong |
| **T55d** | CLO evidence/lineage | Xu ly 4 course thieu CLO evidence; neu synthetic thi deterministic va gan source; them warning unofficial | Course analytics/report khong im lang khi CLO synthetic/missing |
| **T55e** | Golden drift | Sau T55a-d, refresh expected values va lineage manifest | H61/H60 eval dung data moi, khong dung golden cu |

## 6. H49 handoff

Chatbot scope can chot nhu sau:

| Intent | Trang thai data | Policy |
|:--|:--|:--|
| Dropout risk tung SV | **Chua san sang** vi prediction 404 | Chi tra khi co ML prediction; khong suy doan |
| GPA/pass/fail/top mon truot | Co DWH/analytics data | Cho phep, nhung neu sample nho phai noi ro |
| CLO/PLO | Co `student_clo_achievements`, nhung lineage chua chot | Cho phep kem warning synthetic/unofficial sau T55d |
| CTDT/CDR/chuan dau ra chinh thuc | H51 da co CTDT RAG MVP cho CNTT/KHDL/TTNT | Tra loi bang `search_ctdt_program_info` kem citation file/trang/section; nganh ngoai MVP tu choi mem |
| Cross-scope student lookup | Can RBAC/context | Tu choi neu ngoai scope |

## 7. Done / not done

Done:

- [x] Doi chieu seed manifest.
- [x] Smoke backend API voi 4 role.
- [x] Liet ke route empty/thin.
- [x] Map gap sang T55a-e, V59, H49.

Chua lam trong T54:

- [ ] Chua crawl/import/seed bo sung. Day la T55.
- [ ] Chua browser screenshot visual. Neu can screenshot cho Demo Day thi V57/V58 chay them frontend visual smoke.

## 8. Post-H51 update (01/07/2026)

- CTDT RAG khong con la data-access blocker cho 3 nganh MVP: Cong nghe thong tin, Khoa hoc du lieu, Tri tue nhan tao.
- Universal Chat da co tool `search_ctdt_program_info` voi citation file/trang/section.
- Nganh ngoai MVP van bi tu choi mem; H61 can them eval case cho ca answer co citation va unsupported program.
