"""FastAPI application — runtime-agnostic.

Runs on:
  - Local laptop:        uvicorn src.app:app --reload
  - AWS Lambda:          wrap with Mangum (pip install mangum) → expose `handler`
  - ECS Fargate / EC2:   uvicorn or gunicorn
  - App Runner:          uvicorn

The choice is yours. Code stays the same.
"""
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import config
from src.adapters import factory
from src import handlers


app = FastAPI(title="StudyBot — W7 Capstone Starter")


# CORS — allow frontend to live on a different origin (CloudFront / Amplify / separate ALB).
# CORS_ORIGINS env var controls this; default '*' is permissive for hackathon.
_allowed = ["*"] if config.cors_origins == "*" else [o.strip() for o in config.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons. In serverless this gets re-initialized per cold start; that's fine.
ai_client = factory.make_ai()
storage = factory.make_storage()
userstore = factory.make_userstore()
vector_store = factory.make_vector()


_jwks = None

def _resolve_user_id(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None)
) -> str:
    """Extract user_id from Cognito JWT, fall back to default for local dev."""
    if config.cognito_user_pool_id and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            from jose import jwt
            import urllib.request
            import json
            global _jwks
            if not _jwks:
                url = f"https://cognito-idp.{config.aws_region}.amazonaws.com/{config.cognito_user_pool_id}/.well-known/jwks.json"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req) as response:
                    _jwks = json.loads(response.read().decode("utf-8"))
            
            claims = jwt.decode(
                token,
                _jwks,
                algorithms=["RS256"],
                audience=config.cognito_client_id,
                issuer=f"https://cognito-idp.{config.aws_region}.amazonaws.com/{config.cognito_user_pool_id}"
            )
            # Use 'sub' (subject) or 'username' claim from Cognito
            return claims.get("username") or claims.get("sub") or config.default_user_id
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    return x_user_id or config.default_user_id


class QueryRequest(BaseModel):
    question: str


class ActionRequest(BaseModel):
    action_type: str
    doc_id: str | None = None


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
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
    user_id = _resolve_user_id(authorization, x_user_id)
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
    )


@app.post("/query")
def query(
    req: QueryRequest, 
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    user_id = _resolve_user_id(authorization, x_user_id)
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
    )


@app.post("/action")
def document_action(
    req: ActionRequest,
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    user_id = _resolve_user_id(authorization, x_user_id)
    result = handlers.handle_document_action(
        user_id=user_id,
        action_type=req.action_type,
        doc_id=req.doc_id,
        ai_client=ai_client,
        storage=storage,
        userstore=userstore,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/docs/list")
def list_docs(
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    return handlers.handle_list_docs(_resolve_user_id(authorization, x_user_id), userstore)


@app.get("/queries/recent")
def recent(
    x_user_id: str | None = Header(default=None), 
    authorization: str | None = Header(default=None),
    limit: int = 10
) -> dict:
    return handlers.handle_recent_queries(_resolve_user_id(authorization, x_user_id), userstore, limit=limit)


# ---- Static frontend ----
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
ASSETS_DIR = FRONTEND_DIR / "assets"

if config.serve_frontend:
    from fastapi.staticfiles import StaticFiles
    import os

    # Ensure dist and assets directories exist to prevent FastAPI startup errors
    if not FRONTEND_DIR.exists():
        os.makedirs(FRONTEND_DIR, exist_ok=True)
    if not ASSETS_DIR.exists():
        os.makedirs(ASSETS_DIR, exist_ok=True)

    # Mount static assets
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/")
    def index() -> FileResponse:
        """Convenience: serves frontend/dist/index.html at /. Set SERVE_FRONTEND=false
        if you deploy the frontend separately (CloudFront+S3, Amplify, ALB)."""
        # Note: Since we use HashRouter, all routes like /#/login load this index.html
        return FileResponse(FRONTEND_DIR / "index.html")
