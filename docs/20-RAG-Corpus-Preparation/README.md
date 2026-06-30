# T49 - RAG Corpus Preparation TODO

> **Sprint 4 pivot:** CTĐT PDF RAG is implemented via **H62 → H63 → H51** in [`ctdt/README.md`](ctdt/README.md). The T49 generic docs corpus below remains legacy backlog.

> Scope: tong hop, lam sach, phan loai, gan access scope va tao manifest tai lieu de ban giao cho `H51 - RAG Retrieval Integration`.
> Status: TODO / chua co corpus hoan chinh. Repo hien da co nhieu tai lieu nguon rai rac trong `docs/`, nhung chua co manifest, chua chuan hoa chunk, chua gan access scope.

## 1. Muc tieu

T49 tao mot bo tai lieu co the dua vao RAG de chatbot tra loi co nguon/citation. Dau ra khong phai la code retrieval, ma la **corpus sach + manifest ro rang** de Hoang tich hop vao H51.

Sau T49, team phai tra loi duoc:

- Tai lieu nao duoc dua vao RAG?
- Tai lieu nao bi loai, vi sao?
- Moi tai lieu thuoc nhom nao: product, analytics, report, agent, data, academic policy, CLO/PLO?
- Ai duoc truy cap tai lieu do theo role/scope?
- Khi chatbot trich dan, no trich dan tu file nao, section nao, version nao?

## 2. Dau ra can co

Thu muc de xuat:

```text
docs/20-RAG-Corpus-Preparation/
  README.md
  manifest.example.json
  source-inventory.csv
  rejected-sources.csv

docs/rag-corpus/
  manifest.json
  product/
  analytics/
  reports/
  agent/
  data-pipeline/
  academic/
  operations/
  rejected/
```

Trong Sprint 3, neu chua kip tao `docs/rag-corpus/` day du thi toi thieu phai co:

- [ ] `source-inventory.csv`: danh sach tai lieu nguon.
- [ ] `manifest.json`: danh sach tai lieu duoc phe duyet cho RAG.
- [ ] `rejected-sources.csv`: tai lieu bi loai va ly do.
- [ ] 5-10 tai lieu uu tien da chuyen ve Markdown/Text sach.
- [ ] Query smoke test: hoi 5 cau va kiem tra citation dung source.

## 3. Du lieu/tai lieu ban giao hien co trong repo

Day la nhom nguon gan nhat voi corpus ban giao cho Hoang. Cac file nay **khong nam trong `docs/` la chinh**, ma nam o root repo, `crawl/` va `backend/db/`.

| Nguon | Vi tri | Noi dung | Trang thai cho T49 |
| --- | --- | --- | --- |
| PDF de cuong mau | `sample_syllabus.pdf` | File de cuong hoc phan mau dung de test extract/tach noi dung. | Co the dua vao MVP sau khi extract text sach. |
| Link PDF CLO/de cuong | `crawl/clo_pdf_urls.json` | Danh sach URL PDF de cuong hoc phan EPU. | Can download/verify lai link, tinh checksum, gan source metadata. |
| CLO da extract backup | `crawl/extracted_clos_backup.json` | Ket qua extract CLO tu PDF backup. | Can review chat luong, map voi course/CLO hien tai, loai duplicate/noisy item. |
| Raw EPU data | `epu_data.json` | Raw data crawl ban dau. | Chi dung de doi chieu/source lineage, khong dua thang vao RAG user-facing. |
| Dataset hoc vu da import | `backend/db/seed-academic-v2.json.gz` | Artifact seed/import du lieu hoc vu quy mo 1,277 sinh vien. | La dataset DB, khong phai document corpus; dung lam source lineage/evidence. |
| Manifest dataset | `backend/db/seed-academic-v2.manifest.json` | Count/checksum: students, enrollments, grade components, specializations. | Nen link trong manifest/evidence T49, khong chunk nhu tai lieu text. |
| Catalog bo sung | `backend/db/supplement-academic-catalog.sql` | SQL bo sung catalog hoc vu/chuyen nganh. | Dung de doi chieu schema/catalog, khong dua thang vao RAG user-facing. |

