# StudyBot AWS Deploy Checklist

## Target Architecture

- Frontend: S3 static website behind CloudFront HTTPS
- API entry: API Gateway HTTP API
- Compute: Lambda running FastAPI through `lambda_entry.handler`
- AI: Amazon Bedrock Knowledge Base + Claude Haiku + Titan Embeddings
- Object storage: S3 upload bucket with Block Public Access enabled
- Persistence: DynamoDB or RDS PostgreSQL
- Identity: Cognito optional. If used, API Gateway authorizer should map the user to `X-User-Id`.

## Lambda Environment Variables

```env
SERVE_FRONTEND=false
CORS_ORIGINS=https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net

AI_BACKEND=bedrock
AI_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
AWS_REGION=ap-southeast-1

STORAGE_BACKEND=s3
STORAGE_BUCKET=YOUR_UPLOAD_BUCKET

USERSTORE_BACKEND=dynamodb
USERSTORE_TABLE=studybot-users

VECTOR_BACKEND=bedrock_kb
VECTOR_BEDROCK_KB_ID=YOUR_KB_ID
VECTOR_BEDROCK_DATA_SOURCE_ID=YOUR_KB_DATA_SOURCE_ID

DEFAULT_USER_ID=test-user-001
COGNITO_USER_ID_CLAIM=sub
```

If using PostgreSQL instead of DynamoDB:

```env
USERSTORE_BACKEND=postgres
USERSTORE_POSTGRES_URL=postgresql://USER:PASSWORD@PRIVATE_RDS_ENDPOINT:5432/studybot
```

## Lambda Handler

```text
lambda_entry.handler
```

## Lambda Package

Use the Lambda-only requirements file. Do not upload `.venv`.

```powershell
New-Item -ItemType Directory -Force build
.\.venv\Scripts\python.exe -m pip install -r requirements-lambda.txt -t build
Copy-Item lambda_entry.py build\
Copy-Item src build\src -Recurse
Compress-Archive -Path build\* -DestinationPath studybot-lambda.zip -Force
```

Upload:

```text
studybot-lambda.zip
```

Do not include:

```text
.venv/
_data/
tests/
sample_data/
frontend/   # frontend goes to S3 + CloudFront
```

## Bedrock KB Upload Flow

1. Browser calls `POST /upload`.
2. Lambda writes the raw file to S3 under `<user_id>/<doc_id>/<filename>`.
3. Lambda writes `<filename>.metadata.json` next to it with `user_id`, `doc_id`, and `filename`.
4. Lambda calls `bedrock-agent:StartIngestionJob`.
5. Bedrock Knowledge Base syncs the S3 data source and writes vectors to the selected vector store.
6. Query routes call `bedrock-agent-runtime:RetrieveAndGenerate` with a `user_id` metadata filter.

## Lambda IAM Actions

Use named actions, not `AdministratorAccess` and not wildcard actions.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-southeast-1:ACCOUNT_ID:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_UPLOAD_BUCKET",
        "arn:aws:s3:::YOUR_UPLOAD_BUCKET/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/studybot-users"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:ap-southeast-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agent:StartIngestionJob",
        "bedrock-agent-runtime:Retrieve",
        "bedrock-agent-runtime:RetrieveAndGenerate"
      ],
      "Resource": "*"
    }
  ]
}
```

Tighten the Bedrock KB resource ARNs if the console exposes exact ARNs in your account.

## Cognito

Cognito is not mandatory for W7, but if your group uses it:

- Create Cognito User Pool and App Client.
- Add API Gateway JWT authorizer.
- Configure issuer: `https://cognito-idp.ap-southeast-1.amazonaws.com/YOUR_USER_POOL_ID`
- Configure audience as your Cognito App Client ID.
- Attach the JWT authorizer to API Gateway routes.
- The frontend sends `Authorization: Bearer <id_token>`.
- API Gateway validates the token. The app then reads the configured claim (`COGNITO_USER_ID_CLAIM=sub` by default) as `user_id`.
- `X-User-Id` still works for local testing and trainer demo fallback.
- Keep `DEFAULT_USER_ID` only as local/demo fallback.

## W7 Mandatory Mapping

- #1 Public URL: CloudFront serving `frontend/index.html`
- #2 API endpoint: API Gateway HTTP API to Lambda
- #3 AI: Bedrock KB `RetrieveAndGenerate` and CloudWatch logs
- #4 DB: DynamoDB write/read via document and query history
- #5 S3: Upload bucket with Block Public Access
- #6 Network: If using RDS, put DB in private subnet and allow inbound only from Lambda SG
- #7 IAM: Lambda execution role with named actions above
