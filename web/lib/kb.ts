import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { KbChunk, KbHit } from "./types";

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","he","i","in",
  "is","it","its","of","on","that","the","to","was","will","with","you","your","my",
  "this","what","when","where","which","who","why","how","do","does","did","can",
  "could","should","would","there","their","they","them","or","but","if","not",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function uniqueTerms(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function calibrateBm25Score(score: number, queryCoverage: number): number {
  // BM25 scores are unbounded and corpus-specific. Convert the raw score to a
  // conservative confidence signal, then temper it by how much of the query was
  // actually covered so one coincidental keyword cannot auto-route a reply.
  const rawSignal = 1 - Math.exp(-score / 4);
  return Math.max(0, Math.min(1, rawSignal * 0.7 + queryCoverage * 0.3));
}

let _index: BM25Index | null = null;

export function getIndex(): BM25Index {
  if (_index) return _index;
  const p = path.join(process.cwd(), "public", "data", "kb.json");
  const chunks: KbChunk[] = JSON.parse(fs.readFileSync(p, "utf-8"));
  _index = new BM25Index(chunks);
  return _index;
}

const PRIORITY_BOOST: Record<number, number> = { 1: 0.0, 2: 0.05, 3: 0.1 };

export class BM25Index {
  private chunks: KbChunk[];
  private docs: string[][];
  private df: Map<string, number>;
  private avgDl: number;
  private k1 = 1.5;
  private b = 0.75;

  constructor(chunks: KbChunk[]) {
    this.chunks = chunks;
    this.docs = chunks.map((c) => tokenize(c.text));
    this.df = new Map();
    for (const tokens of this.docs) {
      const seen = new Set(tokens);
      for (const t of seen) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgDl = this.docs.reduce((s, d) => s + d.length, 0) / Math.max(1, this.docs.length);
  }

  private idf(term: string): number {
    const df = this.df.get(term) ?? 0;
    const N = this.docs.length;
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  search(query: string, topK = 5): KbHit[] {
    const qTerms = uniqueTerms(tokenize(query));
    if (qTerms.length === 0) return [];

    const scores: number[] = new Array(this.docs.length).fill(0);
    const coverages: number[] = new Array(this.docs.length).fill(0);
    for (let i = 0; i < this.docs.length; i++) {
      const doc = this.docs[i];
      const dl = doc.length;
      const tf = new Map<string, number>();
      for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
      let s = 0;
      let matched = 0;
      for (const term of qTerms) {
        const f = tf.get(term);
        if (!f) continue;
        matched += 1;
        const idf = this.idf(term);
        const norm = 1 - this.b + this.b * (dl / this.avgDl);
        s += idf * ((f * (this.k1 + 1)) / (f + this.k1 * norm));
      }
      scores[i] = s;
      coverages[i] = matched / qTerms.length;
    }

    const ranked = scores
      .map((s, i) => ({ i, s }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, topK);

    return ranked.map(({ i, s }) => {
      const chunk = this.chunks[i];
      const coverage = coverages[i];
      const sim = calibrateBm25Score(s, coverage);
      const priority = Number(chunk.metadata.source_priority ?? 1);
      const adjusted = Math.min(1, sim + (PRIORITY_BOOST[priority] ?? 0));
      return {
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        similarity: Number(sim.toFixed(3)),
        adjusted_score: Number(adjusted.toFixed(3)),
        raw_score: Number(s.toFixed(3)),
        query_coverage: Number(coverage.toFixed(3)),
      };
    });
  }
}
