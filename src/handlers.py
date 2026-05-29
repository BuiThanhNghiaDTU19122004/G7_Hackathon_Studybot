"""Endpoint handlers. Pure business logic; knows nothing about FastAPI or AWS specifics."""
import io
import json
import mimetypes
import re
import uuid

from src.config import config


TEXT_EXTENSIONS = (".txt", ".md", ".csv", ".html", ".htm")


PROMPT_TEMPLATE = """You are a study assistant. Answer the student's question using ONLY the
context retrieved from their uploaded lecture notes. Mention source document
names naturally if needed. If the context does not contain the answer, say so
plainly. Do not invent information.

CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""



def _context_from_chunks(chunks: list[dict]) -> str:
    return "\n\n".join(f"[Source {i + 1}]\n{c['text']}" for i, c in enumerate(chunks))


def _citations_from_chunks(chunks: list[dict]) -> list[dict]:
    citations = []
    seen = set()
    for i, chunk in enumerate(chunks):
        metadata = chunk.get("metadata", {}) or {}
        filename = metadata.get("filename") or chunk.get("filename") or "Uploaded document"
        doc_id = metadata.get("doc_id") or chunk.get("doc_id", "")
        key = (filename, doc_id)
        if key in seen:
            continue
        seen.add(key)
        citations.append({
            "chunk": i + 1,
            "doc_id": doc_id,
            "filename": filename,
            "score": chunk.get("score"),
            "uri": metadata.get("uri", ""),
            "source": metadata.get("source", {}),
        })
    return citations


def _fallback_local_chunks(user_id: str, vector_store, top_k: int = 8, doc_id: str | None = None) -> list[dict]:
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


def _retrieve_context(user_id: str, query: str, vector_store, top_k: int = 8, doc_id: str | None = None) -> tuple[str, list[dict]]:
    chunks = vector_store.search(query, top_k=top_k, filter=_metadata_filter(user_id, doc_id))
    if not chunks:
        chunks = _fallback_local_chunks(user_id, vector_store, top_k=top_k, doc_id=doc_id)
    return _context_from_chunks(chunks), _citations_from_chunks(chunks)


def _selected_doc_missing_message() -> str:
    return (
        "Mình chưa tìm thấy nội dung đã sync cho tài liệu đang chọn. "
        "Bạn đợi Knowledge Base sync xong rồi hỏi lại nhé."
    )


def _extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            return ""
        try:
            reader = PdfReader(io.BytesIO(data))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    if not name.endswith(TEXT_EXTENSIONS):
        return ""
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _build_storage_key(*parts: str) -> str:
    return "/".join(str(part).strip("/") for part in parts if part)


def _original_file_key(user_id: str, doc_id: str, filename: str, use_kb_prefix: bool) -> str:
    prefix = config.storage_key_prefix if use_kb_prefix else "uploads"
    return _build_storage_key(prefix, user_id, doc_id, filename)


def _raw_file_key(user_id: str, doc_id: str, filename: str) -> str:
    return _build_storage_key("uploads", user_id, doc_id, filename)


def _kb_file_key(user_id: str, doc_id: str, filename: str) -> str:
    return _build_storage_key(config.storage_key_prefix or "kb", user_id, doc_id, filename)


def _content_type_for_filename(filename: str, fallback: str | None = None) -> str:
    content_type = (fallback or "").split(";", 1)[0].strip()
    if content_type and content_type != "application/octet-stream":
        return content_type
    guessed, _ = mimetypes.guess_type(filename)
    if guessed:
        return guessed
    if filename.lower().endswith((".txt", ".md", ".csv", ".html", ".htm")):
        return "text/plain"
    return "application/octet-stream"


def _extract_json_object(text: str) -> dict | None:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _normalize_flashcard_payload(text: str, count: int) -> dict:
    parsed = _extract_json_object(text)
    if parsed:
        raw_cards = (
            parsed.get("cards")
            or parsed.get("flashcards")
            or parsed.get("items")
            or parsed.get("data")
            or []
        )
    else:
        raw_cards = []

    if isinstance(raw_cards, list):
        cards = []
        for card in raw_cards:
            if not isinstance(card, dict):
                continue
            front = str(
                card.get("front")
                or card.get("term")
                or card.get("question")
                or card.get("prompt")
                or card.get("title")
                or ""
            ).strip()
            back = str(
                card.get("back")
                or card.get("definition")
                or card.get("answer")
                or card.get("explanation")
                or card.get("content")
                or ""
            ).strip()
            if front and back:
                cards.append({"front": front, "back": back})
        return {"cards": cards[:count]}

    cards = []
    pair_re = re.compile(r"Front:\s*(.*?)\s*Back:\s*(.*?)(?=\n\s*Front:|\Z)", re.IGNORECASE | re.DOTALL)
    for match in pair_re.finditer(text or ""):
        cards.append({"front": match.group(1).strip(), "back": match.group(2).strip()})
    return {"cards": cards[:count]}


def _normalize_quiz_payload(text: str, count: int) -> dict:
    parsed = _extract_json_object(text)
    if parsed:
        raw_questions = (
            parsed.get("questions")
            or parsed.get("quiz")
            or parsed.get("quizzes")
            or parsed.get("items")
            or parsed.get("data")
            or []
        )
    else:
        raw_questions = []

    if isinstance(raw_questions, list):
        questions = []
        for item in raw_questions:
            if not isinstance(item, dict):
                continue
            raw_options = item.get("options") or []
            if isinstance(raw_options, dict):
                raw_options = [{"id": key, "text": value} for key, value in raw_options.items()]
            options = []
            for idx, option in enumerate(raw_options):
                if isinstance(option, dict):
                    option_text = str(
                        option.get("text")
                        or option.get("label")
                        or option.get("value")
                        or option.get("answer")
                        or ""
                    ).strip()
                    if option_text:
                        options.append({
                            "id": str(option.get("id") or option.get("letter") or chr(65 + idx)).upper(),
                            "text": option_text,
                        })
                elif isinstance(option, str):
                    option_text = option.strip()
                    if option_text:
                        options.append({"id": chr(65 + idx), "text": option_text})
            answer = str(
                item.get("answer")
                or item.get("correctAnswer")
                or item.get("correct_answer")
                or item.get("correctOption")
                or item.get("correct_option")
                or item.get("correct")
                or ""
            ).upper().strip()
            if len(answer) > 1:
                for option in options:
                    if answer == option["text"].upper():
                        answer = option["id"]
                        break
            question = str(
                item.get("question")
                or item.get("questionText")
                or item.get("prompt")
                or item.get("text")
                or ""
            ).strip()
            if question and len(options) >= 2 and answer:
                questions.append({
                    "question": question,
                    "options": options[:4],
                    "answer": answer,
                    "explanation": str(item.get("explanation") or "").strip(),
                })
        return {"questions": questions[:count]}
    return {"questions": []}


def handle_upload(
    user_id: str,
    filename: str,
    data: bytes,
    storage,
    userstore,
    vector_store,
    content_type: str | None = None,
) -> dict:
    doc_id = str(uuid.uuid4())
    raw_key = _raw_file_key(user_id, doc_id, filename)
    raw_content_type = _content_type_for_filename(filename, content_type)
    location = storage.put(raw_key, data, content_type=raw_content_type)
    text = "" if filename.lower().endswith((".doc", ".docx")) else _extract_text(filename, data)
    kb_metadata = {"user_id": user_id, "doc_id": doc_id, "filename": filename}
    kb_key = ""
    kb_text_location = ""
    status = "indexed"
    kb_warning = ""
    kb_sync_ready = config.vector_backend == "bedrock_kb"

    if kb_sync_ready:
        kb_key = _kb_file_key(user_id, doc_id, filename)
        kb_content_type = _content_type_for_filename(filename, raw_content_type)
        kb_text_location = storage.put(kb_key, data, content_type=kb_content_type)
        if hasattr(storage, "put_metadata"):
            storage.put_metadata(kb_key, {**kb_metadata, "kb_source": "original"})
        vector_store.ingest(doc_id=doc_id, text=text, metadata=kb_metadata)
    elif text.strip():
        vector_store.ingest(doc_id=doc_id, text=text, metadata=kb_metadata)

    userstore.add_doc(
        user_id=user_id,
        doc_id=doc_id,
        metadata={
            "filename": filename,
            "size": len(data),
            "location": location,
            "chars": len(text),
            "s3_key": raw_key,
            "kb_s3_key": kb_key,
            "status": status,
        },
    )
    return {
        "doc_id": doc_id,
        "filename": filename,
        "size": len(data),
        "chars_extracted": len(text),
        "location": location,
        "s3_key": raw_key,
        "kb_s3_key": kb_key if config.vector_backend == "bedrock_kb" and kb_sync_ready else "",
        "kb_text_location": kb_text_location,
        "kb_sync_requested": bool(kb_text_location) and config.vector_backend == "bedrock_kb" and kb_sync_ready,
        "kb_warning": kb_warning,
        "status": status,
    }


def handle_query(
    user_id: str,
    question: str,
    ai_client,
    userstore,
    vector_store,
    vector_backend: str,
    bedrock_kb_id: str,
    doc_id: str | None = None,
) -> dict:
    if doc_id:
        context, citations = _retrieve_context(user_id, question, vector_store, top_k=8, doc_id=doc_id)
        if not context:
            answer = _selected_doc_missing_message()
        else:
            prompt = PROMPT_TEMPLATE.format(context=context, question=question)
            answer = ai_client.invoke(prompt, max_tokens=512)
    elif vector_backend == "bedrock_kb":
        rag_question = (
            "Tra loi bang tieng Viet, than thien va ngan gon. "
            "Chi dua tren tai lieu da truy xuat. "
            "Neu tai lieu khong co thong tin phu hop, hay noi: "
            "'Mình chưa thấy thông tin này trong tài liệu bạn đã tải lên. "
            "Bạn có thể tải thêm tài liệu liên quan hoặc hỏi theo cách cụ thể hơn nhé.' "
            f"\n\nCau hoi: {question}"
        )
        result = ai_client.retrieve_and_generate(
            query=rag_question,
            kb_id=bedrock_kb_id,
            filter=_metadata_filter(user_id, doc_id),
        )
        answer = result["answer"]
        citations = result["citations"]
    else:
        chunks = vector_store.search(question, top_k=5, filter=_metadata_filter(user_id, doc_id))
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


def handle_delete_doc(user_id: str, doc_id: str, storage, userstore, vector_store) -> dict:
    doc = userstore.get_doc(user_id, doc_id)
    if not doc:
        return {"deleted": False, "doc_id": doc_id, "reason": "not_found"}

    keys = [
        key
        for key in {
            doc.get("s3_key"),
            doc.get("kb_s3_key"),
            f"{doc.get('kb_s3_key')}.metadata.json" if doc.get("kb_s3_key") else "",
        }
        if key
    ]
    deleted_keys = []
    for key in keys:
        if hasattr(storage, "delete") and storage.delete(key):
            deleted_keys.append(key)

    kb_sync_requested = False
    if hasattr(vector_store, "delete"):
        kb_sync_requested = bool(vector_store.delete(doc_id))

    userstore.delete_doc(user_id, doc_id)
    return {
        "deleted": True,
        "doc_id": doc_id,
        "filename": doc.get("filename"),
        "deleted_keys": deleted_keys,
        "kb_sync_requested": kb_sync_requested,
    }


def handle_summarize(user_id: str, ai_client, userstore, vector_store, vector_backend: str, bedrock_kb_id: str, doc_id: str | None = None) -> dict:
    task = (
        "Read only the selected document and write a Vietnamese study summary. "
        "Return Markdown with these headings: ## 5 y chinh, ## Thuat ngu can nho, "
        "## Diem de ra kiem tra, ## Goi y on tap. Do not refuse; if context is thin, summarize what is available."
    )
    if vector_backend == "bedrock_kb":
        result = ai_client.retrieve_and_generate(query=task, kb_id=bedrock_kb_id, filter=_metadata_filter(user_id, doc_id))
        summary = result["answer"]
        citations = result["citations"]
    else:
        context, citations = _retrieve_context(user_id, task, vector_store, top_k=10, doc_id=doc_id)
        if not context:
            summary = "No uploaded study material found. Upload a lecture first."
            citations = []
        else:
            prompt = f"Use only this context and create a Vietnamese study summary.\n\nCONTEXT:\n{context}\n\nSUMMARY:"
            summary = ai_client.invoke(prompt, max_tokens=700)
    userstore.log_query(user_id=user_id, query="Generate study summary", answer=summary)
    return {"summary": summary, "citations": citations}


def _structured_context_prompt(context: str, task: str) -> str:
    return (
        "Use ONLY the CONTEXT below. Return exactly one valid JSON object matching the schema. "
        "Do not include Markdown, code fences, comments, or extra prose. "
        "If the context is short, still create useful study items from the available text.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"TASK:\n{task}\n\n"
        "JSON:"
    )


def _no_synced_context_message(kind: str, doc_id: str | None) -> str:
    target = f" cho tài liệu {doc_id}" if doc_id else ""
    return (
        f"Chưa tìm thấy nội dung đã sync trong Knowledge Base{target}. "
        "Hãy kiểm tra sync history của data source, đợi job hoàn tất rồi tạo lại. "
        "Nếu đây là PDF, hãy dùng data source Default parsing hoặc để app index bản text đã trích xuất."
    )


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
        f"Create exactly {count} Vietnamese multiple-choice questions from the selected document. "
        "Return ONLY valid JSON. Do not use Markdown. Do not wrap in code fences. "
        'Schema: {"questions":[{"question":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"answer":"A","explanation":"..."}]}. '
        "Use facts from the document. If context is thin, create questions from the available text."
    )
    retrieval_query = (
        "Các khái niệm, định nghĩa, quy tắc, ví dụ và điểm quan trọng trong tài liệu "
        "để tạo câu hỏi trắc nghiệm ôn tập."
    )
    context, citations = _retrieve_context(user_id, retrieval_query, vector_store, top_k=12, doc_id=doc_id)
    if not context:
        raw = _no_synced_context_message("quiz", doc_id)
        userstore.log_query(user_id=user_id, query=f"Generate {difficulty} quiz", answer=raw)
        return {"quiz": raw, "quiz_json": None, "difficulty": difficulty, "count": count, "citations": citations}

    raw = ai_client.invoke(_structured_context_prompt(context, task), max_tokens=1100, temperature=0.1)
    payload = _normalize_quiz_payload(raw, count)
    if not payload["questions"]:
        raw = ai_client.invoke(
            _structured_context_prompt(
                context,
                task + " The previous output was invalid or empty. Create the JSON now.",
            ),
            max_tokens=1100,
            temperature=0,
        )
        payload = _normalize_quiz_payload(raw, count)
    userstore.log_query(user_id=user_id, query=f"Generate {difficulty} quiz", answer=json.dumps(payload, ensure_ascii=False))
    return {"quiz": json.dumps(payload, ensure_ascii=False), "quiz_json": payload, "difficulty": difficulty, "count": count, "citations": citations}


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
        f"Create exactly {count} Vietnamese flashcards from the selected document. "
        "Return ONLY valid JSON. Do not use Markdown. Do not wrap in code fences. "
        'Schema: {"cards":[{"front":"...","back":"..."}]}. '
        "Use concise front/back text grounded in the document. If context is thin, use what is available."
    )
    retrieval_query = (
        "Các thuật ngữ, định nghĩa, khái niệm chính và ý quan trọng trong tài liệu "
        "để tạo flashcard ôn tập."
    )
    context, citations = _retrieve_context(user_id, retrieval_query, vector_store, top_k=12, doc_id=doc_id)
    if not context:
        raw = _no_synced_context_message("flashcards", doc_id)
        userstore.log_query(user_id=user_id, query="Generate flashcards", answer=raw)
        return {"flashcards": raw, "flashcards_json": None, "count": count, "citations": citations}

    raw = ai_client.invoke(_structured_context_prompt(context, task), max_tokens=900, temperature=0.1)
    payload = _normalize_flashcard_payload(raw, count)
    if not payload["cards"]:
        raw = ai_client.invoke(
            _structured_context_prompt(
                context,
                task + " The previous output was invalid or empty. Create the JSON now.",
            ),
            max_tokens=900,
            temperature=0,
        )
        payload = _normalize_flashcard_payload(raw, count)
    userstore.log_query(user_id=user_id, query="Generate flashcards", answer=json.dumps(payload, ensure_ascii=False))
    return {"flashcards": json.dumps(payload, ensure_ascii=False), "flashcards_json": payload, "count": count, "citations": citations}


def handle_study_plan(user_id: str, userstore) -> dict:
    docs = userstore.list_docs(user_id)
    recent = userstore.recent_queries(user_id, limit=5)
    total_chars = sum(int(d.get("chars") or 0) for d in docs)
    plan = [
        "Review the newest uploaded document for 15 minutes.",
        "Ask StudyBot 3 questions about weak points.",
        "Generate flashcards and review the missed concepts.",
        "Take a short quiz, then review the cited source documents for incorrect answers.",
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
