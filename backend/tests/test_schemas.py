"""Unit tests for Pydantic schemas validation."""

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints.chat import ChatRequest
from app.schemas.people import StudentCreate
from app.schemas.teaching import EnrollmentGradeUpdate


def test_chat_request_valid():
    """Valid chat request is parsed correctly."""
    data = {"message": "Hello", "thread_id": "123-abc", "context": {"intent": "test"}}
    req = ChatRequest(**data)
    assert req.message == "Hello"
    assert req.thread_id == "123-abc"
    assert req.context["intent"] == "test"


def test_chat_request_empty_message():
    """Empty message raises ValidationError due to min_length=1."""
    with pytest.raises(ValidationError) as exc_info:
        ChatRequest(message="")
    assert "String should have at least 1 character" in str(exc_info.value)


def test_student_create_schema_valid():
    """Valid student data is parsed correctly."""
    data = {
        "student_code": "SV001",
        "full_name": "Nguyen Van A",
        "program_id": 1,
        "cohort_id": 1,
        "email": "sv001@example.com"
    }
    student = StudentCreate(**data)
    assert student.student_code == "SV001"
    assert student.email == "sv001@example.com"


def test_grade_schema_boundaries():
    """Grade schema enforces 0 <= final_grade <= 10."""
    # Valid
    EnrollmentGradeUpdate(final_grade=0)
    EnrollmentGradeUpdate(final_grade=10)
    EnrollmentGradeUpdate(final_grade=8.5)

    # Invalid: below 0
    with pytest.raises(ValidationError) as exc_info:
        EnrollmentGradeUpdate(final_grade=-0.1)
    assert "Input should be greater than or equal to 0" in str(exc_info.value)

    # Invalid: above 10
    with pytest.raises(ValidationError) as exc_info:
        EnrollmentGradeUpdate(final_grade=10.1)
    assert "Input should be less than or equal to 10" in str(exc_info.value)
