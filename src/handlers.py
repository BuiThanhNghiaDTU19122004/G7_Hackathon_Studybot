"""Endpoint handlers. Pure business logic — knows nothing about FastAPI or AWS specifics."""
import io
import uuid
from typing import Optional


PROMPT_TEMPLATE = """You are a study assistant. Answer the student's question using ONLY the
context retrieved from their uploaded lecture notes. Cite the source by chunk
number where possible. If the context does not contain the answer, say so
plainly. Do not invent information.

CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""


def _extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from PDF or .txt upload."""
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            return "(pypdf not installed — install requirements.txt)"
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    # Default: assume UTF-8 text
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


def handle_upload(
    user_id: str,
    filename: str,
    data: bytes,
    storage,
    userstore,
    vector_store,
) -> dict:
    """Store the file, extract text, ingest into vector store, record in userstore."""
    doc_id = str(uuid.uuid4())
    key = f"{user_id}/{doc_id}/{filename}"
    location = storage.put(key, data)
    text = _extract_text(filename, data)
    if text.strip():
        vector_store.ingest(doc_id=doc_id, text=text, metadata={"user_id": user_id, "filename": filename})
    userstore.add_doc(
        user_id=user_id,
        doc_id=doc_id,
        metadata={"filename": filename, "size": len(data), "location": location, "chars": len(text)},
    )
    return {
        "doc_id": doc_id,
        "filename": filename,
        "size": len(data),
        "chars_extracted": len(text),
        "location": location,
    }


def handle_query(
    user_id: str,
    question: str,
    ai_client,
    userstore,
    vector_store,
    vector_backend: str,
    bedrock_kb_id: str,
) -> dict:
    """RAG flow: retrieve user's relevant chunks → call AI with context → log + return."""
    if vector_backend == "bedrock_kb":
        # Production path: let Bedrock do retrieve + generate in one call
        result = ai_client.retrieve_and_generate(query=question, kb_id=bedrock_kb_id)
        answer = result["answer"]
        citations = result["citations"]
    else:
        # Local path: do our own retrieve then prompt
        chunks = vector_store.search(question, top_k=5, filter={"user_id": user_id})
        if not chunks:
            answer = "No relevant content found in your uploaded documents. Upload some first."
            citations = []
        else:
            context = "\n\n".join(f"[chunk {i+1}] {c['text']}" for i, c in enumerate(chunks))
            prompt = PROMPT_TEMPLATE.format(context=context, question=question)
            answer = ai_client.invoke(prompt, max_tokens=512)
            citations = [
                {"chunk": i + 1, "doc_id": c["doc_id"], "score": c["score"], "text": c["text"][:200]}
                for i, c in enumerate(chunks)
            ]

    userstore.log_query(user_id=user_id, query=question, answer=answer)
    return {"question": question, "answer": answer, "citations": citations}


def handle_list_docs(user_id: str, userstore) -> dict:
    return {"user_id": user_id, "docs": userstore.list_docs(user_id)}


def handle_recent_queries(user_id: str, userstore, limit: int = 10) -> dict:
    return {"user_id": user_id, "queries": userstore.recent_queries(user_id, limit=limit)}


def handle_document_action(
    user_id: str,
    action_type: str,
    doc_id: Optional[str],
    ai_client,
    storage,
    userstore,
) -> dict:
    docs = userstore.list_docs(user_id)
    if not docs:
        return {"error": "Chưa có tài liệu nào được tải lên."}
    
    # If no doc_id is provided, use the most recent document
    target_doc = None
    if doc_id:
        target_doc = next((d for d in docs if d["doc_id"] == doc_id), None)
    else:
        target_doc = docs[0] if docs else None
        
    if not target_doc:
        return {"error": "Không tìm thấy tài liệu yêu cầu."}

    location = target_doc.get("location")
    if not location:
        return {"error": "Tài liệu không hợp lệ."}

    # Extract key from location string. Supported: s3://bucket/key or file:///path/key
    key = None
    if location.startswith("s3://"):
        key = "/".join(location.split("/")[3:])
    elif location.startswith("file://"):
        # LocalStorage base path is not exposed, but in this setup the key is {user_id}/{doc_id}/{filename}
        filename = target_doc.get("filename", target_doc["doc_id"])
        key = f"{user_id}/{target_doc['doc_id']}/{filename}"
    else:
        # Fallback to reconstructing the key
        filename = target_doc.get("filename", target_doc["doc_id"])
        key = f"{user_id}/{target_doc['doc_id']}/{filename}"

    try:
        data = storage.get(key)
    except Exception as e:
        return {"error": f"Không thể đọc file từ storage: {e}"}

    filename = target_doc.get("filename", "")
    text = _extract_text(filename, data)
    if not text.strip():
        return {"error": "Tài liệu không có nội dung chữ."}
    
    # Limit text to ~15000 chars to avoid token limits for basic models during hackathon
    text_sample = text[:15000]

    if action_type == "quiz":
        prompt = f"Tạo 5 câu hỏi trắc nghiệm (có 4 đáp án A,B,C,D và chỉ ra đáp án đúng) dựa vào nội dung tài liệu sau. Định dạng bằng Markdown.\n\nTài liệu:\n{text_sample}"
    elif action_type == "summary":
        prompt = f"Hãy tóm tắt các ý chính quan trọng nhất của tài liệu sau thành các gạch đầu dòng. Định dạng bằng Markdown.\n\nTài liệu:\n{text_sample}"
    else:
        return {"error": "Hành động không hợp lệ."}

    answer = ai_client.invoke(prompt, max_tokens=1024)
    
    # Log it as a query so it appears in history
    query_text = f"[Hành động: {action_type.title()}] - {filename}"
    userstore.log_query(user_id=user_id, query=query_text, answer=answer)

    return {
        "question": query_text,
        "answer": answer,
        "citations": [{"doc_id": target_doc["doc_id"], "text": "Hành động thực hiện trên toàn bộ tài liệu."}]
    }
