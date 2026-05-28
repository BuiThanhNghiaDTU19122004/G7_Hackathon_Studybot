"""Environment-driven configuration. Read all settings from env vars — no hardcoded service names."""
import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _is_lambda() -> bool:
    return bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


def _lambda_default(local_path: str, lambda_path: str) -> str:
    return lambda_path if _is_lambda() else local_path


@dataclass(frozen=True)
class Config:
    # AI
    ai_backend: str = _env("AI_BACKEND", "local")
    ai_model_id: str = _env("AI_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")
    ai_model_arn: str = _env("AI_MODEL_ARN", "")
    aws_region: str = _env("AWS_REGION", "us-east-1")
    bedrock_region: str = _env("BEDROCK_REGION", _env("AWS_REGION", "us-east-1"))

    # Storage
    storage_backend: str = _env("STORAGE_BACKEND", "local")
    storage_bucket: str = _env("STORAGE_BUCKET", "")
    storage_local_dir: str = _env("STORAGE_LOCAL_DIR", _lambda_default("./_data/uploads", "/tmp/studybot/uploads"))

    # UserStore
    userstore_backend: str = _env("USERSTORE_BACKEND", "sqlite")
    userstore_table: str = _env("USERSTORE_TABLE", "")
    userstore_postgres_url: str = _env("USERSTORE_POSTGRES_URL", "")
    userstore_sqlite_path: str = _env("USERSTORE_SQLITE_PATH", _lambda_default("./_data/users.db", "/tmp/studybot/users.db"))

    # Vector
    vector_backend: str = _env("VECTOR_BACKEND", "local")
    vector_bedrock_kb_id: str = _env("VECTOR_BEDROCK_KB_ID", "")
    vector_bedrock_data_source_id: str = _env("VECTOR_BEDROCK_DATA_SOURCE_ID", "")

    # Identity
    default_user_id: str = _env("DEFAULT_USER_ID", "test-user-001")
    cognito_user_id_claim: str = _env("COGNITO_USER_ID_CLAIM", "sub")

    # Logging
    log_level: str = _env("LOG_LEVEL", "INFO")


    # Frontend serving (opt-out so backend can be pure API for split deploys)
    serve_frontend: bool = _env("SERVE_FRONTEND", "true").lower() == "true"
    cors_origins: str = _env("CORS_ORIGINS", "*")

    # Extra DB backends (DocumentDB, MySQL)
    userstore_mongo_url: str = _env("USERSTORE_MONGO_URL", "")
    userstore_mongo_db: str = _env("USERSTORE_MONGO_DB", "studybot")
    userstore_mongo_tls_ca: str = _env("USERSTORE_MONGO_TLS_CA", "")
    userstore_mysql_url: str = _env("USERSTORE_MYSQL_URL", "")

config = Config()