## 4. Tai lieu tham chieu hien da co trong `docs/`

Bang nay tra loi cau "da co tai lieu tham chieu chua, o dau".

| Nhom | Tai lieu hien co | Vi tri | Trang thai cho RAG | Ghi chu |
| --- | --- | --- | --- | --- |
| Yeu cau san pham | Program requirements | `docs/00-Requirements/ProgramRequirements.md` | Co the dung sau khi tach section | Nen lay cac muc scope, roles, non-functional, agent/RAG yeu cau. |
| Brief/PRD/User stories | Brief, PRD, user stories | `docs/01-Brief/`, `docs/02-PRD/`, `docs/03-User-Stories/` | Can kiem ke chi tiet | Tot cho cau hoi "he thong lam gi", persona, workflow. |
| Sprint planning | Sprint 2/3, H45/H46 evidence | `docs/07-Sprint-Planning/` | Dung co chon loc | Chi dua vao RAG cac contract/evidence con dung; tranh backlog da cu. |
| Academic tree | H45 contract | `docs/07-Sprint-Planning/H45-Plan.md` | Uu tien cao | Nguon chuan cho hierarchy Department -> Program -> Specialization -> Course. |
| Data scale evidence | H46 import evidence | `docs/07-Sprint-Planning/evidence/H46/` | Uu tien vua | Dung cho cau hoi ve seed 1,277 sinh vien va row counts. |
| Backend/data pipeline | Backend material cua Hung | `docs/09-Materials/Hung/README.md` | Can cap nhat truoc khi dua vao RAG | File cu, co thong tin Sprint 2; can tranh noi "ML schema" neu FE da bo ML. |
| Frontend research | Hieu V1 + image assets | `docs/09-Materials/Hieu/V1/V1.md` va `img/` | Can loc | Co ich cho design inspiration, nhung anh khong nen dua vao text RAG tru khi co caption. |
| Architecture | System architecture | `docs/10-References/SystemArchitecture.md` | Uu tien cao | Nguon chuan cho schema, ADR, module boundary. |
| Agent | LangGraph agent guide, flow diagram | `docs/10-References/LangGraphAgent.md`, `docs/10-References/AgentFlowDiagram.md` | Uu tien cao | Dung cho chatbot/agent implementation va RAG planning. |
| Dev/testing | Code style, DevOps, Testing guide | `docs/10-References/CodeStyleGuide.md`, `DevOpsGuide.md`, `TestingGuide.md` | Uu tien thap-vua | Dung cho dev assistant, khong can cho end-user chat neu scope hoc vu. |
| Dashboard | Dashboard analytics guide | `docs/11-Guides/Dashboard-Analysis.md` | Uu tien cao | Nguon chuan cho route analytics, role, metric meaning. |
| Evaluation/CLO | Gate eval, CLO inventory | `docs/12-Evaluation/gate2_eval_report.md`, `docs/12-Evaluation/clo-inventory.md` | Uu tien co dieu kien | CLO inventory la data review, can gan warning "seed tu dong, chua phai CLO chinh thuc". |
| Outcome workflow | Outcome workflow | `docs/14-Outcome-Workflow/README.md` | Uu tien vua | Dung cho workflow CLO/PLO/outcome neu con dung. |
| Implementation TODO | TODO tong | `docs/15-Implementation-TODO/README.md` | Khong nen dua thang vao RAG | De noi bo, de gay nhiu neu chatbot tra loi user. |
| Report center | Report center README | `docs/16-Report-Center/README.md` | Uu tien cao | Nguon chuan cho report UI, report agent, schedule/report workflow. |
| Data pipeline | Data pipeline review | `docs/17-Data-Pipeline/README.md` | Uu tien cao sau khi cap nhat | Nguon chuan cho DWH/ETL/DQ hien co. |
| Report charts | Report charts README | `docs/18-Report-Charts/README.md` | Uu tien cao | Nguon chuan cho report narrative, chart, insight/action. |
| Observability | User behavior observability | `docs/19-User-Behavior-Observability/README.md` | Uu tien cao | Nguon chuan cho session/cookie/event/trace observability. |

