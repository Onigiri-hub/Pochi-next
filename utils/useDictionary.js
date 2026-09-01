import { useDictionaryContext } from "./DictionaryContext"

export function useDictionary() {
  const dictionary = useDictionaryContext()

  function tokenize(text) {
    if (!dictionary.length) return [{ text, entry: null }]

    const sorted = [...dictionary].sort(
      (a, b) => b.word.length - a.word.length
    )

    let tokens = [{ text, entry: null }]

    for (const entry of sorted) {
      const targets = [
        entry.word,
        ...(entry.variants?.split("|") || [])
      ].filter(Boolean)

      for (const target of targets) {
        const regex = new RegExp(`(\\b${target}\\b)`, "gi")
        const lowerTarget = target.toLowerCase()
        tokens = tokens.flatMap(token => {
          if (token.entry) return [token]
          const parts = token.text.split(regex)
          return parts
            .filter(p => p !== "")
            .map(p => ({
              text: p,
              entry: p.toLowerCase() === lowerTarget ? entry : null
            }))
        })
      }
    }
    
    return tokens
  }

  function findEntry(word) {
    if (!dictionary.length || !word) return null
    const cleaned = word.replace(/^[^\w]+|[^\w]+$/g, "")
    if (!cleaned) return null
    const lower = cleaned.toLowerCase()
    return dictionary.find(entry => {
      const targets = [
        entry.word,
        ...(entry.variants?.split("|") || [])
      ].filter(Boolean).map(t => t.toLowerCase())
      return targets.includes(lower)
    }) || null
  }

  return { tokenize, findEntry }
}