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


def _context_from_chunks(chunks: list[dict]) -> str:
    return "\n\n".join(f"[chunk {i+1}] {c['text']}" for i, c in enumerate(chunks))


def _citations_from_chunks(chunks: list[dict]) -> list[dict]:
    return [
        {"chunk": i + 1, "doc_id": c["doc_id"], "score": c["score"], "text": c["text"][:260]}
        for i, c in enumerate(chunks)
    ]


def _fallback_local_chunks(user_id: str, vector_store, top_k: int = 8, doc_id: str | None = None) -> list[dict]:
    """Return recent local chunks when a task prompt has no keyword match.
    The production Bedrock KB path does semantic retrieval. LocalVector is only a
    keyword stub, so generic actions like "summarize this lecture" need a small
    fallback to keep the local demo useful.
    """
    docs = getattr(vector_store, "docs", None)
    if not docs:
        return []
    chunks = []
    for chunk_id, text, md in docs:
        if md.get("user_id") != user_id:
            continue
        if doc_id and md.get("doc_id") != doc_id:
            continue
        chunks.append({
            "text": text,
            "doc_id": md.get("doc_id", chunk_id),
            "score": 1.0,
            "metadata": md,
        })
    return chunks[:top_k]


def _metadata_filter(user_id: str, doc_id: str | None = None) -> dict:
    metadata = {"user_id": user_id}
    if doc_id:
        metadata["doc_id"] = doc_id
    return metadata


def _retrieve_context(
    user_id: str,
    query: str,
    vector_store,
    top_k: int = 8,
    doc_id: str | None = None,
) -> tuple[str, list[dict]]:
    chunks = vector_store.search(query, top_k=top_k, filter=_metadata_filter(user_id, doc_id))
    if not chunks:
        chunks = _fallback_local_chunks(user_id, vector_store, top_k=top_k, doc_id=doc_id)
    return _context_from_chunks(chunks), _citations_from_chunks(chunks)


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
    kb_metadata = {"user_id": user_id, "doc_id": doc_id, "filename": filename}
    if hasattr(storage, "put_metadata"):
        storage.put_metadata(key, kb_metadata)
    if text.strip():
        vector_store.ingest(doc_id=doc_id, text=text, metadata=kb_metadata)
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
        result = ai_client.retrieve_and_generate(
            query=question,
            kb_id=bedrock_kb_id,
            filter={"user_id": user_id},
        )
        answer = result["answer"]
        citations = result["citations"]
    else:
        # Local path: do our own retrieve then prompt
        chunks = vector_store.search(question, top_k=5, filter={"user_id": user_id})
        if not chunks:
            answer = "No relevant content found in your uploaded documents. Upload some first."
            citations = []
        else:
            context = _context_from_chunks(chunks)
            prompt = PROMPT_TEMPLATE.format(context=context, question=question)
            answer = ai_client.invoke(prompt, max_tokens=512)
            citations = _citations_from_chunks(chunks)

    userstore.log_query(user_id=user_id, query=question, answer=answer)
    return {"question": question, "answer": answer, "citations": citations}


def handle_summarize(
    user_id: str,
    ai_client,
    userstore,
    vector_store,
    vector_backend: str,
    bedrock_kb_id: str,
    doc_id: str | None = None,
) -> dict:
    task = (
        "Summarize ONLY the selected uploaded document. Write in Vietnamese. "
        "Use these Markdown sections exactly: ## 5 ý chính, ## Thuật ngữ cần nhớ, "
        "## Điểm dễ ra kiểm tra, ## Gợi ý ôn tập. Be concise and grounded in the document."
    )
    if vector_backend == "bedrock_kb":
        result = ai_client.retrieve_and_generate(
            query=task,
            kb_id=bedrock_kb_id,
            filter=_metadata_filter(user_id, doc_id),
        )
        summary = result["answer"]
        citations = result["citations"]
    else:
        context, citations = _retrieve_context(user_id, task, vector_store, top_k=10, doc_id=doc_id)
        if not context:
            summary = "No uploaded study material found. Upload a lecture first."
            citations = []
        else:
            prompt = f"""You are StudyBot. Use ONLY the lecture context below.

CONTEXT:
{context}

Create a concise study summary with these headings:
- Key ideas
- Terms to remember
- Likely exam points

SUMMARY:"""
            summary = ai_client.invoke(prompt, max_tokens=700)
    userstore.log_query(user_id=user_id, query="Generate study summary", answer=summary)
    return {"summary": summary, "citations": citations}


