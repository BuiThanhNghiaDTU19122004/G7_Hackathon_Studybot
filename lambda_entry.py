from mangum import Mangum
from src.app import app

# Khởi tạo Mangum để biến FastAPI thành Lambda handler
handler = Mangum(app, lifespan="off")
