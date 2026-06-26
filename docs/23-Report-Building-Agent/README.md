# 23. Report-Building Agent

## 1. Muc tieu

Nguoi dung co mot cua so hoi thoai duy nhat: Global Chat. Khi nhan ra yeu cau tao bao cao, he thong chuyen cuoc hoi thoai sang capability `build_report`, khong mo them chatbot rieng trong trang Bao cao.

Agent khong tu y tao, gui, xuat, hoac giao viec. Agent chi co the:

1. hieu yeu cau va bo sung thong tin bat buoc;
2. tim scope ma actor duoc phep xem;
3. xem truoc du lieu va chat luong du lieu;
4. tao ban nhap report definition;
5. yeu cau xac nhan ro rang truoc moi thao tac ghi;
6. tra ve report snapshot, deep link va audit trail sau khi duoc xac nhan.

## 2. Actor va report mac dinh

| Actor | Yeu cau thuong gap | Scope mac dinh | Output uu tien |
|---|---|---|---|
| Giang vien | Bao cao can thiep lop, giua ky, diem thieu | Lop duoc phan cong, ky hien tai | Watchlist, tien do cham diem, action plan |
| Co van | Bao cao nhom SV nguy co | SV/lop phu trach | Danh sach lien he va canh bao |
| Truong nganh | Suc khoe nganh, CLO/PLO, mon nghen | Nganh cua minh | Xu huong, mon/lop can dao sau |
| Truong khoa | Tong hop khoa, don vi can xu ly | Khoa cua minh | Nganh yeu, tien do xu ly |
| BGH/Superadmin | Tong quan truong, ngoai le lon | Toan truong | Executive summary, drill-down |
| Dam bao chat luong | Minh chung kiem dinh | Nganh/CTDT duoc giao | PLO/CLO, provenance, snapshot bat bien |

Frontend co the goi y scope, nhung backend la noi quyet dinh scope cuoi cung.

## 3. Mot report co hai doi tuong

```text
ReportDefinition (ban nhap co the thay doi)
  audience, purpose, report_type, scope, period, sections, comparison

ReportSnapshot (bat bien sau khi tao)
  definition_version, source_cutoff, metrics, data_quality, content, provenance
```

`ReportDefinition` la y dinh nguoi dung. `ReportSnapshot` la bang chung cua mot thoi diem. Khong bao gio tinh lai va ghi de len snapshot cu khi dashboard thay doi.

### Bao cao tuy chinh

Nam report design mac dinh la catalog capability, khong phai danh sach gioi han. Bao cao tuy chinh luu them `custom_request`, `audience`, `decision`, `questions`, `comparison`, `requested_visuals` va `requested_sections` trong definition. Agent phai thu thap brief truoc khi tao plan:

1. ai doc va quyet dinh nao can dua ra;
2. pham vi du lieu va quyen truy cap;
3. ky hoc/khoang thoi gian va moc snapshot;
4. cau hoi, KPI va nguong can theo doi;
5. baseline de so sanh;
6. visual/bang can hien thi va dinh dang dau ra.

Agent chi duoc compose tu visual registry va metric registry da duoc phep. "Tuy chinh" khong co nghia la tao SQL tuy y hoac truy cap du lieu ngoai scope. Neu yeu cau khong co metric/visual tuong ung, agent phai noi ro va de xuat dashboard/tool can bo sung.

## 4. Report build context

Global Chat, trang Bao cao va cac dashboard dung chung contract sau:

```json
{
  "source": "global_chat | report_page | dashboard",
  "report_id": "optional-snapshot-id",
  "scope": {
    "scope_type": "school | department | program | course | section",
    "scope_id": "optional-id"
  },
  "semester_id": 123,
  "period": { "from": "2026-01-01", "to": "2026-06-30" },
  "filters": { "risk": "fail", "grade_bucket": "missing" },
  "drill_down": { "metric": "pass_rate", "route": "/manager/analytics/sections" }
}
```

Context chi duoc tin sau khi backend kiem tra lai permission va scope. Deep link sang dashboard mang `report_id` va filter; dashboard hien chip "Dang xem tu bao cao ..." va Global Chat nhan cung context nay.

## 5. Tool contract

