"""AWS Lambda entrypoint for API Gateway + FastAPI."""
from mangum import Mangum

from src.app import app


handler = Mangum(app)