def handle_quiz(
    user_id: str,
    count: int,
    difficulty: str,
    ai_client,
    userstore,
    vector_store,
    vector_backend: str,
    bedrock_kb_id: str,
    doc_id: str | None = None,
) -> dict:
    count = max(3, min(count, 10))
    difficulty = difficulty if difficulty in {"easy", "medium", "hard"} else "medium"
    task = (
        f"Generate exactly {count} {difficulty} multiple-choice quiz questions from ONLY the selected uploaded document. "
        "Write in Vietnamese. Use this exact plain-text format for every question:\n"
        "Câu 1: [question]\n"
        "A. [option]\n"
        "B. [option]\n"
        "C. [option]\n"
        "D. [option]\n"
        "Đáp án đúng: [A/B/C/D]\n"
        "Giải thích: [one sentence]\n"
        "Do not add extra formats outside the questions."
    )
    if vector_backend == "bedrock_kb":
        result = ai_client.retrieve_and_generate(
            query=task,
            kb_id=bedrock_kb_id,
            filter=_metadata_filter(user_id, doc_id),
        )
        quiz = result["answer"]
        citations = result["citations"]
    else:
        context, citations = _retrieve_context(user_id, task, vector_store, top_k=10, doc_id=doc_id)
        if not context:
            quiz = "No uploaded study material found. Upload a lecture first."
            citations = []
        else:
            prompt = f"""You are StudyBot. Use ONLY the lecture context below.

CONTEXT:
{context}

Generate {count} {difficulty} multiple-choice quiz questions.
For each question include:
- Question
- A, B, C, D options
- Correct answer
- One-sentence explanation grounded in the notes

QUIZ:"""
            quiz = ai_client.invoke(prompt, max_tokens=900)
    userstore.log_query(user_id=user_id, query=f"Generate {difficulty} quiz", answer=quiz)
    return {"quiz": quiz, "difficulty": difficulty, "count": count, "citations": citations}


def handle_flashcards(
    user_id: str,
    count: int,
    ai_client,
    userstore,
    vector_store,
    vector_backend: str,
    bedrock_kb_id: str,
    doc_id: str | None = None,
) -> dict:
    count = max(5, min(count, 20))
    task = (
        f"Generate exactly {count} flashcards from ONLY the selected uploaded document. "
        "Write in Vietnamese. Use this exact plain-text format for every card:\n"
        "Front: [term or question]\n"
        "Back: [short answer]\n"
        "Do not add bullets, tables, or explanations outside Front/Back pairs."
    )
    if vector_backend == "bedrock_kb":
        result = ai_client.retrieve_and_generate(
            query=task,
            kb_id=bedrock_kb_id,
            filter=_metadata_filter(user_id, doc_id),
        )
        flashcards = result["answer"]
        citations = result["citations"]
    else:
        context, citations = _retrieve_context(user_id, task, vector_store, top_k=10, doc_id=doc_id)
        if not context:
            flashcards = "No uploaded study material found. Upload a lecture first."
            citations = []
        else:
            prompt = f"""You are StudyBot. Use ONLY the lecture context below.

CONTEXT:
{context}

Create {count} flashcards in this format:
Front: [term or question]
Back: [short answer]

FLASHCARDS:"""
            flashcards = ai_client.invoke(prompt, max_tokens=800)
    userstore.log_query(user_id=user_id, query="Generate flashcards", answer=flashcards)
    return {"flashcards": flashcards, "count": count, "citations": citations}


def handle_study_plan(user_id: str, userstore) -> dict:
    docs = userstore.list_docs(user_id)
    recent = userstore.recent_queries(user_id, limit=5)
    total_chars = sum(int(d.get("chars") or 0) for d in docs)
    plan = [
        "Review the newest uploaded document for 15 minutes.",
        "Ask StudyBot 3 questions about weak points.",
        "Generate flashcards and review the missed concepts.",
        "Take a short quiz, then re-read the cited chunks for incorrect answers.",
    ]
    if len(docs) >= 3:
        plan.append("Compare the top ideas across your uploaded documents.")
    return {
        "docs_uploaded": len(docs),
        "recent_questions": len(recent),
        "total_chars": total_chars,
        "plan": plan,
    }


def handle_list_docs(user_id: str, userstore) -> dict:
    return {"user_id": user_id, "docs": userstore.list_docs(user_id)}


def handle_recent_queries(user_id: str, userstore, limit: int = 10) -> dict:
    return {"user_id": user_id, "queries": userstore.recent_queries(user_id, limit=limit)}
