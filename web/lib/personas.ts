import "server-only";
import fs from "node:fs";
import path from "node:path";

export type Persona = {
  id: string;
  name: string;
  trigger_keywords: string[];
  recommended_messaging: string;
  marketing_opportunity: string;
  priority: string;
};

let _personas: Persona[] | null = null;

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === header.length && r.some((c) => c.length))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

export function loadPersonas(): Persona[] {
  if (_personas) return _personas;
  const p = path.join(process.cwd(), "public", "data", "personas.json");
  if (fs.existsSync(p)) {
    _personas = JSON.parse(fs.readFileSync(p, "utf-8")) as Persona[];
    return _personas;
  }
  // Fallback: read CSV directly (build time or local dev where personas.json hasn't been exported yet)
  const csvPath = path.join(process.cwd(), "..", "data", "08_buyer_personas.csv");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf-8"));
  _personas = rows.map((r) => ({
    id: r.persona_id,
    name: r.persona_name,
    trigger_keywords: r.trigger_keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
    recommended_messaging: r.recommended_messaging,
    marketing_opportunity: r.marketing_opportunity,
    priority: r.priority,
  }));
  return _personas;
}

const WORD_BOUNDARY_RE = /[a-z0-9]/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countKeywordHits(text: string): Record<string, number> {
  const lowered = text.toLowerCase();
  const out: Record<string, number> = {};
  for (const p of loadPersonas()) {
    let hits = 0;
    for (const kw of p.trigger_keywords) {
      if (kw.includes(" ") || kw.includes("-")) {
        if (lowered.includes(kw)) hits++;
      } else {
        // word-boundary match so "kid" doesn't match inside "kidney"
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(kw)}(?=$|[^a-z0-9])`, "i");
        if (re.test(lowered)) hits++;
      }
    }
    out[p.id] = hits;
  }
  return out;
}

export function formatKeywordsForPrompt(): string {
  return loadPersonas()
    .map((p) => `- ${p.id}: ${p.trigger_keywords.join(", ")}`)
    .join("\n");
}
