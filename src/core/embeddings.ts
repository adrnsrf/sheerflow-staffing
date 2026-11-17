/**
 * Text to vectors, on this machine. The model (Universal Sentence Encoder, 512 numbers per text)
 * ships inside an npm package, so there is no API key, no per-use cost and nothing is sent
 * anywhere. Vectors are stored in Postgres (pgvector) and compared with cosine distance.
 *
 * To use a different model later, change this one file: `embed` in, vectors out, and update
 * EMBEDDING_DIMS (then re-embed).
 */
import type { EmbeddingsModel } from "@energetic-ai/embeddings";

export const EMBEDDING_DIMS = 512;

const holder = globalThis as unknown as { __sheerflowEmbedder?: Promise<EmbeddingsModel> };

async function model() {
  return (holder.__sheerflowEmbedder ??= (async () => {
    const [{ initModel }, { modelSource }] = await Promise.all([import("@energetic-ai/embeddings"), import("@energetic-ai/model-embeddings-en")]);
    return initModel(modelSource);
  })());
}

/** One vector per text. Long texts are cut to roughly what the model reads well. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const m = await model();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) out.push(...(await m.embed(texts.slice(i, i + 16).map((t) => t.slice(0, 4000)))).map((v) => Array.from(v)));
  return out;
}

/** The text form Postgres expects for a vector value. */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
