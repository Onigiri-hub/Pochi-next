// 生成英語のスタイル設定。長文生成（ja入力）・おしゃべり（チャット）で共通利用する。
// 2軸で管理する:
//   ① difficulty（難易度）  : 語彙・文法の難しさ
//   ② tone（カジュアルさ）  : 語り口・レジスター
//
// ★将来ユーザーが設定で変更できるようにする想定:
//   users/{uid}.level / .tone に保存 → ProfileContext 経由でフォーム/チャットが API に渡す。
//   未指定なら DEFAULT にフォールバックするので、設定UIを繋ぐまでは今と同じ挙動のまま。
//
// 文言は暫定。使いながら調整してよい（このファイルだけ直せばOK）。

// ① 難易度（語彙・文法）
export const DIFFICULTY_LEVELS = {
  junior: { // デフォルト
    label: "中学英語",
    instruction: "中学英語レベル。基礎的な語彙と文法で。",
    jaTranslationNote: "中学生にもわかる自然な日本語", // en入力→和訳の読みやすさ
  },
  highschool: {
    label: "高校英語",
    instruction: "高校英語レベル。やや複雑な構文や語彙も使う。",
    jaTranslationNote: "高校生にわかる自然な日本語",
  },
  advanced: {
    label: "それ以上",
    instruction: "高校卒業〜一般レベル。難しい語彙や複雑な構文も使ってよい。",
    jaTranslationNote: "自然な日本語",
  },
}
export const DEFAULT_DIFFICULTY = "junior"

// ② カジュアルさ（語り口・レジスター）
export const TONE_LEVELS = {
  casual: {
    label: "くだけた表現",
    recommended: false,
    // ※スラング・省略が入るぶん、理解の難易度は上がる
    instruction:
      "くだけた口語で。主語の省略、若者言葉、'gonna'/'wanna'/'seriously(=マジで)' のようなスラングやカジュアルな言い回しを交える。ネイティブの友達どうしの会話のような雰囲気。",
  },
  friendly: { // デフォルト（初学者おすすめ）
    label: "やさしい語り口",
    recommended: true,
    instruction: "やさしく丁寧な語り口で。標準的で自然、聞き取りやすい英語。",
  },
  formal: {
    label: "フォーマル",
    recommended: false,
    instruction:
      "フォーマルな英語で。ニュース記事・論文・職場での会話のような、きちんとした改まった表現。",
  },
}
export const DEFAULT_TONE = "friendly"

export function getDifficulty(id) {
  return DIFFICULTY_LEVELS[id] || DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY]
}
export function getTone(id) {
  return TONE_LEVELS[id] || TONE_LEVELS[DEFAULT_TONE]
}

// ja入力→英語生成・チャットで使う「英語スタイル指示」（難易度＋トーンを合成した1文）
export function buildEnglishStyle(difficultyId, toneId) {
  return `${getDifficulty(difficultyId).instruction} ${getTone(toneId).instruction}`
}
