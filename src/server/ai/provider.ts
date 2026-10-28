import { ApiError } from "../http";

export type ProviderMode = "local" | "openai";

export interface ProviderInfo {
  id: ProviderMode;
  label: string;
  configured: boolean;
  mode: "deterministic" | "model";
  model?: string;
  note: string;
}

export function providerInfo(): ProviderInfo {
  const provider = (process.env.AI_PROVIDER || "local").toLowerCase();
  if (provider === "openai") {
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
      id: "openai",
      label: "OpenAI-compatible",
      configured,
      mode: "model",
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      note: configured
        ? "Conteúdo gerado por modelo de linguagem a partir de factos confirmados do imóvel."
        : "OPENAI_API_KEY não está definida. O sistema usa o motor determinístico local até a chave ser configurada.",
    };
  }
  return {
    id: "local",
    label: "Motor determinístico ESTATE OS",
    configured: true,
    mode: "deterministic",
    note: "Regras locais sobre os dados confirmados do imóvel. Não é um modelo de linguagem — o resultado é previsível e auditável.",
  };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface TextResult {
  text: string;
  provider: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  latencyMs: number;
}

export async function generateText(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<TextResult> {
  const info = providerInfo();
  if (info.id !== "openai" || !info.configured) {
    throw new ApiError(
      "O fornecedor de IA não está configurado. O motor local é usado em alternativa.",
      409,
      "provider_unconfigured",
    );
  }
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1600,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(
        `O fornecedor de IA respondeu com erro ${response.status}.`,
        502,
        "provider_error",
        { status: response.status, body: body.slice(0, 400) },
      );
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ApiError("Resposta vazia do fornecedor de IA.", 502, "provider_empty");
    return {
      text,
      provider: `openai:${process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini"}`,
      usage: data.usage,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new ApiError("O fornecedor de IA excedeu o tempo de resposta.", 504, "provider_timeout");
    }
    throw new ApiError("Não foi possível contactar o fornecedor de IA.", 502, "provider_unreachable", {
      message: (error as Error).message,
    });
  } finally {
    clearTimeout(timer);
  }
}
