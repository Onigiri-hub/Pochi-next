// POST /api/story/generate
// ユーザー投稿長文を並べ替え問題化する。
// フェーズ1（ベータ・無料版）: Pollyなし・Firestore保存なし（その場プレイ用に返すだけ）。
//   AIキー未設定時は lib/llm.js が mock にフォールバックするので、キー無しでもフローを通せる。
//
// en入力: 英文はサーバー側で「文末記号（. ! ? ; :）」で機械分割し、AIには和訳だけ出させる（出力トークン節約）。
// ja入力: AIが英語生成＋文分割＋和訳をまとめて行う。

import { generateJSON } from "../../../lib/llm"
import { verifyUser, PLAN_LIMITS } from "../../../lib/verifyUser"
import { getDifficulty, buildEnglishStyle } from "../../../lib/difficulty"

function toChips(answer) {
  return answer.trim().split(/\s+/).join("|")
}
function normalizeSentence(s) {
  return (s || "").replace(/\s+/g, " ").trim()
}

// 略語っぽいトークン（Mr. / U.S. / e.g. 等）は文末とみなさず次に結合する
function isAbbrev(tok) {
  return /\.\w/.test(tok) || /^(mr|mrs|ms|dr|prof|st|vs|etc|no|inc|co|ltd)\.$/i.test(tok)
}

// 英文を文末記号（. ! ? ; :）で機械分割。カンマ・途中では切らない（断片翻訳の不自然さを避ける）。
function splitEnglishSentences(text) {
  const rough = text
    .replace(/([.!?;:])\s+/g, "$1\n")
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
  // 略語での誤分割を結合で補正
  const merged = []
  for (const piece of rough) {
    const prev = merged[merged.length - 1]
    if (prev && !prev.includes(" ") && isAbbrev(prev)) {
      merged[merged.length - 1] = `${prev} ${piece}`
    } else {
      merged.push(piece)
    }
  }
  return merged.map(normalizeSentence).filter(Boolean)
}

// en入力: 分割済み英文 → 和訳だけ番号順で返させる最小プロンプト
function buildEnTranslatePrompt(enList, jaNote) {
  const numbered = enList.map((s, i) => `${i + 1}. ${s}`).join("\n")
  return `次の英文を1つずつ${jaNote}に翻訳してください。英文と同じ数・同じ順番で訳を返すこと。
出力は次のJSON形式のみ（説明文なし）:
{"translations":["…","…"]}

英文:
${numbered}`
}

// ja入力: 英語生成＋分割＋和訳をまとめて行う最小プロンプト
function buildJaGeneratePrompt(text, style) {
  return `次の日本語を英語に翻訳してください。
スタイル: ${style}
自然な英語で1文4〜12語程度に分け、各文に和訳をつけること。
出力は次のJSON形式のみ（説明文なし）:
{"sentences":[{"en":"…","ja":"…"}]}

日本語:
"""
${text}
"""`
}

// ja入力mock（キー無し確認用）: 素朴に文分割して英訳ダミー
function buildMockJa(text) {
  const parts = text
    .replace(/([.!?。！？])\s*/g, "$1\n")
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
  const list = parts.length ? parts : [text.trim()]
  return { sentences: list.map(p => ({ en: `(mock EN) ${p}`, ja: p })) }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  try {
    const { text, inputLang, title, difficulty, tone } = req.body || {}
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "empty_text" })
    }
    if (inputLang !== "en" && inputLang !== "ja") {
      return res.status(400).json({ error: "invalid_inputLang" })
    }
    // difficulty / tone は未指定なら lib/difficulty.js 側でデフォルトにフォールバック

    const { plan } = await verifyUser(req)
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

    // 入力バリデーション（設計書2-1）
    if (inputLang === "en") {
      const words = text.trim().split(/\s+/).length
      if (words > limits.enWords) {
        return res.status(400).json({ error: "too_long", detail: `英語は${limits.enWords}語までです（現在${words}語）` })
      }
    } else {
      const chars = text.trim().length
      if (chars > limits.jaChars) {
        return res.status(400).json({ error: "too_long", detail: `日本語は${limits.jaChars}字までです（現在${chars}字）` })
      }
    }

    // TODO(フェーズ2・有料枠前に必須): usage/{今日(JST)} を読んで storyPerDay 上限チェック → 処理後インクリメント。
    //   ※安全フィルタで拒否された試行もトークンを消費し得るため、「成功＋content_blocked」の両方をカウントする
    //     （こちら側の一時エラー=server_error はカウントしない）。要 firebase-admin + Firestore + 実uid。

    let sentences
    if (inputLang === "en") {
      // 英文は機械分割 → AIは和訳のみ
      const enList = splitEnglishSentences(text)
      if (enList.length === 0) {
        return res.status(500).json({ error: "generation_failed" })
      }
      const jaNote = getDifficulty(difficulty).jaTranslationNote
      const data = await generateJSON({
        system: "",
        prompt: buildEnTranslatePrompt(enList, jaNote),
        maxTokens: 1500,
        mock: () => ({ translations: enList.map(s => `(モック和訳) ${s}`) }),
      })
      const translations = Array.isArray(data?.translations) ? data.translations : []
      sentences = enList.map((en, i) => ({
        id: `s${i + 1}`,
        en,
        ja: normalizeSentence(translations[i] || ""),
        answer: en,
        chips: toChips(en),
        audio: null,
      }))
    } else {
      // 日本語 → 英語生成（AIが分割＋和訳もまとめて）
      const style = buildEnglishStyle(difficulty, tone)
      const data = await generateJSON({
        system: "",
        prompt: buildJaGeneratePrompt(text, style),
        maxTokens: 1500,
        mock: () => buildMockJa(text),
      })
      const raw = Array.isArray(data?.sentences) ? data.sentences : []
      if (raw.length === 0) {
        return res.status(500).json({ error: "generation_failed" })
      }
      sentences = raw.map((s, i) => {
        const en = normalizeSentence(s.en)
        return {
          id: `s${i + 1}`,
          en,
          ja: normalizeSentence(s.ja),
          answer: en,
          chips: toChips(en),
          audio: null,
        }
      })
    }

    // TODO(フェーズ2): basic/premium は Polly生成 + Firestore保存 + usage更新

    return res.status(200).json({
      storyId: `mystory_${Date.now()}`,
      title: (title || "").trim(),
      inputLang,
      sentences,
    })
  } catch (e) {
    if (e && e.code === "content_blocked") {
      return res.status(400).json({ error: "content_blocked", detail: "この内容では問題を作成できませんでした。表現を見直してください。" })
    }
    if (e && e.code === "rate_limited") {
      return res.status(429).json({ error: "rate_limited", detail: "ただいまアクセスが集中しています。しばらく時間をおいて、もう一度お試しください。" })
    }
    if (e && e.code === "unavailable") {
      return res.status(503).json({ error: "unavailable", detail: "現在AIサーバーが混み合っています。少し時間をおいて、もう一度お試しください。" })
    }
    console.error("[/api/story/generate]", e)
    return res.status(500).json({ error: "server_error" })
  }
}
