import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import { checkAnswer } from "../engines/PracticeEngine"
import { useProfileContext } from "../utils/ProfileContext"
import Navigation from "../components/Navigation"
import { useDictionary } from "../utils/useDictionary"
import WordPopup from "../components/WordPopup"
import { getArrangeWordStatus, markArrangeWordLearned } from "../utils/vocabProgressManager"

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function ArrangePractice() {
  const router = useRouter()
  const { stage, words, order } = router.query
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState([])
  const [chips, setChips] = useState([])
  const [result, setResult] = useState(null)
  const [userShowJa, setUserShowJa] = useState(true)
  const [showJaFirst, setShowJaFirst] = useState(false)
  const [showJaSecond, setShowJaSecond] = useState(false)
  const anyNewRef = useRef(false) // このセッションに未習の単語が含まれるか
  const pa = useRef(null)
  const seikaiRef = useRef(null)
  const { profile } = useProfileContext()
  const { tokenize, findEntry } = useDictionary()
  const [popupEntry, setPopupEntry] = useState(null)
  const longPressTimer = useRef(null)
  const chipLockRef = useRef(false)

  function handleChipPressStart(word) {
    longPressTimer.current = setTimeout(() => {
      const entry = findEntry(word)
      if (entry) {
        setPopupEntry(entry)
        if (entry.audio) {
          new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
        }
      }
      longPressTimer.current = null
    }, 400)
  }

  function handleChipPressEnd(word, action, e) {
    if (e) e.preventDefault()
    if (chipLockRef.current) return
    chipLockRef.current = true
    setTimeout(() => { chipLockRef.current = false }, 100)
    if (longPressTimer.current === null) {
      setPopupEntry(null)
      return
    }
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    const chipSoundOn = localStorage.getItem("chipSoundOn") === "true"
    if (chipSoundOn) {
      const entry = findEntry(word)
      if (entry?.audio) {
        new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
      }
    }
    action()
  }

  function handleWordTap(entry) {
    if (entry.audio) {
      new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
    }
    setPopupEntry(entry)
  }

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = "none"
    document.body.style.overscrollBehavior = "none"
    return () => {
      document.documentElement.style.overscrollBehavior = ""
      document.body.style.overscrollBehavior = ""
    }
  }, [])

  useEffect(() => {
    setUserShowJa(localStorage.getItem("showJaTranslation") !== "false")
    pa.current = new Audio("/sound/pa.mp3")
    pa.current.volume = 0.3
    seikaiRef.current = new Audio("/sound/seikai.mp3")
    seikaiRef.current.playbackRate = 1.5
    seikaiRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    setShowJaFirst(false)
    setShowJaSecond(false)
  }, [index])

  useEffect(() => {
    if (!router.isReady || !stage || !words) return

    async function load() {
      const res = await fetch(`/data/vocab/arrange_sentences/arrange_sentences_${stage}.csv`)
      const text = await res.text()
      const data = Papa.parse(text, { header: true, skipEmptyLines: true }).data

      // words クエリ（arrange_word_id のカンマ区切り、優先順位の順）
      const idOrder = String(words).split(",").filter(Boolean)
      const idSet = new Set(idOrder)

      // 単語ごとに設問をまとめ、question_id順に並べる
      const byWord = {}
      data.forEach(r => {
        if (idSet.has(r.arrange_word_id)) {
          (byWord[r.arrange_word_id] = byWord[r.arrange_word_id] || []).push(r)
        }
      })
      Object.values(byWord).forEach(arr =>
        arr.sort((a, b) => (a.question_id || "").localeCompare(b.question_id || ""))
      )
      let built = idOrder.flatMap(id => byWord[id] || [])
      if (built.length === 0) return
      // ランダム出題なら設問の並びもシャッフル
      if (order === "random") built = shuffle(built)
      setQuestions(built)

      // 初クリア判定：未習(learned=false)の単語が1つでもあれば true
      const status = await getArrangeWordStatus(stage)
      anyNewRef.current = idOrder.some(id => !status[id]?.learned)
    }
    load()
  }, [router.isReady, stage, words, order])

  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[index]
    setChips(shuffle(q.chips.split("|")))
    setSelected([])
    setResult(null)
  }, [index, questions])

  // 自動再生（1文目→2文目の連続再生）
  useEffect(() => {
    if (questions.length === 0) return
    const autoPlayOn = localStorage.getItem("autoPlayOn") !== "false"
    const q = questions[index]
    if (!autoPlayOn || q.audio_auto !== "1" || !q.audio_first) return

    let audio2 = null
    const timer = setTimeout(() => {
      const audio1 = new Audio(`/audio/arrange_words/${q.audio_first}`)
      audio1.play().catch(() => {})
      if (q.audio_second) {
        audio1.addEventListener("ended", () => {
          setTimeout(() => {
            audio2 = new Audio(`/audio/arrange_words/${q.audio_second}`)
            audio2.play().catch(() => {})
          }, 100)
        })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [index, questions])

  function playAudio(filename) {
    if (!filename) return
    new Audio(`/audio/arrange_words/${filename}`).play().catch(() => {})
  }

  function addChip(word, i) {
    if (!pa.current) return
    pa.current.currentTime = 0
    pa.current.play()
    setSelected(prev => [...prev, word])
    setChips(prev => { const c = [...prev]; c.splice(i, 1); return c })
  }

  function removeChip(word, i) {
    if (!pa.current) return
    pa.current.currentTime = 0
    pa.current.play()
    setSelected(prev => { const s = [...prev]; s.splice(i, 1); return s })
    setChips(prev => [...prev, word])
  }

  function check() {
    const q = questions[index]
    const answer = selected.join(" ")
    const ok = checkAnswer(answer, q.answer)
    if (ok) {
      // 並べ替え問題を一度でも正解したら履修ON（冪等）
      markArrangeWordLearned(stage, q.arrange_word_id)
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play()
      }
      setResult("correct")
    } else {
      setResult("wrong")
    }
  }

  function next() {
    if (index < questions.length - 1) {
      setIndex(i => i + 1)
    } else {
      router.replace(`/vocabComplete?stage=${stage}&mode=arrangeWord&isFirstClear=${anyNewRef.current}`)
    }
  }

  if (questions.length === 0) return <div>loading...</div>

  const q = questions[index]
  const posFirst = q.position_first || "right"
  const posSecond = q.position_second || "left"
  const iconFirst = q.icon_first || "user"
  const iconSecond = q.icon_second || "05.png"
  // highlight_chips に含まれる単語チップだけ色を少し変える
  const highlightChips = new Set((q.highlight_chips || "").split("|").map(s => s.trim()).filter(Boolean))

  function renderSentence(text) {
    if (!text || text.includes("____")) return text
    return tokenize(text).map((token, i) =>
      token.entry ? (
        <span
          key={i}
          style={{ borderBottom: "2px solid #a9b8e7", cursor: "pointer" }}
          onClick={() => handleWordTap(token.entry)}
        >
          {token.text}
        </span>
      ) : (
        <span key={i}>{token.text}</span>
      )
    )
  }

  function renderAvatar(iconName) {
    if (iconName === "user") {
      return (
        <div style={{ position: "relative", width: "60px", height: "60px" }}>
          <img src={`/images/avatars/${profile?.avatar || "01.png"}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} className="characterIcon" alt="" />
          {profile?.acc_eye && <img src={`/images/avatars/${profile.acc_eye}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} alt="" />}
          {profile?.acc_mouth && <img src={`/images/avatars/${profile.acc_mouth}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} alt="" />}
          {profile?.acc_head && <img src={`/images/avatars/${profile.acc_head}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} alt="" />}
        </div>
      )
    }
    return <img src={`/images/avatars/${iconName}`} alt="" className="characterIcon" />
  }

  return (
    <div className="app" style={{ paddingBottom: "180px" }}>
      <Navigation />

      <div className="progressDots">
        {questions.map((_, i) => (
          <div key={i} className={i === index ? "dot active" : "dot"} />
        ))}
      </div>

      <div className={`chat ${posFirst}`}>
        <div className="iconContainer">
          {renderAvatar(iconFirst)}
        </div>
        <div className="bubble">
          <div className="en">
            {q.audio_first && (
              <span className="audioBtn" onClick={() => playAudio(q.audio_first)}><img src="/images/icons/speaker-333.svg" alt="音声を再生" /></span>
            )}
            {renderSentence(q.sentence_first_en)}
            {!userShowJa && q.ja1 && (
              <span className="jaToggleBtn" onClick={() => setShowJaFirst(v => !v)}>
                {showJaFirst ? "🔼" : "🔽"}
              </span>
            )}
          </div>
          {(userShowJa ? !!q.ja1 : showJaFirst) && (
            <div className="ja">{q.ja1}</div>
          )}
        </div>
      </div>

      {q.sentence_second_en && (
        <div className={`chat ${posSecond}`}>
          <div className="iconContainer">
            {renderAvatar(iconSecond)}
          </div>
          <div className="bubble">
            <div className="en">
              {q.audio_second && (
                <span className="audioBtn" onClick={() => playAudio(q.audio_second)}><img src="/images/icons/speaker-333.svg" alt="音声を再生" /></span>
              )}
              {renderSentence(q.sentence_second_en)}
              {!userShowJa && q.ja2 && (
                <span className="jaToggleBtn" onClick={() => setShowJaSecond(v => !v)}>
                  {showJaSecond ? "🔼" : "🔽"}
                </span>
              )}
            </div>
            {(userShowJa ? !!q.ja2 : showJaSecond) && (
              <div className="ja">{q.ja2}</div>
            )}
          </div>
        </div>
      )}

      <div className="chipBox">
        {selected.map((w, i) => (
          <button
            key={i}
            className="chip"
            style={highlightChips.has(w) ? { background: "#7f95b8" } : undefined}
            onMouseDown={() => handleChipPressStart(w)}
            onMouseUp={(e) => handleChipPressEnd(w, () => removeChip(w, i), e)}
            onMouseLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
            onTouchStart={() => handleChipPressStart(w)}
            onTouchEnd={(e) => handleChipPressEnd(w, () => removeChip(w, i), e)}
          >
            {w}
          </button>
        ))}
      </div>

      <div>
        {chips.map((c, i) => (
          <button
            key={i}
            className="chip"
            style={highlightChips.has(c) ? { background: "#7f95b8" } : undefined}
            onMouseDown={() => handleChipPressStart(c)}
            onMouseUp={(e) => handleChipPressEnd(c, () => addChip(c, i), e)}
            onMouseLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
            onTouchStart={() => handleChipPressStart(c)}
            onTouchEnd={(e) => handleChipPressEnd(c, () => addChip(c, i), e)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={`bottomArea ${result || ""}`}>
        {result === "correct" && <div className="resultText">Perfect！</div>}
        {result === "wrong" && <div className="resultText">惜しい！</div>}
        <button
          className="mainButton"
          onClick={
            result === "correct" ? next
            : result === "wrong" ? () => setResult(null)
            : check
          }
        >
          {result === "correct" ? "Next" : result === "wrong" ? "Try again" : "Check"}
        </button>
      </div>

      <WordPopup entry={popupEntry} onClose={() => setPopupEntry(null)} />
    </div>
  )
}
