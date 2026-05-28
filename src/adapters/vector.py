"""Vector store adapters. Pick via VECTOR_BACKEND env var.

Interface:
    ingest(doc_id, text, metadata=None) -> None
    delete(doc_id) -> bool
    search(query, top_k=5, filter=None) -> list[dict] (each has 'text', 'doc_id', 'score', 'metadata')
"""
import re
from collections import Counter
from typing import Optional
from urllib.parse import unquote


def _bedrock_filter(metadata_filter: dict) -> dict:
    conditions = [
        {"equals": {"key": str(k), "value": str(v)}}
        for k, v in metadata_filter.items()
    ]
    if len(conditions) == 1:
        return conditions[0]
    return {"andAll": conditions}


class BedrockKBVector:
    """Production: Bedrock Knowledge Base abstracts the vector store backend.

    Group still chooses the underlying vector store (OpenSearch Serverless, S3 Vectors,
    Aurora pgvector, Pinecone) when creating the KB in AWS console — that choice
    is invisible to this code.

    NOTE: KB ingestion is async via StartIngestionJob, normally triggered by S3 events.
    For simplicity, this adapter is search-only — ingestion happens through the
    Bedrock console or S3 → KB sync pipeline you set up separately.
    """

    def __init__(self, kb_id: str, data_source_id: str, region: str):
        import boto3
        if not kb_id:
            raise ValueError("VECTOR_BEDROCK_KB_ID must be set for Bedrock KB backend")
        self.kb_id = kb_id
        self.data_source_id = data_source_id
        self.agent_runtime = boto3.client("bedrock-agent-runtime", region_name=region)
        self.agent = boto3.client("bedrock-agent", region_name=region)

    def ingest(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        # Ingestion is typically S3-event driven. Trigger a manual sync if needed
        # via StartIngestionJob — but the doc must already be in the KB's S3 source.
        # This adapter assumes upstream code uploaded to S3 already.
        if not self.data_source_id:
            raise ValueError(
                "VECTOR_BEDROCK_DATA_SOURCE_ID must be set to auto-sync Bedrock KB after upload"
            )
        try:
            self.agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.data_source_id,
                description=f"StudyBot upload sync for doc_id={doc_id}",
            )
        except self.agent.exceptions.ConflictException:
            return

    def delete(self, doc_id: str) -> bool:
        if not self.data_source_id:
            return False
        try:
            self.agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.data_source_id,
                description=f"StudyBot delete sync for doc_id={doc_id}",
            )
        except self.agent.exceptions.ConflictException:
            return False
        return True

    @staticmethod
    def _metadata_from_uri(uri: str) -> dict:
        if not uri:
            return {}
        path = uri.split("://", 1)[-1].split("/", 1)[-1]
        parts = [unquote(part) for part in path.split("/") if part]
        metadata = {}
        if parts:
            filename = parts[-1]
            if filename.endswith(".metadata.json"):
                filename = filename[:-14]
            metadata["filename"] = filename
        if len(parts) >= 2:
            metadata["doc_id"] = parts[-2]
        if len(parts) >= 3:
            metadata["user_id"] = parts[-3]
        return metadata

    def search(self, query: str, top_k: int = 5, filter: Optional[dict] = None) -> list:
        kwargs = {
            "knowledgeBaseId": self.kb_id,
            "retrievalQuery": {"text": query},
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {"numberOfResults": top_k}
            },
        }
        if filter:
            kwargs["retrievalConfiguration"]["vectorSearchConfiguration"]["filter"] = {
                **_bedrock_filter(filter)
            }
        resp = self.agent_runtime.retrieve(**kwargs)
        results = []
        for r in resp.get("retrievalResults", []):
            location = r.get("location", {})
            uri = location.get("s3Location", {}).get("uri", "")
            metadata = {**self._metadata_from_uri(uri), **(r.get("metadata", {}) or {})}
            results.append({
                "text": r.get("content", {}).get("text", ""),
                "doc_id": metadata.get("doc_id", ""),
                "score": r.get("score", 0.0),
                "metadata": {**metadata, "source": location, "uri": uri},
            })
        return results


class LocalVector:
    """Simple in-memory inverted index + TF scoring. NOT semantic — keyword only.

    Good enough for verifying the API contract locally. Production needs real
    embeddings + ANN — that's what Bedrock KB provides.
    """

    def __init__(self):
        self.docs: list[tuple[str, str, dict]] = []   # (doc_id, text, metadata)

    @staticmethod
    def _tokens(text: str) -> list:
        return [t.lower() for t in re.findall(r"\w+", text) if len(t) > 2]

    @staticmethod
    def _chunk(text: str, size: int = 500) -> list:
        # Naive chunking by sentence-ish boundaries
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks, current = [], ""
        for s in sentences:
            if len(current) + len(s) < size:
                current += " " + s
            else:
                if current.strip():
                    chunks.append(current.strip())
                current = s
        if current.strip():
            chunks.append(current.strip())
        return chunks or [text]

    def ingest(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        md = metadata or {}
        for i, chunk in enumerate(self._chunk(text)):
            self.docs.append((f"{doc_id}#{i}", chunk, {**md, "doc_id": doc_id, "chunk_idx": i}))

    def delete(self, doc_id: str) -> bool:
        before = len(self.docs)
        self.docs = [item for item in self.docs if item[2].get("doc_id") != doc_id]
        return len(self.docs) != before

    def search(self, query: str, top_k: int = 5, filter: Optional[dict] = None) -> list:
        q_tokens = set(self._tokens(query))
        results = []
        for chunk_id, text, md in self.docs:
            if filter and not all(md.get(k) == v for k, v in filter.items()):
                continue
            d_tokens = Counter(self._tokens(text))
            score = sum(d_tokens[t] for t in q_tokens)
            if score > 0:
                results.append({
                    "text": text,
                    "doc_id": md.get("doc_id", chunk_id),
                    "score": float(score),
                    "metadata": md,
                })
        results.sort(key=lambda r: -r["score"])
        return results[:top_k]
