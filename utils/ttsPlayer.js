// 文単位の音声再生ラッパー。
// 無料/Basic は Web Speech、Premium は Polly(audioUrl) という分岐をここに集約する。
// 呼び出し側は audioUrl にプランに応じた値（Premium=Polly URL、他=null）を渡すだけ。

// Web Speech が使えるか（一部Android WebView等では speechSynthesis が無い）
export function isWebSpeechSupported() {
  return typeof window !== "undefined" && !!window.speechSynthesis
}

// 文単位の音声再生。audioUrl があればそれを再生、無ければ Web Speech にフォールバック。
export function playSentenceAudio({ text, audioUrl }) {
  if (audioUrl) {
    const audio = new Audio(audioUrl)
    return audio.play().catch(() => {})
  }
  return playWebSpeech(text)
}

export function playWebSpeech(text) {
  if (!isWebSpeechSupported() || !text) return Promise.resolve()
  window.speechSynthesis.cancel() // 多重再生防止
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = "en-US"
  utter.rate = 0.95
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find(v => v.lang.startsWith("en"))
  if (en) utter.voice = en
  window.speechSynthesis.speak(utter)
  return Promise.resolve()
}

// 全文通し再生。audioUrl と Web Speech が混在しても順次再生する。
// sentences: [{ en, audioUrl }] を想定。戻り値は再生を止めるcancel関数。
export function playAllSentences(sentences, { onIndexChange, onDone } = {}) {
  let cancelled = false
  let idx = 0

  if (isWebSpeechSupported()) window.speechSynthesis.cancel()

  const advance = () => {
    if (cancelled) return
    setTimeout(playNext, 300)
  }

  const playNext = () => {
    if (cancelled) return
    if (idx >= sentences.length) {
      if (onDone) onDone()
      return
    }
    const s = sentences[idx]
    if (onIndexChange) onIndexChange(idx)
    idx += 1

    if (s.audioUrl) {
      const a = new Audio(s.audioUrl)
      a.addEventListener("ended", advance)
      a.play().catch(advance)
    } else if (isWebSpeechSupported() && s.en) {
      const utter = new SpeechSynthesisUtterance(s.en)
      utter.lang = "en-US"
      utter.rate = 0.95
      const en = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("en"))
      if (en) utter.voice = en
      utter.onend = advance
      utter.onerror = advance
      window.speechSynthesis.speak(utter)
    } else {
      // 音声もWeb Speechも無い場合は空送りして次へ（チェーンを止めない）
      advance()
    }
  }

  playNext()

  return () => {
    cancelled = true
    if (isWebSpeechSupported()) window.speechSynthesis.cancel()
  }
}
