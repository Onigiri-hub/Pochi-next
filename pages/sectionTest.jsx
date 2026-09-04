import { saveSectionTest } from "../utils/vocabProgressManager"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"

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

const TOTAL = 20
const PASS = 16

// 定着フェーズ（セクションテスト）：全語からランダム20問、en2ja/ja2en/typing混在、1本勝負
export default function SectionTest() {
  const router = useRouter()
  const { section, stage } = router.query

  const [sectionName, setSectionName] = useState("")
  const [questions, setQuestions] = useState([])   // {word, mode, choices}
  const [current, setCurrent] = useState(0)
  const [input, setInput] = useState("")
  const [answered, setAnswered] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [pickedId, setPickedId] = useState(null)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState("quiz")       // "quiz" | "result"
  const [finalScore, setFinalScore] = useState(0)
  const savingRef = useRef(false)
  const inputRef = useRef(null)
  const seikaiRef = useRef(null)

  const playSeikai = () => {
    if (seikaiRef.current) {
      seikaiRef.current.currentTime = 0
      seikaiRef.current.play().catch(() => {})
    }
  }

  useEffect(() => {
    if (!router.isReady || !section) return

    async function load() {
      const secRes = await fetch("/data/vocab/sectionList.csv")
      const secData = Papa.parse(await secRes.text(), { header: true, skipEmptyLines: true }).data
      const sectionInfo = secData.find(s => s.section_id === section)
      if (!sectionInfo) return
      setSectionName(sectionInfo.section_name || "")

      if (!seikaiRef.current) {
        seikaiRef.current = new Audio("/sound/seikai.mp3")
        seikaiRef.current.playbackRate = 1.5
        seikaiRef.current.volume = 0.5
      }

      const wRes = await fetch(`/data/vocab/words/${sectionInfo.words_csv}`)
      const words = Papa.parse(await wRes.text(), { header: true, skipEmptyLines: true }).data
        .filter(w => w.word_id && w.word)

      const qCount = Math.min(TOTAL, words.length)
      const picked = shuffle(words).slice(0, qCount)

      // モード配分（en2ja : ja2en : typing ≒ 7 : 7 : 6）
      const eN = Math.round(qCount * 0.35)
      const jN = Math.round(qCount * 0.35)
      const tN = qCount - eN - jN
      const modes = shuffle([
        ...Array(eN).fill("en2ja"),
        ...Array(jN).fill("ja2en"),
        ...Array(tN).fill("typing"),
      ])

      const qs = picked.map((w, i) => {
        const mode = modes[i]
        let choices = null
        if (mode === "en2ja" || mode === "ja2en") {
          const dummies = shuffle(words.filter(x => x.word_id !== w.word_id)).slice(0, 3)
          choices = shuffle([w, ...dummies])
        }
        return { word: w, mode, choices }
      })
      setQuestions(qs)
    }
    load()
  }, [router.isReady, section])

  // typing問のフォーカスのみ（setStateしないのでeffectでOK）
  useEffect(() => {
    if (phase === "quiz" && questions[current]?.mode === "typing") {
      inputRef.current?.focus()
    }
  }, [current, questions, phase])

  function answerChoice(choice) {
    if (answered) return
    const q = questions[current]
    const ok = choice.word_id === q.word.word_id
    if (ok) { scoreRef.current += 1; playSeikai() }
    setLastCorrect(ok)
    setPickedId(choice.word_id)
    setAnswered(true)
  }

  function answerTyping() {
    if (answered) return
    const q = questions[current]
    const ok = levenshtein(input.trim().toLowerCase(), q.word.word.trim().toLowerCase()) <= 1
    if (ok) { scoreRef.current += 1; playSeikai() }
    setLastCorrect(ok)
    setAnswered(true)
  }

  function next() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1)
      setInput("")
      setAnswered(false)
      setPickedId(null)
    } else {
      finish()
    }
  }

  async function finish() {
    if (savingRef.current) return
    savingRef.current = true
    const score = scoreRef.current
    setFinalScore(score)
    setPhase("result")
    await saveSectionTest(section, score >= PASS, score)
  }

  if (questions.length === 0) return <div>loading...</div>

  // ---- 結果画面 ----
  if (phase === "result") {
    const passed = finalScore >= PASS
    const msg = finalScore === TOTAL ? "パーフェクト！"
      : passed ? "うむ。よくやった。"
      : "ふははは…！出直してこい！"
    return (
      <div style={{ maxWidth: "400px", margin: "auto", padding: "40px 20px", minHeight: "100vh", background: "#ebebeb", textAlign: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#666", marginTop: "40px" }}>
          {sectionName} テスト結果
        </div>
        <div style={{ fontSize: "56px", fontWeight: "bold", color: passed ? "#02ccbb" : "#ff7043", margin: "20px 0" }}>
          {finalScore}<span style={{ fontSize: "24px", color: "#999" }}>/{questions.length}</span>
        </div>
        <div style={{ fontSize: "20px", fontWeight: "bold", margin: "20px 0 40px", color: "#333" }}>
          {msg}
        </div>
        <button
          onClick={() => router.replace(`/sectionList?stage=${stage || section.split("_")[0]}`)}
          style={{ padding: "14px 40px", borderRadius: "100px", border: "none", background: "#333333", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
        >
          もどる
        </button>
      </div>
    )
  }

  // ---- 出題画面 ----
  const q = questions[current]
  const isTyping = q.mode === "typing"
  const isJa2En = q.mode === "ja2en"

  return (
    <div style={{ maxWidth: "400px", margin: "auto", padding: "20px", minHeight: "100vh", background: "#ebebeb" }}>

      {/* ヘッダー：やめる＋進捗 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <button
          onClick={() => router.push(`/sectionList?stage=${stage || section.split("_")[0]}`)}
          style={{ background: "none", border: "none", fontSize: "14px", fontWeight: "bold", color: "#666", cursor: "pointer" }}
        >
          ◀ やめる
        </button>
        <div style={{ fontSize: "13px", color: "#888" }}>{current + 1} / {questions.length}</div>
      </div>

      {/* 進捗バー */}
      <div style={{ height: "8px", background: "#ddd", borderRadius: "4px", overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ width: `${((current) / questions.length) * 100}%`, height: "100%", background: "#02ccbb", transition: "width 0.3s" }} />
      </div>

      {/* 出題 */}
      <div style={{ textAlign: "center", fontSize: "34px", fontWeight: "bold", margin: "24px 0" }}>
        {isTyping || isJa2En ? q.word.ja : q.word.word}
      </div>

      {/* 4択 */}
      {!isTyping && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {q.choices.map((choice, i) => {
            const isAns = choice.word_id === q.word.word_id
            let bg = "white", col = "#333"
            if (answered && isAns) { bg = "#02ccbb"; col = "white" }
            else if (answered && choice.word_id === pickedId) { bg = "#ffb3b3"; col = "#333" }
            return (
              <button
                key={i}
                onClick={() => answerChoice(choice)}
                style={{ padding: "16px", borderRadius: "12px", border: "2px solid #ddd", background: bg, color: col, fontSize: "18px", cursor: answered ? "default" : "pointer" }}
              >
                {isJa2En ? choice.word : choice.ja}
              </button>
            )
          })}
        </div>
      )}

      {/* typing */}
      {isTyping && (
        <div style={{ margin: "10px 0" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { if (answered) return; setInput(e.target.value) }}
            onKeyDown={e => { if (e.key === "Enter" && !answered) answerTyping() }}
            placeholder="英単語を入力..."
            style={{
              width: "100%", padding: "16px", fontSize: "20px", borderRadius: "12px",
              border: answered ? (lastCorrect ? "2px solid #02ccbb" : "2px solid #ff4444") : "2px solid #ddd",
              background: "white", boxSizing: "border-box", textAlign: "center"
            }}
          />
        </div>
      )}

      {/* フィードバック＋次へ */}
      {answered && (
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold", color: lastCorrect ? "#02ccbb" : "#ff4444", marginBottom: "12px" }}>
            {lastCorrect ? "正解！" : `正解は ${q.word.word}`}
          </div>
          <button
            onClick={next}
            style={{ padding: "14px 40px", borderRadius: "100px", border: "none", background: "#02ccbb", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
          >
            {current < questions.length - 1 ? "つぎへ" : "結果を見る"}
          </button>
        </div>
      )}

      {/* typingの回答ボタン */}
      {isTyping && !answered && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
          <button
            onClick={answerTyping}
            style={{ padding: "14px 40px", borderRadius: "100px", border: "none", background: "#333333", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
          >
            こたえる
          </button>
        </div>
      )}
    </div>
  )
}