## 5. Tai lieu chua co hoac chua du

Nhung tai lieu nay can xin them/tao them truoc khi noi RAG la "day du":

- [ ] Quy che dao tao chinh thuc cua truong/khoa.
- [ ] Chuong trinh dao tao chinh thuc theo nganh/chuyen nganh.
- [ ] CLO/PLO chinh thuc theo mon/nganh, khong phai seed tu dong.
- [ ] Quy dinh canh bao hoc vu, dieu kien qua mon, diem thanh phan.
- [ ] Tai lieu huong dan nghiep vu cho manager/lecturer/viewer.
- [ ] Policy phan quyen: role nao duoc xem du lieu/tai lieu nao.
- [ ] Glossary thuat ngu: Khoa, Nganh, Chuyen nganh, Hoc phan, Lop hoc phan, CLO, PLO, pass rate, health score.

## 6. TODO chi tiet

### Phase 1 - Inventory nguon

- [ ] Quet toan bo `docs/` va lap `source-inventory.csv`.
- [ ] Moi dong inventory gom:
  - `source_id`
  - `path`
  - `title`
  - `owner`
  - `source_type`
  - `domain`
  - `status`
  - `notes`
- [ ] Danh dau tai lieu:
  - `usable`: dua vao corpus duoc
  - `needs_cleanup`: can lam sach/cap nhat
  - `internal_only`: chi dung noi bo, khong cho chatbot end-user
  - `rejected`: loai

### Phase 2 - Lam sach va chuan hoa

- [ ] Chuyen cac tai lieu duoc chon ve Markdown/Text co heading ro.
- [ ] Sua encoding loi neu co.
- [ ] Xoa noi dung trung lap, header/footer lap lai, TODO cu khong con dung.
- [ ] Them title va summary ngan o dau moi file.
- [ ] Them section id on dinh cho citation, vi du `# report-agent`, `## schedule-workflow`.
- [ ] Voi file qua dai, tach thanh nhieu file nho theo domain.

Quy tac loai:

- [ ] Loai anh neu khong co caption text.
- [ ] Loai checklist backlog da cu neu de chatbot tra loi sai trang thai hien tai.
- [ ] Loai secret, token, env, URL private, thong tin ca nhan.
- [ ] Loai raw data co MSSV/ten sinh vien neu chua co ly do va scope bao mat.

### Phase 3 - Metadata va manifest

Tao `docs/rag-corpus/manifest.json` theo schema toi thieu:

```json
{
  "corpus_version": "2026-06-22-t49-mvp",
  "documents": [
    {
      "id": "dashboard-analysis-guide",
      "title": "Dashboard Analytics Guide",
      "path": "docs/rag-corpus/analytics/dashboard-analysis.md",
      "source_path": "docs/11-Guides/Dashboard-Analysis.md",
      "type": "guide",
      "domain": "analytics",
      "scope_type": "school",
      "scope_id": null,
      "access_roles": ["superadmin", "admin", "manager", "lecturer", "viewer"],
      "status": "usable",
      "version": "2026-06-22",
      "owner": "Hung",
      "citation_label": "Dashboard Analytics Guide",
      "tags": ["dashboard", "analytics", "role", "metric"]
    }
  ]
}
```

Bat buoc moi document co:

- [ ] `id`
- [ ] `title`
- [ ] `path`
- [ ] `source_path`
- [ ] `type`
- [ ] `domain`
- [ ] `scope_type`
- [ ] `access_roles`
- [ ] `status`
- [ ] `citation_label`

