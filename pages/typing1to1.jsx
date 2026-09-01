import { saveVocabRoundProgress, saveVocabMastery, getVocabRoundProgress, getVocabMastery, addVocabHistory } from "../utils/vocabProgressManager"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"

// レーベンシュタイン距離（2つの文字列の違いを数える）
function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

export default function Typing() {
  const router = useRouter()
  const { section, round } = router.query
  const [slideState, setSlideState] = useState("idle")
  const [words, setWords] = useState([])
  const [current, setCurrent] = useState(0)
  const [input, setInput] = useState("")
  const [result, setResult] = useState(null)
  const [correctAnswer, setCorrectAnswer] = useState("")
  const [doneWords, setDoneWords] = useState(new Set())
  const [roundInfo, setRoundInfo] = useState(null)
  const doneWordsRef = useRef(new Set())
  const masteryMapRef = useRef({})
  const [masteryMap, setMasteryMap] = useState({})
  const inputRef = useRef(null)
  const seikaiRef = useRef(null)
  const isFirstClearRef = useRef(false) // ★追加：初クリア判定用

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
      const secText = await secRes.text()
      const secData = Papa.parse(secText, {
        header: true,
        skipEmptyLines: true
      }).data
      const sectionInfo = secData.find(s => s.section_id === section)
      if (!sectionInfo) return

      const rRes = await fetch(`/data/vocab/rounds/${sectionInfo.rounds_csv}`)
      const rText = await rRes.text()
      const rData = Papa.parse(rText, {
        header: true,
        skipEmptyLines: true
      }).data
      const currentRound = rData.find(r => r.round_id === round)
      setRoundInfo(currentRound)

      const wRes = await fetch(`/data/vocab/words/${sectionInfo.words_csv}`)
      const wText = await wRes.text()
      const wData = Papa.parse(wText, {
        header: true,
        skipEmptyLines: true
      }).data

      const from = currentRound.word_from
      const to = currentRound.word_to
      const filtered = wData.filter(w =>
        w.word_id >= from && w.word_id <= to
      )

      let selectedWords
      if (currentRound.is_review === "1") {
        const masteryKey = `vocab_mastery_${section}_mode3`
        const masteryData = JSON.parse(localStorage.getItem(masteryKey) || '{}')

        const sorted = filtered.sort((a, b) => {
          const easeA = masteryData[a.word_id]?.ease ?? 0
          const easeB = masteryData[b.word_id]?.ease ?? 0
          if (easeA !== easeB) return easeA - easeB
          const dateA = masteryData[a.word_id]?.lastStudied ?? "0"
          const dateB = masteryData[b.word_id]?.lastStudied ?? "0"
          return dateA.localeCompare(dateB)
        })
        selectedWords = sorted.slice(0, 10)
      } else {
        selectedWords = shuffle(filtered).slice(0, 10)
      }

      setWords(selectedWords)

      // 「できた」を読み込む
      const roundProgress = await getVocabRoundProgress(round)
      doneWordsRef.current = new Set(roundProgress.doneWords)
      setDoneWords(new Set(roundProgress.doneWords))

      // ★ ロード時点で✓がついてないなら初クリア扱い
      const totalWords = 10
      const alreadyCleared = (roundProgress.doneWords?.length || 0) >= totalWords
      isFirstClearRef.current = !alreadyCleared

      // 習熟度を読み込む
      const existingMastery = await getVocabMastery(section, "mode3")
      masteryMapRef.current = existingMastery
      setMasteryMap(existingMastery)

      // 効果音の準備
      if (!seikaiRef.current) {
        seikaiRef.current = new Audio("/sound/seikai.mp3")
        seikaiRef.current.playbackRate = 1.5
        seikaiRef.current.volume = 0.5
      }
    }
    load()
  }, [router.isReady])

  // 入力欄にフォーカス
  useEffect(() => {
    if (result === null) {
      inputRef.current?.focus()
    }
  }, [current, result])

  function shuffle(array) {
    const copy = [...array]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = copy[i]
      copy[i] = copy[j]
      copy[j] = temp
    }
    return copy
  }

  function updateMastery(wordId, isCorrect) {
    const current = masteryMapRef.current[wordId] || {
      correct: 0, wrong: 0, streak: 0, ease: 0, lastResult: null, mastery: "①未学習"
    }

    const updated = isCorrect ? {
      ...current,
      correct: current.correct + 1,
      streak: current.streak + 1,
      ease: Math.min(10, current.ease + 1),
      lastResult: true,
      lastStudied: new Date().toISOString(),
    } : {
      ...current,
      wrong: current.wrong + 1,
      streak: 0,
      ease: Math.max(0, current.ease - 1),
      lastResult: false,
      lastStudied: new Date().toISOString(),
    }

    if (updated.ease >= 2 && updated.streak >= 2) {
      updated.mastery = "③定着済"
    } else if (updated.correct > 0 || updated.wrong > 0) {
      updated.mastery = "②学習中"
    } else {
      updated.mastery = "①未学習"
    }

    const newMap = { ...masteryMapRef.current, [wordId]: updated }
    masteryMapRef.current = newMap
    setMasteryMap(newMap)
  }

  async function saveProgress() {
    await saveVocabRoundProgress(round, [...doneWordsRef.current], 20)
    await saveVocabMastery(section, "mode3", masteryMapRef.current)
    await addVocabHistory(round, section)
  }

  function check() {
    const currentWord = words[current]
    const correct = currentWord.word.trim().toLowerCase()
    const userInput = input.trim().toLowerCase()
    const distance = levenshtein(userInput, correct)

    if (distance === 0) {
      const newDone = new Set([...doneWordsRef.current, currentWord.word_id])
      doneWordsRef.current = newDone
      setDoneWords(newDone)
      updateMastery(currentWord.word_id, true)
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play()
      }
      setResult("correct")
    } else if (distance === 1) {
      const newDone = new Set([...doneWordsRef.current, currentWord.word_id])
      doneWordsRef.current = newDone
      setDoneWords(newDone)
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play()
      }
      setCorrectAnswer(currentWord.word)
      setResult("typo")
    } else {
      updateMastery(currentWord.word_id, false)
      setCorrectAnswer(currentWord.word)
      setResult("wrong")
    }
  }

  async function next() {
    if (current < words.length - 1) {
      setSlideState("out")
      setTimeout(() => {
        setCurrent(c => c + 1)
        setInput("")
        setResult(null)
        setCorrectAnswer("")
        setSlideState("in")
        setTimeout(() => {
          setSlideState("idle")
          inputRef.current?.focus()
        }, 50)
      }, 400)
    } else {
      await saveProgress()
      // ★ isFirstClearをURLに追加
      router.replace(`/vocabComplete?stage=${section.split("_")[0]}&section=${section}&round=${round}&isFirstClear=${isFirstClearRef.current}`)
    }
  }

  if (words.length === 0) return <div>loading...</div>

  const currentWord = words[current]

  const slideStyle = {
    transition: slideState === "idle" ? "transform 0.4s ease, opacity 0.4s ease" :
                slideState === "out" ? "transform 0.4s ease, opacity 0.4s ease" : "none",
    transform: slideState === "out" ? "translateX(-120%)" :
               slideState === "in" ? "translateX(120%)" : "translateX(0)",
    opacity: slideState === "out" ? 0 : 1,
  }

  return (
    <div style={{
      maxWidth: "400px",
      margin: "auto",
      padding: "20px",
      minHeight: "100vh",
      background: "#ebebeb"
    }}>

      {/* 進捗ドット */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "8px",
        padding: "15px 0"
      }}>
        {words.map((_, i) => (
          <div key={i} style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: i === current ? "#02ccbb" : "#ddd"
          }} />
        ))}
      </div>

      {/* ポチアニメーション */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
        <video
          src="/animations/pochi-tokotoko.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "120px" }}
        />
      </div>

      {/* スライドエリア */}
      <div style={{ overflow: "hidden" }}>
        <div style={slideStyle}>

          {/* 日本語表示 */}
          <div style={{
            textAlign: "center",
            fontSize: "32px",
            fontWeight: "bold",
            margin: "30px 0"
          }}>
            {currentWord.ja}
          </div>
                    
          {/* デバッグ用（確認したら消す） 
          <div style={{ fontSize: "12px", color: "#999", textAlign: "center" }}>
            ease: {masteryMap[currentWord?.word_id]?.ease ?? 0} /
            streak: {masteryMap[currentWord?.word_id]?.streak ?? 0} /
            mastery: {masteryMap[currentWord?.word_id]?.mastery ?? "①未学習"}
          </div>
          */}


          {/* 入力欄 */}
          <div style={{ margin: "20px 0" }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => {
                if (result !== null) return
                setInput(e.target.value)
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && result === null) check()
                if (e.key === "Enter" && result !== null) next()
              }}
              placeholder="英単語を入力..."
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "20px",
                borderRadius: "12px",
                border: result === "correct" || result === "typo"
                  ? "2px solid #02ccbb"
                  : result === "wrong"
                  ? "2px solid #ff4444"
                  : "2px solid #ddd",
                background: "white",
                boxSizing: "border-box",
                textAlign: "center"
              }}
            />
          </div>

          {/* 結果表示 */}
          {result === "typo" && (
            <div style={{
              textAlign: "center",
              color: "#02ccbb",
              fontSize: "16px",
              marginBottom: "10px"
            }}>
              スペルミスあり！正解は <strong>{correctAnswer}</strong>
            </div>
          )}
          {result === "wrong" && (
            <div style={{
              textAlign: "center",
              color: "#ff4444",
              fontSize: "16px",
              marginBottom: "10px"
            }}>
              惜しい！正解は <strong>{correctAnswer}</strong>
            </div>
          )}

          {/* ボタン */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <button
              onClick={result === null ? check : next}
              style={{
                width: "200px",
                padding: "16px",
                borderRadius: "40px",
                border: "none",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                background: result === "correct" || result === "typo"
                  ? "#02ccbb"
                  : result === "wrong"
                  ? "#ff4444"
                  : "#555",
                color: "white"
              }}
            >
              {result === null ? "チェック" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
