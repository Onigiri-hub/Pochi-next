import { useMemo } from "react"
import { useDictionaryContext } from "./DictionaryContext"

// 語と区切りを両方キャプチャして分割（区切りも配列に残す）。
// 「ラテン英数字＋アポストロフィ」以外はすべて区切り扱い。これにより
// 空白・ASCII記号だけでなく、日本語文字（例: "readは他動詞だよ"）も語境界になり、
// 旧実装（\b 依存）と同じ「英単語だけ下線」を再現できる。
// アポストロフィ ' ‘ ’ は語中に残すため区切りに含めない（縮約形・所有格を1語に保つ）。
const SPLIT_RE = /([^A-Za-z0-9'‘’]+)/

// variants が NaN(float) や空文字のケースを吸収
function splitVariants(v) {
  if (!v || typeof v !== "string") return []
  const s = v.trim()
  if (!s || s.toLowerCase() === "nan") return []
  return s.split("|").map(x => x.trim()).filter(Boolean)
}

// 前後の非単語文字を除去して小文字化（マッチ用のキー）。
// アポストロフィは語中に残す（it's, don't, o'clock, dog's 等）。
// 全角アポストロフィ ‘ ’ は照合キーとして半角 ' に正規化。
function normalize(word) {
  return word
    .replace(/[‘’]/g, "'")
    .replace(/^[^\w']+|[^\w']+$/g, "")
    .toLowerCase()
}

// 辞書配列から2つのMapを構築する（起動時に一度だけ）。
function buildMaps(dictionary) {
  const wordMap = new Map()    // "played" -> entry
  const phraseMap = new Map()  // "hang" -> [{ words:["hang","out"], entry }, ...]

  for (const entry of dictionary) {
    const raw = [entry.word, ...splitVariants(entry.variants)].filter(Boolean)
    for (const key of raw) {
      const k = key.trim()
      if (!k) continue
      if (k.includes(" ")) {
        const words = k.toLowerCase().split(/\s+/)
        const head = words[0]
        if (!phraseMap.has(head)) phraseMap.set(head, [])
        phraseMap.get(head).push({ words, entry })
      } else {
        // 先勝ち: 先に登録された方を優先。
        const lower = k.toLowerCase()
        if (!wordMap.has(lower)) wordMap.set(lower, entry)
      }
    }
  }

  // phraseMapの各リストは、長いフレーズ優先で照合するため語数の多い順にソート。
  for (const list of phraseMap.values()) {
    list.sort((a, b) => b.words.length - a.words.length)
  }

  return { wordMap, phraseMap }
}

// parts[startIdx] から、空白/区切りを飛ばしつつ words 配列と順に一致するか。
function tryMatchPhrase(parts, startIdx, words) {
  let pi = startIdx
  for (let wi = 0; wi < words.length; wi++) {
    while (pi < parts.length && normalize(parts[pi]) === "") pi++
    if (pi >= parts.length) return false
    if (normalize(parts[pi]) !== words[wi]) return false
    pi++
  }
  return true
}

// フレーズ末尾の次のindexを返す（tryMatchPhrase成功後に呼ぶ）。
function advanceIndexForPhrase(parts, startIdx, words) {
  let pi = startIdx
  let matchedWords = 0
  while (matchedWords < words.length && pi < parts.length) {
    if (normalize(parts[pi]) !== "") matchedWords++
    pi++
  }
  return pi
}

// テキストを「語」と「区切り」に分割し、順に辞書照合する。
// 戻り値は [{ text, entry }] （既存と同一インターフェース）。
function tokenize(text, wordMap, phraseMap) {
  if (!text) return [{ text: "", entry: null }]
  const parts = text.split(SPLIT_RE).filter(p => p !== "")
  const result = []
  let i = 0

  while (i < parts.length) {
    const part = parts[i]
    const key = normalize(part)

    // 区切り or 空トークンはそのまま
    if (!key) { result.push({ text: part, entry: null }); i++; continue }

    // --- フレーズ照合（先頭語がphraseMapにある時だけ） ---
    let matched = null
    const candidates = phraseMap.get(key)
    if (candidates) {
      for (const cand of candidates) { // 長い順
        if (tryMatchPhrase(parts, i, cand.words)) {
          matched = cand
          break
        }
      }
    }
    if (matched) {
      const endIndex = advanceIndexForPhrase(parts, i, matched.words)
      const combinedText = parts.slice(i, endIndex).join("")
      result.push({ text: combinedText, entry: matched.entry })
      i = endIndex
      continue
    }

    // --- 単語照合 ---
    result.push({ text: part, entry: wordMap.get(key) || null })
    i++
  }
  return result
}

// 単語単体からentryを引く。
function findEntry(word, wordMap) {
  if (!word) return null
  const cleaned = normalize(word)
  if (!cleaned) return null
  return wordMap.get(cleaned) || null
}

export function useDictionary() {
  const dictionary = useDictionaryContext()

  const { wordMap, phraseMap } = useMemo(
    () => buildMaps(dictionary || []),
    [dictionary]
  )

  return {
    tokenize: (text) => tokenize(text, wordMap, phraseMap),
    findEntry: (word) => findEntry(word, wordMap),
  }
}
