from __future__ import annotations

import hashlib
import json


def stable_hash(payload: dict) -> str:
    """Stable SHA-256 hash of a JSON-serializable payload."""
    s = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()
