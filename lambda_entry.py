"""AWS Lambda entrypoint for API Gateway + FastAPI."""
from mangum import Mangum
from src.app import app
import boto3

handler = Mangum(app)

cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')

def publish_metric(metric_name: str, value: float, unit: str = 'Count'):
    cloudwatch.put_metric_data(
        Namespace='StudyBuddy/AIUsage',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit
        }]
    )
