"""
Deterministic, offline text embedding — EXACT mirror of backend/src/embed.ts.

Both sides must produce identical vectors so that the relevance/novelty scores the
agent computes match the scores the backend can reproduce for auditing. The algorithm
is a hashed bag of (unigram + bigram) tokens with FNV-1a bucketing and L2 normalization.

No network, no keys, fully reproducible — this keeps the whole demo self-contained.
"""
from __future__ import annotations

import math
import re
from typing import List

EMBED_DIM = 256

_TOKEN_RE = re.compile(r"[^a-z0-9\s]")
_SPLIT_RE = re.compile(r"\s+")


def tokenize(text: str) -> List[str]:
    cleaned = _TOKEN_RE.sub(" ", text.lower())
    return [t for t in _SPLIT_RE.split(cleaned) if len(t) > 1]


def hash_token(token: str) -> int:
    """FNV-1a 32-bit — must match the TS `Math.imul` implementation exactly."""
    h = 0x811C9DC5
    for ch in token:
        h ^= ord(ch)
        # Emulate Math.imul (32-bit signed multiply) then mask to 32-bit unsigned.
        h = (h * 0x01000193) & 0xFFFFFFFF
    return (h & 0xFFFFFFFF) % EMBED_DIM


def embed(text: str) -> List[float]:
    vec = [0.0] * EMBED_DIM
    tokens = tokenize(text)
    grams = list(tokens)
    for i in range(len(tokens) - 1):
        grams.append(tokens[i] + "_" + tokens[i + 1])
    for g in grams:
        vec[hash_token(g)] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: List[float], b: List[float]) -> float:
    n = min(len(a), len(b))
    # Vectors are already L2-normalized, so dot == cosine.
    return sum(a[i] * b[i] for i in range(n))