| Tool | Muc dich | Read/Write | Xac nhan |
|---|---|---:|---:|
| `resolve_report_request` | Rut report type, audience, scope, ky va muc dich tu ngon ngu tu nhien | Read | Khong |
| `list_allowed_scopes` | Tim khoa/nganh/mon/lop trong scope actor | Read | Khong |
| `preview_report_data` | Dem mau, diem tong ket/tam, du lieu thieu, metrics san sang | Read | Khong |
| `compare_report_periods` | So ky truoc/cung ky nam truoc/nguong muc tieu | Read | Khong |
| `draft_report_definition` | Tao definition chua luu | Read | Khong |
| `render_report_outline` | Tao de cuong va section tu definition | Read | Khong |
| `create_report_snapshot` | Tinh metrics, luu snapshot bat bien | Write | Bat buoc |
| `create_report_action` | Tao viec can thiep gan voi insight | Write | Bat buoc |
| `schedule_report` | Tao/cap nhat lich bao cao | Write | Bat buoc |
| `export_report` | Tao PDF/XLSX tu snapshot da chot | Write | Bat buoc neu gui/luu ra ngoai |

Moi tool call ghi `report_agent_tool_calls`: input da redact, output tom tat, latency, actor, report/session context va ket qua permission check.

## 6. Luong hoi thoai

```text
User: "Lam bao cao lop X ve diem giua ky"
  -> router: build_report
  -> resolve_report_request
  -> list_allowed_scopes (chi lop actor duoc phep)
  -> preview_report_data
  -> agent tra loi: scope, so SV, ty le co diem, canh bao chat luong
  -> draft_report_definition + render_report_outline
  -> UI hien preview va nut "Tao snapshot"
  -> user xac nhan
  -> create_report_snapshot
  -> tra ve report_id, deep links, action candidates
```

Agent chi hoi lai khi thieu thong tin lam thay doi y nghia: scope, ky/period, hoac kieu so sanh. Neu actor co scope mac dinh ro rang, agent phai de xuat mac dinh truoc thay vi hoi mot chuoi select.

## 7. Data quality gate

Truoc khi xac nhan tao snapshot, `preview_report_data` phai tra ve:

- co mau: tong SV/enrollment, so lop, so ky;
- do day du: diem tong ket, diem tam, chua co diem;
- moc du lieu: `source_cutoff_at`, latest event/grade update;
- canh bao mau nho, du lieu cham tre, scope trong, so sanh khong tuong thich;
- cach tinh cua metric chinh.

Agent khong duoc viet ket luan manh neu mau nho hoac du lieu chua chot. Noi dung report phai hien nhan "tam tinh" neu dung diem giua ky/dau diem.

## 8. API bo sung

```text
POST /api/v1/report-agent/build/plan
  input: message + ReportBuildContext
  output: extracted request, missing_fields, allowed options, data preview, draft definition

POST /api/v1/report-agent/build/confirm
  input: plan_id + approved definition
  output: immutable report snapshot + deep links + audit id

POST /api/v1/report-agent/actions/confirm/{action_id}
  input: confirm | cancel
  output: task/schedule/export result
```

`/build/plan` khong ghi report. `/build/confirm` kiem tra permission, freshness, scope va definition hash mot lan nua truoc khi ghi.

## 9. Global Chat UX

- Global Chat hien badge ngu canh: `Dang tao bao cao lop X - HK 2025-2`.
- Khi co plan, hien mot panel nho trong chat: scope, ky, du lieu su dung, canh bao, outline, va nut xac nhan.
- Sau khi tao, chat tra ve cac deep link co filter san: "Xem lop", "Xem roster nguy co", "Xem mon".
- Khi nguoi dung mo deep link, Global Chat giu thread id va cap nhat page context; khong mo mot chat moi.
- Mot nut "Quay lai plan bao cao" chi hien khi thread co plan dang mo.

## 10. Trang thai hien tai va thu tu build

Da co:

- Global Chat dung chung toan app.
- Report agent co session, memory, tool audit, pending action va confirmation.
- Tool doc snapshot, xu huong, metric trace, action suggestion; tool ghi task/schedule/send co confirmation.
- Trang Report da bo floating chatbot rieng.
- `POST /api/v1/report-agent/build/plan` tao report definition co kiem tra scope/quyen va pending action `create_report_snapshot`.
- Global Chat nhan yeu cau co dong tu tao/lap/lam/sinh bao cao, hien plan va nut xac nhan; confirm tao report snapshot va deep link den report vua sinh.
- `create_report_snapshot` duoc thuc thi trong confirmation path, khong phai plan path. Test xac nhan plan chua tao snapshot da duoc them.

Can build tiep:

1. Them resolve ten khoa/nganh/mon/lop tu ngon ngu tu nhien, chi tra ve option nam trong scope actor.
2. Nang `preview_report_data` thanh preview co mau, diem tong ket/tam, do day du va canh bao mau nho truoc confirmation.
3. Them definition hash va expiry cho plan de tranh xac nhan mot plan qua han.
4. Gan ReportBuildContext vao dashboard deep links va Global Chat khi filter thay doi trong UI, khong chi query string.
5. Them `ReportAction` lifecycle: owner, due date, status, outcome, audit.
6. Them test RBAC, snapshot immutability, confirmation, redact log va deep-link context.
