// AI（LLM）呼び出しのプロバイダ抽象化レイヤ。
// ★将来 Claude → Gemini などに乗り換える場合、変更するのはこのファイルだけ。
//   API Route（呼び出し側）は generateJSON() を呼ぶだけで、SDKには一切依存しない。
//
// プロバイダは環境変数 LLM_PROVIDER で切替:
//   "gemini" / "claude" / "mock"
//   明示指定が無ければ「入っているキー」で自動判定。どのキーも無ければ "mock"（＝無料・課金ゼロ）。

const CLAUDE_MODEL = "claude-haiku-4-5"
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"

export function getProvider() {
  const explicit = process.env.LLM_PROVIDER
  if (explicit) return explicit
  if (process.env.GEMINI_API_KEY) return "gemini"
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
    const text = await callGemini({ system, prompt, maxTokens })
    return parseJSONLoose(text)
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

// --- Gemini アダプタ ---
async function callGemini({ system, prompt, maxTokens }) {
  // 動的importにすることで、mock運用時も未使用なら実行時に触らない。
  const { GoogleGenAI } = await import("@google/genai")
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      ...(system ? { systemInstruction: system } : {}),
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      // 思考トークンを抑える（この用途は推論不要）。上げれば分割/翻訳の質は上がるがコスト増。
      thinkingConfig: { thinkingBudget: 0 },
      // JSONで返させる（parseJSONLoose と二段構え）
      responseMimeType: "application/json",
    },
  })
  return res.text
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
