"""Deterministic AI-side guardrails for EduInsight chat and report agents (H40)."""

from __future__ import annotations

import re
import unicodedata
from typing import Literal

InputDecision = Literal["ok", "injection", "out_of_domain", "unsafe", "privacy"]


def _normalize_guardrail_text(text: str) -> str:
    """Fold Vietnamese diacritics for stable regex guards across NFC/NFD input."""
    value = unicodedata.normalize("NFD", text)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    replacements = {
        "à": "a", "á": "a", "ạ": "a", "ả": "a", "ã": "a",
        "â": "a", "ầ": "a", "ấ": "a", "ậ": "a", "ẩ": "a", "ẫ": "a",
        "ă": "a", "ằ": "a", "ắ": "a", "ặ": "a", "ẳ": "a", "ẵ": "a",
        "è": "e", "é": "e", "ẹ": "e", "ẻ": "e", "ẽ": "e",
        "ê": "e", "ề": "e", "ế": "e", "ệ": "e", "ể": "e", "ễ": "e",
        "ì": "i", "í": "i", "ị": "i", "ỉ": "i", "ĩ": "i",
        "ò": "o", "ó": "o", "ọ": "o", "ỏ": "o", "õ": "o",
        "ô": "o", "ồ": "o", "ố": "o", "ộ": "o", "ổ": "o", "ỗ": "o",
        "ơ": "o", "ờ": "o", "ớ": "o", "ợ": "o", "ở": "o", "ỡ": "o",
        "ù": "u", "ú": "u", "ụ": "u", "ủ": "u", "ũ": "u",
        "ư": "u", "ừ": "u", "ứ": "u", "ự": "u", "ử": "u", "ữ": "u",
        "ỳ": "y", "ý": "y", "ỵ": "y", "ỷ": "y", "ỹ": "y",
        "đ": "d",
    }
    lower = value.lower()
    return "".join(replacements.get(char, char) for char in lower)

OUT_OF_DOMAIN_REFUSAL = (
    "Xin lỗi, câu hỏi này nằm ngoài phạm vi dữ liệu học vụ mà tôi có thể hỗ trợ. "
    "Bạn có thể hỏi về GPA, môn học, ngành/chuyên ngành hoặc báo cáo học tập."
)

INJECTION_REFUSAL = (
    "Xin lỗi, tôi không thể thực hiện yêu cầu đó. "
    "Tôi chỉ hỗ trợ phân tích học vụ VinUni — hãy đặt câu hỏi về điểm số, sinh viên hoặc báo cáo."
)

SAFETY_REFUSAL = (
    "Xin lỗi, tôi không thể hỗ trợ yêu cầu có thể gây hại hoặc vi phạm an toàn. "
    "Bạn có thể hỏi về thống kê học tập, nguy cơ dropout (ML) hoặc báo cáo học vụ."
)

PRIVACY_REFUSAL = (
    "Xin lỗi, tôi không thể tiết lộ thông tin nhạy cảm như API key, mật khẩu hoặc credential hệ thống. "
    "Bạn có thể hỏi về dữ liệu học vụ trong phạm vi quyền của mình."
)

INSUFFICIENT_DATA_TEMPLATE = (
    "Tôi chưa đủ dữ liệu để trả lời chính xác. Không tìm thấy dữ liệu phù hợp trong hệ thống. "
    "Vui lòng kiểm tra lại tên môn, ngành hoặc mã sinh viên."
)

_ACADEMIC_KEYWORDS = re.compile(
    r"\b("
    r"gpa|môn|mon|ngành|nganh|chuyên ngành|chuyen nganh|sinh viên|sinh vien|"
    r"khóa|khoa|học kỳ|hoc ky|clo|plo|dropout|điểm|diem|enrollment|"
    r"báo cáo|bao cao|cntt|trượt|truot|pass|cohort|k21|k22|học vụ|hoc vu"
    r")\b",
    re.IGNORECASE,
)

_SUBSTANTIVE_ACADEMIC_KEYWORDS = re.compile(
    r"\b("
    r"gpa|môn|mon|ngành|nganh|chuyên ngành|sinh viên|clo|plo|dropout|"
    r"điểm|diem|báo cáo|cntt|cohort|k21|k22|học vụ"
    r")\b",
    re.IGNORECASE,
)

