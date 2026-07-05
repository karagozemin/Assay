/**
 * Deterministic, offline text embedding.
 *
 * We deliberately avoid a network embedding API here so the whole demo runs with zero
 * external keys and is fully reproducible. This is a hashed bag-of-token-bigrams vector
 * with L2 normalization — good enough to give the ASSAY node meaningful relevance and
 * novelty (overlap) signals between task prompts and source abstracts.
 *
 * The SAME function is mirrored in the Python agent (agent/assay/embed.py) so scores match.
 */

export const EMBED_DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// FNV-1a 32-bit hash → stable bucket index.
function hashToken(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % EMBED_DIM;
}

export function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text);
  // unigrams + bigrams
  const grams: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    grams.push(tokens[i] + "_" + tokens[i + 1]);
  }
  for (const g of grams) {
    vec[hashToken(g)] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized
}
