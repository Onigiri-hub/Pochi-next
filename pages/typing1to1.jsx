import { markRoundCleared } from "../utils/vocabProgressManager"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"

// レーベンシュタイン距離（スペルミス許容の判定用）
function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// 履修フェーズ（typing）：一撃=距離0/1かつヒント頭文字まで。一撃失敗は再出題キューへ
export default function Typing() {
  const router = useRouter()
  const { section, round } = router.query

  const queueRef = useRef([])
  const [queue, setQueueMirror] = useState([])
  const currentRef = useRef(0)
  const [current, setCurrentMirror] = useState(0)
  const retryRef = useRef([])
  const [lap, setLap] = useState(1)

  const [input, setInput] = useState("")
  const [result, setResult] = useState(null)     // "correct" | "typo" | "wrong" | null
  const [correctAnswer, setCorrectAnswer] = useState("")
  const [revealed, setRevealed] = useState(0)     // ヒントで開示した文字数
  const cleanRef = useRef(true)                   // この提示が一撃対象か
  const requeueRef = useRef(false)                // この単語を再出題キューへ回すか
  const inputRef = useRef(null)
  const seikaiRef = useRef(null)
  const savingRef = useRef(false)

  const setQueue = (arr) => { queueRef.current = arr; setQueueMirror(arr) }
  const setCurrent = (n) => { currentRef.current = n; setCurrentMirror(n) }

  // 1問分の一時状態をまとめてリセット（遷移時に呼ぶ。useEffect内では呼ばない）
  const setupWord = () => {
    setInput("")
    setResult(null)
    setCorrectAnswer("")
    setRevealed(0)
    cleanRef.current = true
    requeueRef.current = false
    setTimeout(() => inputRef.current?.focus(), 0)
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

    async function load() {
      const secRes = await fetch("/data/vocab/sectionList.csv")
      const secData = Papa.parse(await secRes.text(), { header: true, skipEmptyLines: true }).data
      const sectionInfo = secData.find(s => s.section_id === section)
      if (!sectionInfo) return

      const rRes = await fetch(`/data/vocab/rounds/${sectionInfo.rounds_csv}`)
      const rData = Papa.parse(await rRes.text(), { header: true, skipEmptyLines: true }).data
      const currentRound = rData.find(r => r.round_id === round)

      const wRes = await fetch(`/data/vocab/words/${sectionInfo.words_csv}`)
      const wData = Papa.parse(await wRes.text(), { header: true, skipEmptyLines: true }).data

      const filtered = wData.filter(w => w.word_id >= currentRound.word_from && w.word_id <= currentRound.word_to)

      retryRef.current = []
      setLap(1)
      setQueue(shuffle(filtered))
      setCurrent(0)
      setupWord()

      if (!seikaiRef.current) {
        seikaiRef.current = new Audio("/sound/seikai.mp3")
        seikaiRef.current.playbackRate = 1.5
        seikaiRef.current.volume = 0.5
      }
    }
    load()
  }, [router.isReady, section, round])

  function revealNext() {
    setRevealed(r => {
      const next = Math.min(queue[current].word.length, r + 1)
      if (next >= 2) cleanRef.current = false   // 2文字目以降を見たら一撃除外
      return next
    })
  }

  function check() {
    const currentWord = queue[current]
    const correct = currentWord.word.trim().toLowerCase()
    const userInput = input.trim().toLowerCase()
    const distance = levenshtein(userInput, correct)

    if (distance <= 1) {
      // 一撃 = 距離0/1 かつ ヒント開示が頭文字まで（cleanRef）
      requeueRef.current = !cleanRef.current
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play().catch(() => {})
      }
      setCorrectAnswer(currentWord.word)
      setResult(distance === 0 ? "correct" : "typo")
    } else {
      requeueRef.current = true
      setCorrectAnswer(currentWord.word)
      setResult("wrong")
    }
  }

  function next() {
    const currentWord = queue[current]
    if (requeueRef.current) {
      retryRef.current = [...retryRef.current, currentWord]
    }
    const q = queueRef.current
    const cur = currentRef.current
    if (cur < q.length - 1) {
      setCurrent(cur + 1)
      setupWord()
    } else if (retryRef.current.length > 0) {
      const nextLap = shuffle(retryRef.current)
      retryRef.current = []
      setLap(l => l + 1)
      setQueue(nextLap)
      setCurrent(0)
      setupWord()
    } else {
      finishRound()
    }
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
  const hintDisplay = currentWord.word
    .split("")
    .map((ch, i) => (i < revealed ? ch : "_"))
    .join(" ")

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

      {/* 日本語表示 */}
      <div style={{ textAlign: "center", fontSize: "32px", fontWeight: "bold", margin: "20px 0" }}>
        {currentWord.ja}
      </div>

      {/* 入力欄 */}
      <div style={{ margin: "20px 0" }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => { if (result !== null) return; setInput(e.target.value) }}
          onKeyDown={e => {
            if (e.key !== "Enter") return
            if (result === null) check(); else next()
          }}
          placeholder="英単語を入力..."
          style={{
            width: "100%", padding: "16px", fontSize: "20px", borderRadius: "12px",
            border: result === "correct" || result === "typo" ? "2px solid #02ccbb"
              : result === "wrong" ? "2px solid #ff4444" : "2px solid #ddd",
            background: "white", boxSizing: "border-box", textAlign: "center"
          }}
        />
      </div>

      {/* ヒント（頭文字から段階開示） */}
      {result === null && (
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          {revealed > 0 && (
            <div style={{ fontSize: "22px", letterSpacing: "3px", fontWeight: "bold", color: "#d16b8c", marginBottom: "8px" }}>
              {hintDisplay}
            </div>
          )}
          {revealed < currentWord.word.length && (
            <button
              onClick={revealNext}
              style={{ padding: "6px 16px", borderRadius: "16px", border: "1px solid #f4a6c0", background: "#fff", color: "#d16b8c", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
            >
              💡 {revealed === 0 ? "頭文字ヒント" : "つぎの文字"}
            </button>
          )}
        </div>
      )}

      {/* 結果表示 */}
      {result === "typo" && (
        <div style={{ textAlign: "center", color: "#02ccbb", fontSize: "16px", marginBottom: "10px" }}>
          スペルミスあり！正解は <strong>{correctAnswer}</strong>
        </div>
      )}
      {result === "wrong" && (
        <div style={{ textAlign: "center", color: "#ff4444", fontSize: "16px", marginBottom: "10px" }}>
          惜しい！正解は <strong>{correctAnswer}</strong>
        </div>
      )}

      {/* ボタン */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
        {result === null ? (
          <button
            onClick={check}
            style={{ padding: "14px 40px", borderRadius: "100px", border: "none", background: "#333333", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
          >
            こたえる
          </button>
        ) : (
          <button
            onClick={next}
            style={{ padding: "14px 40px", borderRadius: "100px", border: "none", background: "#02ccbb", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
          >
            つぎへ
          </button>
        )}
      </div>
    </div>
  )
}