_INJECTION_PATTERNS = re.compile(
    r"("
    r"ignore\s+(all\s+)?previous\s+instructions"
    r"|bỏ\s+qua.*hướng\s+dẫn"
    r"|reveal\s+(the\s+)?system\s+prompt"
    r"|print\s+(the\s+)?(database\s+)?schema"
    r"|liệt\s+kê.*bảng.*database"
    r"|list\s+all\s+table"
    r"|jailbreak|dan\s+mode"
    r"|drop\s+table"
    r"|ignore\s+rules"
    r")",
    re.IGNORECASE | re.DOTALL,
)

_OUT_OF_DOMAIN_PATTERNS = re.compile(
    r"("
    r"cổ\s+phiếu|chứng\s+khoán|stock\s+price|vingroup"
    r"|thời\s+tiết|weather"
    r"|email\s+marketing|viết\s+email\s+marketing"
    r"|khóa\s+học\s+online(?!\s+học\s+vụ)"
    r")",
    re.IGNORECASE,
)

_STRONG_OUT_OF_DOMAIN_PATTERNS = re.compile(
    r"(email\s+marketing|viết\s+email\s+marketing|cổ\s+phiếu|chứng\s+khoán|thời\s+tiết|weather|vingroup|stock\s+price)",
    re.IGNORECASE,
)

_UNSAFE_PATTERNS = re.compile(
    r"("
    r"\bmalware\b|\bhack\b|tấn\s+công\s+(?!học\s+vụ)"
    r"|cách\s+làm\s+súng|chế\s+tạo\s+vũ\s+khí"
    r"|hướng\s+dẫn.*tấn\s+công\s+sql\s+injection"
    r"|khai\s+thác\s+lỗ\s+hổng\s+sql"
    r"|lừa\s+đảo|phishing\s+script"
    r")",
    re.IGNORECASE,
)

_UNSAFE_PATTERNS_ASCII = re.compile(
    r"("
    r"\bmalware\b|\bhack\b|tan\s+cong\s+(?!hoc\s+vu)"
    r"|cach\s+lam\s+sung|che\s+tao\s+vu\s+khi"
    r"|huong\s+dan.*tan\s+cong\s+sql\s+injection"
    r"|khai\s+thac\s+lo\s+hong\s+sql"
    r"|lua\s+dao|phishing\s+script"
    r")",
    re.IGNORECASE,
)

_PRIVACY_EXFIL_PATTERNS = re.compile(
    r"("
    r"\bapi\s*key\b|\bopenai_api_key\b|\bjwt\s+secret\b"
    r"|tiết\s+lộ.*credential|in\s+ra.*secret"
    r"|mật\s+khẩu.*backend|password.*hệ\s+thống"
    r")",
    re.IGNORECASE,
)

_SCHEMA_PATTERNS = re.compile(
    r"(?:"
    r"`?(?:students|enrollments|sections|courses|programs|cohorts|"
    r"departments|universities|teachers|clos|plos|semesters|"
    r"student_clo_achievements|program_courses|specializations|"
    r"specialization_courses|vw_\w+)`?"
    r"(?:\.\w+)?"
    r"|\b(?:SELECT|FROM|JOIN|WHERE|GROUP BY|ILIKE)\b"
    r"|COUNT\(|SUM\(|AVG\("
    r"|status\s*=\s*['\"]completed['\"]"
    r")",
    re.IGNORECASE,
)

_EMAIL_PATTERN = re.compile(
    r"\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b"
)

_SK_KEY_PATTERN = re.compile(r"\bsk-[a-zA-Z0-9]{8,}\b")

_UNFOUNDED_CLAIM_PATTERN = re.compile(
    r"chắc\s+chắn\s+100\s*%|100\s*%\s+sinh\s+viên",
    re.IGNORECASE,
)

_REFUSAL_BY_KIND: dict[str, str] = {
    "scope": OUT_OF_DOMAIN_REFUSAL,
    "out_of_domain": OUT_OF_DOMAIN_REFUSAL,
    "injection": INJECTION_REFUSAL,
    "unsafe": SAFETY_REFUSAL,
    "safety": SAFETY_REFUSAL,
    "privacy": PRIVACY_REFUSAL,
}


def is_prompt_injection(text: str) -> bool:
    """Return True when the user message looks like a prompt-injection attempt."""
    return bool(_INJECTION_PATTERNS.search(text.strip()))


