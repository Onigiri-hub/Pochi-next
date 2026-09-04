import { markRoundCleared } from "../utils/vocabProgressManager"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function makeChoices(correctWord, pool) {
  const others = pool.filter(w => w.word_id !== correctWord.word_id)
  const dummies = shuffle(others).slice(0, 3)
  return shuffle([correctWord, ...dummies])
}

// 履修フェーズ（4択）：メインキュー → 一撃失敗は再出題キュー → 空になったらクリア
export default function FourChoices() {
  const router = useRouter()
  const { section, round } = router.query

  const allWordsRef = useRef([])
  const [roundInfo, setRoundInfo] = useState(null)

  // キューはrefを正とし、描画用にstateへミラー
  const queueRef = useRef([])
  const [queue, setQueueMirror] = useState([])
  const currentRef = useRef(0)
  const [current, setCurrentMirror] = useState(0)
  const retryRef = useRef([])
  const [lap, setLap] = useState(1)

  const [choices, setChoices] = useState([])
  const [eliminated, setEliminated] = useState([])
  const [correct, setCorrect] = useState(false)
  const [slideState, setSlideState] = useState("idle")
  const [showHint, setShowHint] = useState(false)
  const cleanRef = useRef(true)   // 現在の単語が「一撃」対象か
  const seikaiRef = useRef(null)
  const savingRef = useRef(false)

  const isJa2En = roundInfo?.mode_type?.includes("ja2en")
  const hintAvailable = roundInfo?.mode_type?.includes("en2ja")  // イラストヒントはen2jaのみ

  const setQueue = (arr) => { queueRef.current = arr; setQueueMirror(arr) }
  const setCurrent = (n) => { currentRef.current = n; setCurrentMirror(n) }

  // 1問分の一時状態をまとめてセット（遷移時に呼ぶ。useEffect内では呼ばない）
  const setupWord = (word, pool) => {
    setChoices(makeChoices(word, pool))
    setEliminated([])
    setCorrect(false)
    setShowHint(false)
    cleanRef.current = true
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
    if (!router.isReady) return

    if (!seikaiRef.current) {
      seikaiRef.current = new Audio("/sound/seikai.mp3")
      seikaiRef.current.load()
      seikaiRef.current.volume = 0.5
      seikaiRef.current.addEventListener("canplaythrough", () => {
        seikaiRef.current.playbackRate = 1.5
      })
    }

    async function load() {
      const secRes = await fetch("/data/vocab/sectionList.csv")
      const secData = Papa.parse(await secRes.text(), { header: true, skipEmptyLines: true }).data
      const sectionInfo = secData.find(s => s.section_id === section)
      if (!sectionInfo) return

      const rRes = await fetch(`/data/vocab/rounds/${sectionInfo.rounds_csv}`)
      const rData = Papa.parse(await rRes.text(), { header: true, skipEmptyLines: true }).data
      const currentRound = rData.find(r => r.round_id === round)
      setRoundInfo(currentRound)

      const wRes = await fetch(`/data/vocab/words/${sectionInfo.words_csv}`)
      const wData = Papa.parse(await wRes.text(), { header: true, skipEmptyLines: true }).data
      allWordsRef.current = wData

      const from = currentRound.word_from
      const to = currentRound.word_to
      const filtered = wData.filter(w => w.word_id >= from && w.word_id <= to)

      retryRef.current = []
      setLap(1)
      const q = shuffle(filtered)
      setQueue(q)
      setCurrent(0)
      setupWord(q[0], wData)
    }
    load()
  }, [router.isReady, section, round])

  // en2jaのとき単語音声を自動再生（setStateしないのでeffectでOK）
  useEffect(() => {
    if (!roundInfo || queue.length === 0) return
    if (!roundInfo.mode_type.includes("en2ja")) return
    const w = queue[current]
    if (!w?.audio) return
    const audio = new Audio(`/audio/words/${w.audio}`)
    audio.play().catch(() => {})
  }, [current, roundInfo, queue])

  function useHint() {
    cleanRef.current = false   // ヒントを見たら一撃除外
    setShowHint(true)
  }

  function handleSelect(choice) {
    const currentWord = queue[current]
    const isCorrect = choice.word_id === currentWord.word_id

    if (isCorrect) {
      // 一撃でなければ再出題キューへ
      if (!cleanRef.current) {
        retryRef.current = [...retryRef.current, currentWord]
      }
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play().catch(() => {})
      }
      setCorrect(true)
      setTimeout(advance, 650)
    } else {
      cleanRef.current = false
      setEliminated(prev => [...prev, choice.word_id])
    }
  }

  function advance() {
    setSlideState("out")
    setTimeout(() => {
      const q = queueRef.current
      const cur = currentRef.current
      if (cur < q.length - 1) {
        setCurrent(cur + 1)
        setupWord(q[cur + 1], allWordsRef.current)
        setSlideState("in")
        setTimeout(() => setSlideState("idle"), 50)
      } else if (retryRef.current.length > 0) {
        // 次の周へ
        const next = shuffle(retryRef.current)
        retryRef.current = []
        setLap(l => l + 1)
        setQueue(next)
        setCurrent(0)
        setupWord(next[0], allWordsRef.current)
        setSlideState("in")
        setTimeout(() => setSlideState("idle"), 50)
      } else {
        finishRound()
      }
    }, 400)
  }

  async function finishRound() {
    if (savingRef.current) return
    savingRef.current = true
    const firstClear = await markRoundCleared(section, round)
    router.replace(`/vocabComplete?stage=${section.split("_")[0]}&section=${section}&round=${round}&isFirstClear=${firstClear}`)
  }

  if (queue.length === 0) return <div>loading...</div>

  const currentWord = queue[current]
  const remaining = queue.length - current
  const slideStyle = {
    transition: slideState === "idle" ? "transform 0.4s ease, opacity 0.4s ease" :
                slideState === "out" ? "transform 0.4s ease, opacity 0.4s ease" : "none",
    transform: slideState === "out" ? "translateX(-120%)" :
               slideState === "in" ? "translateX(120%)" : "translateX(0)",
    opacity: slideState === "out" ? 0 : 1,
  }

  return (
    <div style={{ maxWidth: "400px", margin: "auto", padding: "20px", minHeight: "100vh", background: "#ebebeb" }}>

      {/* ヘッダー：やめる＋周回/のこり */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <button
          onClick={() => router.push(`/sectionList?stage=${section.split("_")[0]}`)}
          style={{ background: "none", border: "none", fontSize: "14px", fontWeight: "bold", color: "#666", cursor: "pointer" }}
        >
          ◀ やめる
        </button>
        <div style={{ fontSize: "13px", color: "#888" }}>
          {lap > 1 && <span style={{ marginRight: "10px" }}>{lap}周目</span>}
          のこり {remaining}
        </div>
      </div>

      {/* ポチアニメーション */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
        <video src="/animations/pochi-tokotoko.mp4" autoPlay muted loop playsInline style={{ width: "120px" }} />
      </div>

      <div style={{ overflow: "hidden" }}>
        <div style={slideStyle}>

          {/* 出題（en2ja=英語 / ja2en=日本語） */}
          <div style={{ textAlign: "center", fontSize: "36px", fontWeight: "bold", margin: "20px 0 10px" }}>
            {isJa2En ? currentWord.ja : currentWord.word}
          </div>

          {/* ヒント（en2jaのみ・hint_image列がある単語だけ表示） */}
          {hintAvailable && currentWord.hint_image && (
            <div style={{ textAlign: "center", marginBottom: "10px" }}>
              {!showHint ? (
                <button
                  onClick={useHint}
                  style={{ padding: "4px 8px", border: "none", background: "none", color: "#999", fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}
                >
                  ヒントを見る
                </button>
              ) : (
                <img
                  src={`/images/1to1hints/${currentWord.hint_image}`}
                  alt="ヒント"
                  style={{ width: "140px", height: "140px", objectFit: "contain", borderRadius: "12px", background: "#fff" }}
                />
              )}
            </div>
          )}

          {/* 4択ボタン */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
            {choices.map((choice, i) => {
              const isCorrect = choice.word_id === currentWord.word_id
              const isEliminated = eliminated.includes(choice.word_id)
              let bgColor = "white", textColor = "#333333"
              if (correct && isCorrect) { bgColor = "#02ccbb"; textColor = "white" }
              else if (isEliminated) { bgColor = "#bdbdbd"; textColor = "#333333" }
              return (
                <button
                  key={i}
                  onClick={() => { if (isEliminated || correct) return; handleSelect(choice) }}
                  style={{
                    padding: "16px", borderRadius: "12px", border: "2px solid #ddd",
                    background: bgColor, color: textColor, fontSize: "18px",
                    cursor: (isEliminated || correct) ? "default" : "pointer", transition: "background 0.2s"
                  }}
                >
                  {isJa2En ? choice.word : choice.ja}
                </button>
              )
            })}
          </div>

        </div>
      </div>
    </div>
  )
}
