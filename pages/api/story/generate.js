// POST /api/story/generate
// ユーザー投稿長文を並べ替え問題化する。
// フェーズ1（ベータ・無料版）: AI翻訳/文分割のみ。Pollyなし・Firestore保存なし（その場プレイ用に返すだけ）。
//   AIキー未設定時は lib/llm.js が mock にフォールバックするので、キー無しでもフローを通せる。

import { generateJSON } from "../../../lib/llm"
import { verifyUser, PLAN_LIMITS } from "../../../lib/verifyUser"
import { getDifficulty, buildEnglishStyle } from "../../../lib/difficulty"

// answer を単語分割して chips 文字列にする（generateArrangeExamples.js と同じ思想）
function toChips(answer) {
  return answer.trim().split(/\s+/).join("|")
}

// 前後の余分なスペースを除去し、連続スペースを1つに正規化
function normalizeSentence(s) {
  return (s || "").replace(/\s+/g, " ").trim()
}

// --- mock用: キー無しでもフロー確認できるダミー生成 ---
function buildMockStory(text, inputLang) {
  // 素朴に文分割（. ! ? / 。！？ で区切る）。mockなので精度は問わない。
  const sentences = text
    .replace(/([.!?。！？])\s*/g, "$1\n")
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
  // 長い文（目安15語超）はカンマでさらに分割して、並べ替えに使いやすい長さにする。
  // ※本番AIはプロンプト側で対応する和訳ごと分割する。mockはダミー訳なので英文だけ機械分割。
  const raw = sentences.flatMap(s => {
    if (s.split(/\s+/).length <= 15 || !s.includes(",")) return [s]
    return s.split(/,\s*/).map(t => t.trim()).filter(Boolean)
  })
  const parts = raw.length ? raw : [text.trim()]
  return {
    sentences: parts.map(p =>
      inputLang === "ja"
        ? { en: `(mock EN) ${p}`, ja: p }        // ja入力: 英訳はダミー
        : { en: p, ja: `(モック和訳) ${p}` }      // en入力: 和訳はダミー
    ),
  }
}

function buildPrompt(text, inputLang, difficultyId, toneId) {
  if (inputLang === "ja") {
    // 英語生成: 難易度＋カジュアルさをスタイル指示として反映
    const style = buildEnglishStyle(difficultyId, toneId)
    return `以下の日本語の文章を、次のスタイルの自然な英語に翻訳してください。
スタイル: ${style}
1文ずつに分割し、それぞれ英文と日本語訳のペアで出力してください。
英文は並べ替え問題に使える長さ（1文あたり4〜12語程度）にしてください。
出力は必ず次のJSON形式のみ（前後に説明文を書かない）:
{"sentences":[{"en":"...","ja":"..."}, ...]}

日本語文:
"""
${text}
"""`
  }
  // en入力: 英文はユーザー提供のものを保持するので難易度は変えられない。
  // 和訳の読みやすさだけ難易度に合わせる。
  const jaNote = getDifficulty(difficultyId).jaTranslationNote
  return `以下の英文を、並べ替え問題に使いやすい長さのまとまりに区切り、それぞれに自然な日本語訳をつけてください。
- 基本は1文ずつ。ただし1文が長い場合（目安15語超）は、カンマや接続詞（and, but, so, because, that, which, when など）といった意味の切れ目で2〜3個のまとまりに分けてください。
- 英文の語順・表記は変えない（区切って分けるだけ。単語の追加・削除・言い換えはしない）。
- 各まとまりは、それ単体で意味が取れる自然な区切りにする。
- 日本語訳は${jaNote}にし、必ず「その英文のまとまり」に対応する内容にする（まとまりごとに英文と和訳が1対1で対応するように）。
出力は必ず次のJSON形式のみ（前後に説明文を書かない）:
{"sentences":[{"en":"...","ja":"..."}, ...]}

英文:
"""
${text}
"""`
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
    // difficulty / tone は未指定なら lib/difficulty.js 側でデフォルト（中学・やさしい語り口）にフォールバック

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

    // TODO(フェーズ2): usage/{今日(JST)} を読んで storyPerDay 上限チェック → 処理後インクリメント

    // AI呼び出し（キー無しなら mock）
    const data = await generateJSON({
      system: "",
      prompt: buildPrompt(text, inputLang, difficulty, tone),
      maxTokens: 1500,
      mock: () => buildMockStory(text, inputLang),
    })

    const rawSentences = Array.isArray(data?.sentences) ? data.sentences : []
    if (rawSentences.length === 0) {
      return res.status(500).json({ error: "generation_failed" })
    }

    // answer / chips をサーバー側でローカル生成
    const sentences = rawSentences.map((s, i) => {
      const en = normalizeSentence(s.en)
      const answer = en
      return {
        id: `s${i + 1}`,
        en,
        ja: normalizeSentence(s.ja),
        answer,
        chips: toChips(answer),
        audio: null, // フェーズ1: 音声なし（story.jsx側でWeb Speechにフォールバック）
      }
    })

    // TODO(フェーズ2): basic/premium は Polly生成 + Firestore保存 + usage更新

    return res.status(200).json({
      storyId: `mystory_${Date.now()}`,
      title: (title || "").trim(),
      inputLang,
      sentences,
    })
  } catch (e) {
    console.error("[/api/story/generate]", e)
    return res.status(500).json({ error: "server_error" })
  }
}
