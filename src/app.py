"""FastAPI application — runtime-agnostic.

Runs on:
  - Local laptop:        uvicorn src.app:app --reload
  - AWS Lambda:          wrap with Mangum (pip install mangum) → expose `handler`
  - ECS Fargate / EC2:   uvicorn or gunicorn
  - App Runner:          uvicorn

The choice is yours. Code stays the same.
"""
import base64
import json
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import config
from src.adapters import factory
from src import handlers


APP_VERSION = "2026-05-29-pdf-original-sync"

app = FastAPI(title="StudyBot — W7 Capstone Starter")


# CORS — allow frontend to live on a different origin (CloudFront / Amplify / separate ALB).
# CORS_ORIGINS env var controls this; default '*' is permissive for hackathon.
_allowed = ["*"] if config.cors_origins == "*" else [o.strip() for o in config.cors_origins.split(",") if o.strip()]
_allow_credentials = config.cors_origins != "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons. In serverless this gets re-initialized per cold start; that's fine.
ai_client = factory.make_ai()
storage = factory.make_storage()
userstore = factory.make_userstore()
vector_store = factory.make_vector()


def _jwt_claims_unverified(authorization: str | None) -> dict:
    """Decode claims after API Gateway/Cognito has validated the JWT.

    This function does not verify signatures by itself. In production, configure
    API Gateway JWT authorizer with your Cognito User Pool issuer/audience.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return {}
    token = authorization.split(" ", 1)[1].strip()
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
    except Exception:
        return {}


def _resolve_user_id(x_user_id: str | None, authorization: str | None = None) -> str:
    """Auth abstraction: extract user_id from header, fall back to default for local dev.

    In production you populate X-User-Id from:
      - Cognito JWT (decoded by API Gateway authorizer)
      - Signed URL claim
      - Custom auth Lambda
    """
    claims = _jwt_claims_unverified(authorization)
    return x_user_id or claims.get(config.cognito_user_id_claim) or config.default_user_id


class QueryRequest(BaseModel):
    question: str
    doc_id: str | None = None


class QuizRequest(BaseModel):
    count: int = 5
    difficulty: str = "medium"


class FlashcardRequest(BaseModel):
    count: int = 8


class ActionRequest(BaseModel):
    action_type: str
    doc_id: str | None = None
    count: int | None = None
    difficulty: str = "medium"


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": APP_VERSION,
        "backends": {
            "ai": config.ai_backend,
            "storage": config.storage_backend,
            "userstore": config.userstore_backend,
            "vector": config.vector_backend,
        },
    }


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    user_id = _resolve_user_id(x_user_id, authorization)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    return handlers.handle_upload(
        user_id=user_id,
        filename=file.filename or "untitled",
        data=data,
        storage=storage,
        userstore=userstore,
        vector_store=vector_store,
        content_type=file.content_type,
    )


@app.post("/query")
def query(
    req: QueryRequest,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    user_id = _resolve_user_id(x_user_id, authorization)
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Empty question")
    return handlers.handle_query(
        user_id=user_id,
        question=req.question,
        ai_client=ai_client,
        userstore=userstore,
        vector_store=vector_store,
        vector_backend=config.vector_backend,
        bedrock_kb_id=config.vector_bedrock_kb_id,
        doc_id=req.doc_id,
    )


@app.post("/summarize")
def summarize(
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_summarize(
        user_id=_resolve_user_id(x_user_id, authorization),
        ai_client=ai_client,
        userstore=userstore,
        vector_store=vector_store,
        vector_backend=config.vector_backend,
        bedrock_kb_id=config.vector_bedrock_kb_id,
    )


@app.post("/quiz")
def quiz(
    req: QuizRequest,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_quiz(
        user_id=_resolve_user_id(x_user_id, authorization),
        count=req.count,
        difficulty=req.difficulty,
        ai_client=ai_client,
        userstore=userstore,
        vector_store=vector_store,
        vector_backend=config.vector_backend,
        bedrock_kb_id=config.vector_bedrock_kb_id,
    )


@app.post("/flashcards")
def flashcards(
    req: FlashcardRequest,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_flashcards(
        user_id=_resolve_user_id(x_user_id, authorization),
        count=req.count,
        ai_client=ai_client,
        userstore=userstore,
        vector_store=vector_store,
        vector_backend=config.vector_backend,
        bedrock_kb_id=config.vector_bedrock_kb_id,
    )


@app.post("/action")
def document_action(
    req: ActionRequest,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    user_id = _resolve_user_id(x_user_id, authorization)
    action_type = req.action_type.strip().lower()

    if action_type in {"summary", "summarize"}:
        result = handlers.handle_summarize(
            user_id=user_id,
            ai_client=ai_client,
            userstore=userstore,
            vector_store=vector_store,
            vector_backend=config.vector_backend,
            bedrock_kb_id=config.vector_bedrock_kb_id,
            doc_id=req.doc_id,
        )
        return {
            "question": "Generate study summary",
            "answer": result["summary"],
            "citations": result.get("citations", []),
        }

    if action_type in {"flashcard", "flashcards"}:
        result = handlers.handle_flashcards(
            user_id=user_id,
            count=req.count or 8,
            ai_client=ai_client,
            userstore=userstore,
            vector_store=vector_store,
            vector_backend=config.vector_backend,
            bedrock_kb_id=config.vector_bedrock_kb_id,
            doc_id=req.doc_id,
        )
        return {
            "question": "Generate flashcards",
            "answer": result["flashcards"],
            "flashcards_json": result.get("flashcards_json"),
            "citations": result.get("citations", []),
        }

    if action_type in {"quiz", "quizzes"}:
        result = handlers.handle_quiz(
            user_id=user_id,
            count=req.count or 5,
            difficulty=req.difficulty,
            ai_client=ai_client,
            userstore=userstore,
            vector_store=vector_store,
            vector_backend=config.vector_backend,
            bedrock_kb_id=config.vector_bedrock_kb_id,
            doc_id=req.doc_id,
        )
        return {
            "question": f"Generate {result['difficulty']} quiz",
            "answer": result["quiz"],
            "quiz_json": result.get("quiz_json"),
            "citations": result.get("citations", []),
        }

    raise HTTPException(status_code=400, detail="Unknown action_type. Use summary, flashcard, or quiz.")


@app.get("/study-plan")
def study_plan(
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_study_plan(_resolve_user_id(x_user_id, authorization), userstore)


@app.get("/docs/list")
def list_docs(
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_list_docs(_resolve_user_id(x_user_id, authorization), userstore)


@app.delete("/docs/{doc_id}")
def delete_doc(
    doc_id: str,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    result = handlers.handle_delete_doc(
        user_id=_resolve_user_id(x_user_id, authorization),
        doc_id=doc_id,
        storage=storage,
        userstore=userstore,
        vector_store=vector_store,
    )
    if not result["deleted"]:
        raise HTTPException(status_code=404, detail="Document not found")
    return result


@app.get("/queries/recent")
def recent(
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    limit: int = 10,
) -> dict:
    return handlers.handle_recent_queries(_resolve_user_id(x_user_id, authorization), userstore, limit=limit)


# ---- Static frontend ----
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


if config.serve_frontend:
    @app.get("/")
    def index() -> FileResponse:
        """Convenience: serves frontend/index.html at /. Set SERVE_FRONTEND=false
        if you deploy the frontend separately (CloudFront+S3, Amplify, ALB)."""
        return FileResponse(FRONTEND_DIR / "index.html")
