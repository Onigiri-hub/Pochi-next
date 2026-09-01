import { saveVocabRoundProgress, saveVocabMastery, getVocabRoundProgress, getVocabMastery, addVocabHistory } from "../utils/vocabProgressManager"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"

export default function FourChoices() {
  const router = useRouter()
  const { section, round, stage } = router.query

  const [words, setWords] = useState([])
  const [allWords, setAllWords] = useState([])
  const [current, setCurrent] = useState(0)
  const [choices, setChoices] = useState([])
  const [eliminated, setEliminated] = useState([])
  const [correct, setCorrect] = useState(false)
  const [slideState, setSlideState] = useState("idle")
  const [timeLeft, setTimeLeft] = useState(45)
  const [doneWords, setDoneWords] = useState(new Set())
  const [roundInfo, setRoundInfo] = useState(null)
  const timerRef = useRef(null)
  const doneWordsRef = useRef(new Set())
  const seikaiRef = useRef(null)
  const [masteryMap, setMasteryMap] = useState({})
  const masteryMapRef = useRef({})
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

      // ★効果音を最初に準備（load()より先に）
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
      setAllWords(wData)

      const from = currentRound.word_from
      const to = currentRound.word_to
      const filtered = wData.filter(w =>
        w.word_id >= from && w.word_id <= to
      )

      let selectedWords

      if (currentRound.is_review === "1") {
        const modeKey = getModeKey(currentRound.mode_type)
        const masteryKey = `vocab_mastery_${section}_${modeKey}`
        const masteryData = JSON.parse(localStorage.getItem(masteryKey) || '{}')

        const sorted = filtered.sort((a, b) => {
          const easeA = masteryData[a.word_id]?.ease ?? 0
          const easeB = masteryData[b.word_id]?.ease ?? 0
          if (easeA !== easeB) return easeA - easeB
          const dateA = masteryData[a.word_id]?.lastStudied ?? "0"
          const dateB = masteryData[b.word_id]?.lastStudied ?? "0"
          return dateA.localeCompare(dateB)
        })
        selectedWords = sorted.slice(0, 20)
        } else {
          // 正答回数(correct)が低い順に並べて、同率はshuffleで混ぜる
          const modeKey = getModeKey(currentRound.mode_type)
          const masteryKey = `vocab_mastery_${section}_${modeKey}`
          const masteryData = JSON.parse(localStorage.getItem(masteryKey) || '{}')

          const sorted = filtered
            .map(w => ({ ...w, _correct: masteryData[w.word_id]?.correct ?? 0 }))
            .sort((a, b) => {
              if (a._correct !== b._correct) return a._correct - b._correct
              return Math.random() - 0.5  // 同率はランダム
            })
          selectedWords = sorted.slice(0, 20)
        }

      setWords(selectedWords)

      // 「できた」を読み込む
      const roundProgress = await getVocabRoundProgress(round)
      doneWordsRef.current = new Set(roundProgress.doneWords)
      setDoneWords(new Set(roundProgress.doneWords))

      // ★ ロード時点で✓がついてないなら初クリア扱い
      const totalWords = currentRound.is_review === "1" ? selectedWords.length : 20
      const alreadyCleared = roundProgress.doneWords?.length >= totalWords
      isFirstClearRef.current = !alreadyCleared

      // 習熟度を読み込む
      const modeKey = getModeKey(currentRound.mode_type)
      const existingMastery = await getVocabMastery(section, modeKey)
      masteryMapRef.current = existingMastery
      setMasteryMap(existingMastery)

    }
    load()
  }, [router.isReady])

  useEffect(() => {
    if (words.length === 0) return
    setChoices(makeChoices(words[current], allWords))
    setEliminated([])
    setCorrect(false)
  }, [current, words])

  useEffect(() => {
    if (words.length === 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          saveRoundProgress(roundInfo?.is_review === "1")
          saveMastery()
          // ★ isFirstClearをURLに追加
          router.replace(`/vocabComplete?stage=${section.split("_")[0]}&section=${section}&round=${round}&isFirstClear=${isFirstClearRef.current}`)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [words])

  // 自動再生（en2jaのときだけ）
  useEffect(() => {
    if (!roundInfo || !words[current]?.audio) return
    if (!roundInfo.mode_type.includes("en2ja")) return

    const audio = new Audio(`/audio/words/${words[current].audio}`)
    audio.play().catch(e => console.log("再生失敗:", e))
  }, [current, roundInfo])

  function getModeKey(modeType) {
    if (modeType?.includes("en2ja")) return "mode1"
    if (modeType?.includes("ja2en")) return "mode2"
    if (modeType?.includes("typing")) return "mode3"
    return "mode1"
  }

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

  function makeChoices(correctWord, pool) {
    const others = pool.filter(w => w.word_id !== correctWord.word_id)
    const dummies = shuffle(others).slice(0, 3)
    return shuffle([correctWord, ...dummies])
  }

  async function saveRoundProgress(isReview) {
    const totalWords = isReview ? words.length : 20
    await saveVocabRoundProgress(round, [...doneWordsRef.current], totalWords)
    await addVocabHistory(round, section)
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

  function handleSelect(choice) {
    const isCorrect = choice.word_id === currentWord.word_id

    if (isCorrect) {
      if (eliminated.length === 0) {
        const newDone = new Set([...doneWordsRef.current, currentWord.word_id])
        doneWordsRef.current = newDone
        setDoneWords(newDone)
      }
      updateMastery(currentWord.word_id, true)
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play()
      }
      setCorrect(true)
      setTimeout(() => {
        setSlideState("out")
        setTimeout(() => {
          if (current < words.length - 1) {
            setCurrent(c => c + 1)
          } else {
            saveRoundProgress(roundInfo?.is_review === "1")
            saveMastery()
            setWords(prev => {
              return [...prev]
                .map(w => ({ ...w, _correct: masteryMapRef.current[w.word_id]?.correct ?? 0 }))
                .sort((a, b) => {
                  if (a._correct !== b._correct) return a._correct - b._correct
                  return Math.random() - 0.5
                })
            })
            setCurrent(0)
          }
          setSlideState("in")
          setTimeout(() => {
            setSlideState("idle")
          }, 50)
        }, 100)
      }, 200)
    } else {
      updateMastery(currentWord.word_id, false)
      setEliminated(prev => [...prev, choice.word_id])
    }
  }

  async function saveMastery() {
    const modeKey = getModeKey(roundInfo?.mode_type)
    await saveVocabMastery(section, modeKey, masteryMapRef.current)
  }

  const slideStyle = {
    transition: slideState === "idle" ? "transform 0.4s ease, opacity 0.4s ease" :
                slideState === "out" ? "transform 0.4s ease, opacity 0.4s ease" : "none",
    transform: slideState === "out" ? "translateX(-120%)" :
               slideState === "in" ? "translateX(120%)" : "translateX(0)",
    opacity: slideState === "out" ? 0 : 1,
  }

  if (words.length === 0) return <div>loading...</div>

  const currentWord = words[current]
  const timePercent = (timeLeft / 45) * 100

  return (
    <div style={{
      maxWidth: "400px",
      margin: "auto",
      padding: "20px",
      minHeight: "100vh",
      background: "#ebebeb"
    }}>

      {/* 時間制限バー */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "20px"
      }}>
        <div style={{
          flexGrow: 1,
          height: "10px",
          background: "#ddd",
          borderRadius: "5px",
          overflow: "hidden"
        }}>
          <div style={{
            width: `${timePercent}%`,
            height: "100%",
            background: timeLeft <= 10 ? "#ff4444" : "#58cc02",
            borderRadius: "5px",
            transition: "width 1s linear"
          }} />
        </div>
        <div style={{ fontSize: "16px", fontWeight: "bold", minWidth: "30px" }}>
          {timeLeft}
        </div>
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

      {/* 単語と4択だけスライド */}
      <div style={{ overflow: "hidden" }}>
        <div style={slideStyle}>

          {/* 英単語 or 日本語（mode_typeで切り替え） */}
          <div style={{
            textAlign: "center",
            fontSize: "36px",
            fontWeight: "bold",
            margin: "30px 0"
          }}>
            {roundInfo?.mode_type?.includes("ja2en")
              ? currentWord.ja
              : currentWord.word
            }
          </div>
                    
          {/* デバッグ用（確認したら消す） 
          <div style={{ fontSize: "12px", color: "#999", textAlign: "center" }}>
            できた: {[...doneWords].join(", ") || "なし"}<br/>
            ease: {masteryMap[currentWord?.word_id]?.ease ?? 0} / 
            streak: {masteryMap[currentWord?.word_id]?.streak ?? 0} / 
            mastery: {masteryMap[currentWord?.word_id]?.mastery ?? "①未学習"}
          </div>
          */}


          {/* 4択ボタン */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {choices.map((choice, i) => {
              const isCorrect = choice.word_id === currentWord.word_id
              const isEliminated = eliminated.includes(choice.word_id)

              let bgColor = "white"
              let textColor = "#333333"
              if (correct && isCorrect) {
                bgColor = "#02ccbb"
                textColor = "white"
              } else if (isEliminated) {
                bgColor = "#bdbdbd"
                textColor = "#333333"
              }

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isEliminated || correct) return
                    handleSelect(choice)
                  }}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "2px solid #ddd",
                    background: bgColor,
                    color: textColor,
                    fontSize: "18px",
                    cursor: (isEliminated || correct) ? "default" : "pointer",
                    transition: "background 0.2s"
                  }}
                >
                  {roundInfo?.mode_type?.includes("ja2en")
                    ? choice.word
                    : choice.ja
                  }
                </button>
              )
            })}
          </div>

        </div>
      </div>

    </div>
  )
}
