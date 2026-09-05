// 生成英語のスタイル設定。長文生成（ja入力）・おしゃべり（チャット）で共通利用する。
// 2軸: ① difficulty（難易度） ② tone（カジュアルさ）。各2段階。
//
// ★将来ユーザー設定に保存する想定（users/{uid}.level / .tone）。未指定なら DEFAULT にフォールバック。
// 文言は使いながら調整OK（このファイルだけ直せばよい）。

// ① 難易度
export const DIFFICULTY_LEVELS = {
  junior: { // デフォルト
    label: "中学レベル",
    instruction: "中学英語レベル。基礎的な語彙と文法で。",
    jaTranslationNote: "中学生にもわかる自然な日本語", // en入力→和訳の読みやすさ
  },
  advanced: {
    label: "高校以上レベル",
    instruction: "高校以上のレベル。やや難しい語彙や構文も使ってよい。",
    jaTranslationNote: "自然な日本語",
  },
}
export const DEFAULT_DIFFICULTY = "junior"

// ② カジュアルさ
export const TONE_LEVELS = {
  normal: { // デフォルト（初学者おすすめ）
    label: "ノーマル",
    recommended: true,
    instruction: "標準的で自然な、聞き取りやすい英語で。",
  },
  casual: {
    label: "カジュアル",
    recommended: false,
    // ※スラング・省略が入るぶん、理解の難易度は上がる
    instruction: "くだけた表現で。会話文では主語の省略や若者言葉のようなカジュアルな表現を交える。",
  },
}
export const DEFAULT_TONE = "normal"

export function getDifficulty(id) {
  return DIFFICULTY_LEVELS[id] || DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY]
}
export function getTone(id) {
  return TONE_LEVELS[id] || TONE_LEVELS[DEFAULT_TONE]
}

// ja入力→英語生成・チャットで使う「英語スタイル指示」（難易度＋トーンを合成）
export function buildEnglishStyle(difficultyId, toneId) {
  return `${getDifficulty(difficultyId).instruction} ${getTone(toneId).instruction}`
}
