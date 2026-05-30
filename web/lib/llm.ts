import "server-only";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

export type Provider = "claude" | "qwen";

type ProviderConfig = {
  baseUrl: string;
  apiKey: () => string | undefined;
  defaultModel: string;
};

const PROVIDERS: Record<Provider, ProviderConfig> = {
  claude: {
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: () => process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6",
  },
  qwen: {
    baseUrl: process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    apiKey: () => process.env.DASHSCOPE_API_KEY,
    defaultModel: process.env.DASHSCOPE_MODEL || "qwen-plus",
  },
};

const _clients: Partial<Record<Provider, OpenAI>> = {};
function client(provider: Provider): OpenAI {
  if (_clients[provider]) return _clients[provider]!;
  const cfg = PROVIDERS[provider];
  const apiKey = cfg.apiKey();
  if (!apiKey) {
    const envName = provider === "claude" ? "OPENROUTER_API_KEY" : "DASHSCOPE_API_KEY";
    throw new Error(`${envName} not set (required for provider "${provider}")`);
  }
  _clients[provider] = new OpenAI({ apiKey, baseURL: cfg.baseUrl });
  return _clients[provider]!;
}

const promptCache = new Map<string, string>();
export function loadPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached) return cached;
  const p = path.join(process.cwd(), "lib", "prompts", `${name}.txt`);
  const text = fs.readFileSync(p, "utf-8");
  promptCache.set(name, text);
  return text;
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

type CallOpts = { provider?: Provider; model?: string; maxTokens?: number };

export async function call(system: string, user: string, opts: CallOpts = {}): Promise<string> {
  const provider = opts.provider ?? "claude";
  const cfg = PROVIDERS[provider];
  const resp = await client(provider).chat.completions.create({
    model: opts.model || cfg.defaultModel,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return (resp.choices[0]?.message?.content ?? "").trim();
}

export async function callJson<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: CallOpts = {},
): Promise<T> {
  const raw = await call(system, user, opts);
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in model output: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}
