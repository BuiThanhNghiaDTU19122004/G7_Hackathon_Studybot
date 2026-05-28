"""End-to-end smoke test against the FastAPI app in LOCAL_MODE.

Verifies the full upload → ingest → query flow works with the local AI stub +
in-memory vector + SQLite. No AWS credentials required.
"""
import os
import sys
import tempfile
from pathlib import Path

# Ensure all local backends BEFORE importing app
os.environ.setdefault("AI_BACKEND", "local")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("USERSTORE_BACKEND", "sqlite")
os.environ.setdefault("VECTOR_BACKEND", "local")
# Per-test temp dirs to avoid cross-pollution
_tmp = tempfile.mkdtemp(prefix="studybot-test-")
os.environ["STORAGE_LOCAL_DIR"] = str(Path(_tmp) / "uploads")
os.environ["USERSTORE_SQLITE_PATH"] = str(Path(_tmp) / "users.db")

# Add project root to sys.path so `from src...` imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from src.app import app
from src import handlers
from src.handlers import _normalize_flashcard_payload, _normalize_quiz_payload


client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["backends"]["ai"] == "local"


def test_upload_text_file():
    content = b"Gradient descent is an optimization algorithm used in machine learning."
    r = client.post(
        "/upload",
        files={"file": ("lecture.txt", content, "text/plain")},
        headers={"X-User-Id": "alice"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["filename"] == "lecture.txt"
    assert body["size"] == len(content)
    assert body["chars_extracted"] > 0


def test_query_returns_answer_after_upload():
    # Upload first
    client.post(
        "/upload",
        files={"file": ("lec.txt", b"Gradient descent uses a learning rate to update parameters.", "text/plain")},
        headers={"X-User-Id": "bob"},
    )
    r = client.post(
        "/query",
        json={"question": "What is gradient descent?"},
        headers={"X-User-Id": "bob"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "answer" in body
    assert isinstance(body["citations"], list)
    # Local vector index should find at least one hit for the keyword 'gradient'
    assert len(body["citations"]) >= 1


def test_query_without_upload_handles_empty_index():
    r = client.post(
        "/query",
        json={"question": "What is quantum chromodynamics?"},
        headers={"X-User-Id": "carol-fresh"},
    )
    assert r.status_code == 200
    assert "answer" in r.json()


def test_list_docs_per_user_isolation():
    client.post(
        "/upload",
        files={"file": ("a.txt", b"alice's doc", "text/plain")},
        headers={"X-User-Id": "user-A"},
    )
    client.post(
        "/upload",
        files={"file": ("b.txt", b"bob's doc", "text/plain")},
        headers={"X-User-Id": "user-B"},
    )
    a_docs = client.get("/docs/list", headers={"X-User-Id": "user-A"}).json()["docs"]
    b_docs = client.get("/docs/list", headers={"X-User-Id": "user-B"}).json()["docs"]
    assert any(d["filename"] == "a.txt" for d in a_docs)
    assert all(d["filename"] != "b.txt" for d in a_docs)
    assert any(d["filename"] == "b.txt" for d in b_docs)


def test_normalize_flashcards_accepts_common_llm_variants():
    raw = """
    {
      "flashcards": [
        {"question": "CI/CD là gì?", "answer": "Một quy trình tự động hóa build, test và deploy."},
        {"term": "Pipeline", "definition": "Chuỗi bước xử lý phần mềm."}
      ]
    }
    """
    payload = _normalize_flashcard_payload(raw, count=5)
    assert payload == {
        "cards": [
            {"front": "CI/CD là gì?", "back": "Một quy trình tự động hóa build, test và deploy."},
            {"front": "Pipeline", "back": "Chuỗi bước xử lý phần mềm."},
        ]
    }


class FakeStructuredAI:
    def __init__(self, response):
        self.response = response
        self.prompts = []

    def invoke(self, prompt, **kwargs):
        self.prompts.append(prompt)
        return self.response

    def retrieve_and_generate(self, *args, **kwargs):
        raise AssertionError("structured tools should retrieve context before invoking the model")


class FakeVectorStore:
    def __init__(self, chunks):
        self.chunks = chunks
        self.searches = []

    def search(self, query, top_k=5, filter=None):
        self.searches.append({"query": query, "top_k": top_k, "filter": filter})
        return self.chunks[:top_k]


class FakeUserStore:
    def __init__(self):
        self.logs = []

    def log_query(self, user_id, query, answer):
        self.logs.append({"user_id": user_id, "query": query, "answer": answer})


def test_quiz_uses_retrieved_context_for_structured_generation():
    ai = FakeStructuredAI(
        '{"questions":[{"question":"What is CI/CD?","options":["Automation","Manual only"],"answer":"A"}]}'
    )
    vector = FakeVectorStore([
        {
            "text": "CI/CD automates build, test, and deployment steps.",
            "metadata": {"user_id": "u1", "doc_id": "d1", "filename": "rules.txt"},
            "score": 1.0,
        }
    ])
    result = handlers.handle_quiz(
        user_id="u1",
        count=3,
        difficulty="medium",
        ai_client=ai,
        userstore=FakeUserStore(),
        vector_store=vector,
        vector_backend="bedrock_kb",
        bedrock_kb_id="kb",
        doc_id="d1",
    )
    assert result["quiz_json"]["questions"][0]["question"] == "What is CI/CD?"
    assert vector.searches[0]["filter"] == {"user_id": "u1", "doc_id": "d1"}
    assert "CONTEXT:" in ai.prompts[0]


def test_flashcards_return_sync_message_when_selected_doc_has_no_chunks():
    result = handlers.handle_flashcards(
        user_id="u1",
        count=5,
        ai_client=FakeStructuredAI('{"cards":[]}'),
        userstore=FakeUserStore(),
        vector_store=FakeVectorStore([]),
        vector_backend="bedrock_kb",
        bedrock_kb_id="kb",
        doc_id="missing-doc",
    )
    assert result["flashcards_json"] is None
    assert "Knowledge Base" in result["flashcards"]


def test_normalize_quiz_accepts_string_options_and_answer_text():
    raw = """
    {
      "quiz": [
        {
          "prompt": "CI/CD giúp ích gì?",
          "options": ["Tự động hóa kiểm thử và triển khai", "Xóa toàn bộ logs", "Tắt kiểm thử"],
          "correct_answer": "Tự động hóa kiểm thử và triển khai",
          "explanation": "CI/CD giảm thao tác thủ công trong vòng đời phát hành."
        }
      ]
    }
    """
    payload = _normalize_quiz_payload(raw, count=3)
    assert payload["questions"][0]["question"] == "CI/CD giúp ích gì?"
    assert payload["questions"][0]["answer"] == "A"
    assert payload["questions"][0]["options"] == [
        {"id": "A", "text": "Tự động hóa kiểm thử và triển khai"},
        {"id": "B", "text": "Xóa toàn bộ logs"},
        {"id": "C", "text": "Tắt kiểm thử"},
    ]
