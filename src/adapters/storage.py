"""Object storage adapters. Pick via STORAGE_BACKEND env var.

Interface:
    put(key, data, content_type=None) -> str (returns location URI)
    put_metadata(key, metadata) -> str
    get(key) -> bytes
    list(prefix="") -> list[str]
    delete(key) -> bool
"""
import json
from pathlib import Path
from typing import Any


class S3Storage:
    def __init__(self, bucket: str, region: str):
        import boto3
        if not bucket:
            raise ValueError("STORAGE_BUCKET must be set for S3 backend")
        self.s3 = boto3.client("s3", region_name=region)
        self.bucket = bucket

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        extra_args = {"ContentType": content_type} if content_type else {}
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, **extra_args)
        return f"s3://{self.bucket}/{key}"

    def put_metadata(self, key: str, metadata: dict) -> str:
        sidecar_key = f"{key}.metadata.json"
        attributes = {
            str(k): {
                "value": {
                    "type": "STRING",
                    "stringValue": str(v),
                },
                "includeForEmbedding": False,
            }
            for k, v in metadata.items()
            if v is not None
        }
        self.s3.put_object(
            Bucket=self.bucket,
            Key=sidecar_key,
            Body=json.dumps({"metadataAttributes": attributes}).encode("utf-8"),
            ContentType="application/json",
        )
        return f"s3://{self.bucket}/{sidecar_key}"

    def get(self, key: str) -> bytes:
        resp = self.s3.get_object(Bucket=self.bucket, Key=key)
        return resp["Body"].read()

    def delete(self, key: str) -> bool:
        deleted_versions = self._delete_versions(key)
        if deleted_versions:
            return True
        self.s3.delete_object(Bucket=self.bucket, Key=key)
        return True

    def _delete_versions(self, key: str) -> int:
        """Permanently delete all S3 versions for a key when bucket versioning is on."""
        try:
            paginator = self.s3.get_paginator("list_object_versions")
            version_refs = []
            for page in paginator.paginate(Bucket=self.bucket, Prefix=key):
                for item in page.get("Versions", []):
                    if item.get("Key") == key:
                        version_refs.append({"Key": key, "VersionId": item["VersionId"]})
                for item in page.get("DeleteMarkers", []):
                    if item.get("Key") == key:
                        version_refs.append({"Key": key, "VersionId": item["VersionId"]})
        except Exception:
            return 0

        deleted = 0
        for start in range(0, len(version_refs), 1000):
            batch = version_refs[start:start + 1000]
            if not batch:
                continue
            self.s3.delete_objects(
                Bucket=self.bucket,
                Delete={"Objects": batch, "Quiet": True},
            )
            deleted += len(batch)
        return deleted

    def list(self, prefix: str = "") -> list:
        resp = self.s3.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        return [obj["Key"] for obj in resp.get("Contents", [])]


class LocalStorage:
    """Filesystem-based storage. Mirrors S3 API for drop-in replacement."""

    def __init__(self, base_dir: str):
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        path = self.base / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"file://{path.resolve()}"

    def put_metadata(self, key: str, metadata: dict) -> str:
        path = self.base / f"{key}.metadata.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        attributes = {
            str(k): {
                "value": {
                    "type": "STRING",
                    "stringValue": str(v),
                },
                "includeForEmbedding": False,
            }
            for k, v in metadata.items()
            if v is not None
        }
        path.write_text(json.dumps({"metadataAttributes": attributes}), encoding="utf-8")
        return f"file://{path.resolve()}"

    def get(self, key: str) -> bytes:
        return (self.base / key).read_bytes()

    def delete(self, key: str) -> bool:
        path = self.base / key
        if not path.exists():
            return False
        path.unlink()
        return True

    def list(self, prefix: str = "") -> list:
        results = []
        for p in self.base.rglob("*"):
            if p.is_file():
                rel = str(p.relative_to(self.base))
                if rel.startswith(prefix):
                    results.append(rel)
        return results
