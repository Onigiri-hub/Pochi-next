// AI（LLM）呼び出しのプロバイダ抽象化レイヤ。
// ★将来 Claude → Gemini などに乗り換える場合、変更するのはこのファイルだけ。
//   API Route（呼び出し側）は generateJSON() を呼ぶだけで、SDKには一切依存しない。
//
// プロバイダは環境変数 LLM_PROVIDER で切替:
//   "claude"（既定・ANTHROPIC_API_KEYがある場合） / "gemini"（未実装スロット） / "mock"
//   キーが無ければ自動で "mock" にフォールバックし、キー無しでもフロー全体を通せる。

const CLAUDE_MODEL = "claude-haiku-4-5"

export function getProvider() {
  const explicit = process.env.LLM_PROVIDER
  if (explicit) return explicit
  if (process.env.ANTHROPIC_API_KEY) return "claude"
  return "mock"
}

// JSON形式の応答を返すLLM呼び出し。
// 引数:
//   system   : システムプロンプト
//   prompt   : ユーザープロンプト
//   maxTokens: 最大トークン
//   mock     : () => object  … mockプロバイダ時に返すダミー結果を組み立てる関数（各Routeが用意）
// 戻り値: パース済みのオブジェクト（例: { sentences: [...] }）
export async function generateJSON({ system, prompt, maxTokens = 1500, mock }) {
  const provider = getProvider()

  if (provider === "mock") {
    if (!mock) throw new Error("mock provider requires a mock() builder")
    return mock()
  }

  if (provider === "claude") {
    const text = await callClaude({ system, prompt, maxTokens })
    return parseJSONLoose(text)
  }

  if (provider === "gemini") {
    // TODO: Geminiアダプタを実装（@google/generative-ai 等）。
    //   const text = await callGemini({ system, prompt, maxTokens })
    //   return parseJSONLoose(text)
    throw new Error("gemini provider is not implemented yet")
  }

  throw new Error(`unknown LLM provider: ${provider}`)
}

// --- Claude アダプタ ---
async function callClaude({ system, prompt, maxTokens }) {
  // 動的importにすることで、mock運用時は @anthropic-ai/sdk 未インストールでも動く。
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  })
  return res.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
}

// コードフェンス等で包まれても拾えるようにゆるくJSONパースする。
export function parseJSONLoose(text) {
  if (!text) throw new Error("empty LLM response")
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(cleaned)
  } catch {
    // 最初の { から最後の } までを抜き出して再試行
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error("failed to parse LLM JSON response")
  }
}
