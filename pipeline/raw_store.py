"""
Raw Store: Immutable storage for downloaded NSE files with SHA-256 checksum verification.
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Optional, Dict
from pipeline.config import RAW_CHECKSUM_FILE

class RawStore:
    def __init__(self, checksum_file: Path = RAW_CHECKSUM_FILE):
        self.checksum_file = checksum_file
        self.checksum_file.parent.mkdir(parents=True, exist_ok=True)
        self.checksums: Dict[str, dict] = self._load_manifest()

    def _load_manifest(self) -> Dict[str, dict]:
        if self.checksum_file.exists():
            try:
                with open(self.checksum_file, "r") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_manifest(self):
        with open(self.checksum_file, "w") as f:
            json.dump(self.checksums, f, indent=2, sort_keys=True)

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        h = hashlib.sha256()
        h.update(data)
        return h.hexdigest()

    def store_file(self, target_path: Path, content: bytes, metadata: Optional[dict] = None) -> Path:
        """
        Store content at target_path immutably.
        If file already exists:
          - If checksum matches, returns existing path (idempotent).
          - If checksum differs, raises FileExistsError (never overwrite rule).
        """
        target_path = Path(target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        sha256 = self.compute_sha256(content)
        rel_key = str(target_path.as_posix())

        if target_path.exists():
            with open(target_path, "rb") as f:
                existing_sha = self.compute_sha256(f.read())
            if existing_sha == sha256:
                # Idempotent skip
                return target_path
            else:
                raise FileExistsError(
                    f"Immutable violation: {target_path} already exists with different checksum ({existing_sha} vs {sha256}). Never overwriting!"
                )

        # Write file atomically via temp file
        temp_path = target_path.with_suffix(target_path.suffix + ".tmp")
        with open(temp_path, "wb") as f:
            f.write(content)
        temp_path.replace(target_path)

        # Update manifest
        entry = {
            "sha256": sha256,
            "size_bytes": len(content),
            "stored_at": str(target_path.stat().st_mtime),
        }
        if metadata:
            entry.update(metadata)
        self.checksums[rel_key] = entry
        self._save_manifest()
        return target_path

    def get_file(self, path: Path) -> Optional[bytes]:
        path = Path(path)
        if not path.exists():
            return None
        with open(path, "rb") as f:
            content = f.read()
        sha256 = self.compute_sha256(content)
        rel_key = str(path.as_posix())
        if rel_key in self.checksums:
            expected = self.checksums[rel_key]["sha256"]
            if expected != sha256:
                raise ValueError(f"Checksum mismatch for {path}! Expected {expected}, got {sha256}")
        return content