### Phase 4 - Access scope/RBAC

Gan access scope theo quy tac:

| Scope | Ai duoc xem | Vi du |
| --- | --- | --- |
| `public` | moi role da login | glossary, huong dan UI chung |
| `school` | superadmin, admin, manager, viewer tuy noi dung | dashboard overview, report center guide |
| `department` | manager/viewer cung khoa, admin/superadmin | tai lieu khoa, report khoa |
| `program` | role co scope chuong trinh/nganh | CTDT nganh, PLO nganh |
| `course` | lecturer/manager/admin co quyen voi mon | CLO mon, lop hoc phan |
| `internal` | dev/admin noi bo | architecture, DevOps, TODO, implementation notes |

TODO:

- [ ] Gan `access_roles` cho tung tai lieu.
- [ ] Neu tai lieu co scope cu the, gan `scope_type` va `scope_id`.
- [ ] Neu chua ro scope, de `internal_only` thay vi dua thang vao RAG user-facing.
- [ ] Dam bao lecturer khong lay duoc tai lieu/ngu canh ngoai scope.

### Phase 5 - Chunking/citation contract

Quy tac chunk de H51 dung:

- [ ] Chunk theo heading Markdown truoc, khong cat ngang bang neu tranh duoc.
- [ ] Muc tieu 700-1,200 tokens/chunk.
- [ ] Overlap 100-150 tokens neu section dai.
- [ ] Moi chunk phai co:
  - `document_id`
  - `chunk_id`
  - `heading_path`
  - `source_path`
  - `citation_label`
  - `access_roles`
  - `scope_type`
  - `tags`
- [ ] Citation hien thi cho user nen gom title + section + file/source.

### Phase 6 - Handoff cho H51

Ban giao cho Hoang:

- [ ] `manifest.json`.
- [ ] Thu muc corpus da lam sach.
- [ ] `rejected-sources.csv`.
- [ ] 5 cau test RAG + expected source.
- [ ] Danh sach can bo sung tu truong/khoa.

Test smoke:

| Cau hoi test | Expected source |
| --- | --- |
| Academic Tree hien gom cac cap nao? | `H45-Plan.md` hoac corpus academic tree |
| Dashboard analytics gom nhung route nao? | `Dashboard-Analysis.md` |
| Report Center tao bao cao nhu the nao? | `16-Report-Center/README.md` |
| Observability log nhung event nao? | `19-User-Behavior-Observability/README.md` |
| CLO inventory co phai CLO chinh thuc khong? | `12-Evaluation/clo-inventory.md` voi warning |

## 7. Uu tien tai lieu dua vao corpus MVP

Thu tu nen lam truoc:

1. `docs/07-Sprint-Planning/H45-Plan.md`
2. `docs/11-Guides/Dashboard-Analysis.md`
3. `docs/16-Report-Center/README.md`
4. `docs/18-Report-Charts/README.md`
5. `docs/19-User-Behavior-Observability/README.md`
6. `docs/17-Data-Pipeline/README.md`
7. `docs/10-References/SystemArchitecture.md`
8. `docs/10-References/LangGraphAgent.md`
9. `docs/12-Evaluation/clo-inventory.md`
10. `docs/07-Sprint-Planning/evidence/H46/H46-import-report.md`

## 8. Definition of Done cho T49

- [ ] Co inventory day du tai lieu hien co trong repo.
- [ ] Co danh sach tai lieu bi loai va ly do.
- [ ] Co corpus MVP da lam sach trong `docs/rag-corpus/`.
- [ ] Co `manifest.json` dung schema.
- [ ] Moi document co access scope va citation label.
- [ ] Khong dua secret/PII/raw student data vao corpus.
- [ ] Co 5 cau smoke test voi expected citation.
- [ ] Hoang co the dung corpus de lam `H51` ma khong phai doan source nao dung/source nao bo.