def is_out_of_domain(text: str) -> bool:
    """Return True when the message is clearly outside academic analytics scope."""
    normalized = text.strip()
    if not normalized:
        return False
    if re.search(r"email\s+marketing|viết\s+email\s+marketing", normalized, re.IGNORECASE):
        return True
    has_substantive_academic = bool(_SUBSTANTIVE_ACADEMIC_KEYWORDS.search(normalized))
    has_off_domain = bool(_STRONG_OUT_OF_DOMAIN_PATTERNS.search(normalized))
    if has_substantive_academic and has_off_domain:
        return False
    if has_off_domain:
        return True
    if _ACADEMIC_KEYWORDS.search(normalized) and not is_prompt_injection(normalized):
        return False
    return bool(_OUT_OF_DOMAIN_PATTERNS.search(normalized))


def is_unsafe_request(text: str) -> bool:
    """Return True for harmful or abusive instruction requests."""
    raw = text.strip()
    normalized = _normalize_guardrail_text(text)
    if not raw:
        return False
    if re.search(
        r"phòng\s+chống|bảo\s+mật\s+học\s+vụ|an\s+toàn\s+thông\s+tin",
        raw,
        re.IGNORECASE,
    ) or re.search(
        r"phong\s+chong|bao\s+mat\s+hoc\s+vu|an\s+toan\s+thong\s+tin",
        normalized,
        re.IGNORECASE,
    ):
        return False
    return bool(_UNSAFE_PATTERNS.search(raw)) or bool(_UNSAFE_PATTERNS_ASCII.search(normalized))


def is_privacy_exfil_request(text: str) -> bool:
    """Return True when the user asks to reveal secrets or private credentials."""
    return bool(_PRIVACY_EXFIL_PATTERNS.search(text.strip()))


def classify_input(text: str) -> InputDecision:
    """Classify inbound user text for deterministic short-circuit handling."""
    normalized = text.strip()
    if not normalized:
        return "ok"
    if is_prompt_injection(normalized):
        return "injection"
    if is_privacy_exfil_request(normalized):
        return "privacy"
    if is_unsafe_request(normalized):
        return "unsafe"
    if is_out_of_domain(normalized):
        return "out_of_domain"
    return "ok"


def build_refusal(kind: str, *, offer_alternative: bool = True) -> str:
    """Build a short refusal message without procedural steps."""
    message = _REFUSAL_BY_KIND.get(kind, OUT_OF_DOMAIN_REFUSAL)
    if not offer_alternative:
        # Strip the alternative sentence (after first period following boundary explanation).
        parts = message.split(". ", 1)
        if len(parts) > 1 and any(kw in parts[1].lower() for kw in ("bạn có thể", "hãy đặt", "bạn có thể hỏi")):
            return parts[0] + "."
    return message


def build_role_guardrail_block(context: dict) -> str:
    """Inject server-authoritative role constraints into the system prompt."""
    role = context.get("user_role") or "unknown"
    dept = context.get("department_scope") or context.get("department_id")
    lines = [
        "\n# Role-bound data policy (H40)",
        f"- Vai trò hiện tại: `{role}`.",
        "- Chỉ trả lời trong phạm vi quyền của vai trò này; không tiết lộ dữ liệu ngoài phạm vi.",
    ]
    if dept is not None:
        lines.append(f"- Phạm vi khoa (department_scope): `{dept}`.")
    lines.append("- Không tiết lộ thông tin nhạy cảm vượt quá quyền người dùng.")
    return "\n".join(lines)


def mask_pii_in_output(text: str) -> str:
    """Mask emails and API key patterns in agent output."""
    if not text:
        return text

    def _mask_email(match: re.Match[str]) -> str:
        first_char = match.group(1)
        domain = match.group(2)
        return f"{first_char}***@{domain}"

    masked = _EMAIL_PATTERN.sub(_mask_email, text)
    masked = _SK_KEY_PATTERN.sub("[redacted-key]", masked)
    return masked


def apply_output_guardrails(text: str) -> str:
    """Apply schema redaction and PII masking to final agent text."""
    if not text:
        return text
    redacted = _SCHEMA_PATTERNS.sub("[du lieu he thong]", text)
    return mask_pii_in_output(redacted)


def format_insufficient_data(hint: str = "") -> str:
    """Return a standard insufficient-data response."""
    if hint:
        return f"{INSUFFICIENT_DATA_TEMPLATE} {hint}".strip()
    return INSUFFICIENT_DATA_TEMPLATE


def contains_unfounded_claim(text: str) -> bool:
    """Detect over-confident claims that likely lack tool evidence."""
    return bool(_UNFOUNDED_CLAIM_PATTERN.search(text))
