import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import { checkAnswer } from "../engines/PracticeEngine"
import { useProfileContext } from "../utils/ProfileContext"
import Navigation from "../components/Navigation"
import { useDictionary } from "../utils/useDictionary"
import WordPopup from "../components/WordPopup"
import { playSentenceAudio, playAllSentences } from "../utils/ttsPlayer"

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function Story() {
  const router = useRouter()
  const { id, source } = router.query // 例: c01_s001 / source==="my" はユーザー投稿長文
  const isMy = source === "my"
  const category = id ? String(id).split("_")[0] : ""
  const storyId = id ? String(id).split("_")[1] : ""
  const order = storyId ? Number(storyId.replace(/\D/g, "")) : 0

  const [sentences, setSentences] = useState([])
  const [storyName, setStoryName] = useState("")
  const [phase, setPhase] = useState("preview") // "preview" | "arrange"

  // --- プレビュー用 ---
  const [showEn, setShowEn] = useState(false)
  const [showJa, setShowJa] = useState(false)
  const listenRef = useRef({ playing: false, idx: 0, audio: null })

  // --- 並べ替え用 ---
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState([])
  const [chips, setChips] = useState([])
  const [result, setResult] = useState(null)
  const pa = useRef(null)
  const seikaiRef = useRef(null)

  const { profile } = useProfileContext()
  const { tokenize, findEntry } = useDictionary()
  const [popupEntry, setPopupEntry] = useState(null)
  const longPressTimer = useRef(null)
  const chipLockRef = useRef(false)

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = "none"
    document.body.style.overscrollBehavior = "none"
    return () => {
      document.documentElement.style.overscrollBehavior = ""
      document.body.style.overscrollBehavior = ""
    }
  }, [])

  useEffect(() => {
    pa.current = new Audio("/sound/pa.mp3")
    pa.current.volume = 0.3
    seikaiRef.current = new Audio("/sound/seikai.mp3")
    seikaiRef.current.playbackRate = 1.5
    seikaiRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    if (!router.isReady || !id) return
    async function load() {
      // --- My長文: sessionStorage から読み込み（本家CSVと同じ列構造にマッピング）---
      if (isMy) {
        const raw = typeof window !== "undefined" ? sessionStorage.getItem(`myStory:${id}`) : null
        if (!raw) return
        const parsed = JSON.parse(raw)
        const sData = (parsed.sentences || []).map((s, i) => {
          const answer = s.answer || s.en
          return {
            question_id: s.id || `s${i + 1}`,
            question_NO: String(i + 1),
            en: s.en,
            ja: s.ja,
            answer,
            chips: s.chips || (answer || "").trim().split(/\s+/).join("|"),
            audio: s.audio || null,       // free時はnull → Web Speechにフォールバック
            audio_auto: "0",
            icon_first: "user",
            position_first: "left",
          }
        })
        setSentences(sData)
        setStoryName(parsed.title || "My長文")
        return
      }

      // --- 本家: CSV から読み込み ---
      const [sRes, listRes] = await Promise.all([
        fetch(`/data/story/sentences/${id}.csv`),
        fetch("/data/story/story_list.csv"),
      ])
      // 1ストーリー1ファイル。念のため question_NO 順に並べる
      const sData = Papa.parse(await sRes.text(), { header: true, skipEmptyLines: true }).data
        .filter(r => r.question_id)
        .sort((a, b) => Number(a.question_NO) - Number(b.question_NO))
      setSentences(sData)

      const listData = Papa.parse(await listRes.text(), { header: true, skipEmptyLines: true }).data
      const meta = listData.find(r => r.category_id === category && r.story_id === storyId)
      setStoryName(meta?.story_name || "")
    }
    load()
  }, [router.isReady, id, source])

  // 並べ替えの各問セットアップ
  useEffect(() => {
    if (phase !== "arrange" || sentences.length === 0) return
    const q = sentences[index]
    setChips(shuffle((q.chips || "").split("|").filter(c => c !== "")))
    setSelected([])
    setResult(null)
  }, [phase, index, sentences])

  // 本家はCSV由来のファイル、My長文はStorage URL(free時はnull→Web Speech)
  function resolveAudioUrl(audio) {
    if (!audio) return null
    if (isMy) return audio // Storage の完全URL（free時はそもそも null）
    return `/audio/story/${audio}`
  }

  // 並べ替え中の自動再生（audio_auto === "1"）
  useEffect(() => {
    if (phase !== "arrange" || sentences.length === 0) return
    const autoPlayOn = localStorage.getItem("autoPlayOn") !== "false"
    const q = sentences[index]
    if (!autoPlayOn || q.audio_auto !== "1" || !q.audio) return
    const timer = setTimeout(() => {
      playSentenceAudio({ text: q.en, audioUrl: resolveAudioUrl(q.audio) })
    }, 500)
    return () => clearTimeout(timer)
  }, [phase, index, sentences])

  // 「とりあえずリスニング」全文を順次通し再生（音声ファイル/Web Speech混在OK）
  function playAllListening() {
    const state = listenRef.current
    if (state.playing) {
      // 停止
      if (state.cancel) state.cancel()
      state.playing = false
      return
    }
    state.playing = true
    const items = sentences.map(s => ({ en: s.en, audioUrl: resolveAudioUrl(s.audio) }))
    state.cancel = playAllSentences(items, {
      onDone: () => { state.playing = false },
    })
  }

  // --- チップ操作（PracticePageから流用）---
  function handleChipPressStart(word) {
    longPressTimer.current = setTimeout(() => {
      const entry = findEntry(word)
      if (entry) {
        setPopupEntry(entry)
        if (entry.audio) new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
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
      if (entry?.audio) new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
    }
    action()
  }

  function handleWordTap(entry) {
    if (entry.audio) new Audio(`/audio/words/${entry.audio}`).play().catch(() => {})
    setPopupEntry(entry)
  }

  function addChip(word, i) {
    if (pa.current) { pa.current.currentTime = 0; pa.current.play() }
    setSelected(prev => [...prev, word])
    setChips(prev => { const c = [...prev]; c.splice(i, 1); return c })
  }

  function removeChip(word, i) {
    if (pa.current) { pa.current.currentTime = 0; pa.current.play() }
    setSelected(prev => { const s = [...prev]; s.splice(i, 1); return s })
    setChips(prev => [...prev, word])
  }

  function check() {
    const q = sentences[index]
    const ok = checkAnswer(selected.join(" "), q.answer)
    if (ok) {
      if (seikaiRef.current) { seikaiRef.current.currentTime = 0; seikaiRef.current.play() }
      setResult("correct")
    } else {
      setResult("wrong")
    }
  }

  function next() {
    if (index < sentences.length - 1) {
      setIndex(i => i + 1)
    } else if (isMy) {
      router.replace("/myStoryList")
    } else {
      router.replace(`/storyComplete?category=${category}&order=${order}&storyId=${id}`)
    }
  }

  function startArrange() {
    // リスニング停止
    if (listenRef.current.cancel) listenRef.current.cancel()
    listenRef.current.playing = false
    setPhase("arrange")
  }

  if (!id || sentences.length === 0) return <div>loading...</div>

  function renderSentence(text) {
    if (!text) return text
    return tokenize(text).map((token, i) =>
      token.entry ? (
        <span key={i} style={{ borderBottom: "1px dotted #c3ccdf", cursor: "pointer" }} onClick={() => handleWordTap(token.entry)}>
          {token.text}
        </span>
      ) : (
        <span key={i}>{token.text}</span>
      )
    )
  }

  // ===================== プレビュー画面 =====================
  if (phase === "preview") {
    return (
      <div className="app" style={{ paddingBottom: "180px" }}>
        <div style={{ padding: "10px 20px" }}>
          <button
            onClick={() => router.push(isMy ? "/myStoryList" : `/storyList?category=${category}`)}
            style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
          >
            ◀
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: "#333", margin: "10px 0 40px" }}>
          {isMy ? storyName : `${storyId?.slice(1)} ${storyName}`}
          <img
            src="/images/icons/speaker-333.svg"
            alt="音声を再生"
            onClick={playAllListening}
            style={{ width: "22px", verticalAlign: "middle", marginLeft: "8px", cursor: "pointer" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px", margin: "0 auto", padding: "0 20px" }}>
          <div className="storyToggle" onClick={() => setShowEn(v => !v)}>
            英文表示　▼
            <img src="/images/illustrations/section_underbar.png" alt="" />
          </div>
          {showEn && (
            <div className="storyReveal">
              <p style={{ margin: 0 }}>
                {sentences.map((s, i) => (
                  <span key={i}>{renderSentence(s.en)}{" "}</span>
                ))}
              </p>
            </div>
          )}

          <div className="storyToggle" onClick={() => setShowJa(v => !v)}>
            日本語表示　▼
            <img src="/images/illustrations/section_underbar.png" alt="" />
          </div>
          {showJa && (
            <div className="storyReveal">
              <p style={{ margin: 0 }}>{sentences.map(s => s.ja).join("")}</p>
            </div>
          )}
        </div>

        <div className="bottomArea">
          <button className="mainButton" onClick={startArrange}>学習開始！</button>
        </div>

        <WordPopup entry={popupEntry} onClose={() => setPopupEntry(null)} />
        <Navigation />

        <style jsx>{`
          .storyToggle {
            align-self: stretch;
            display: block;
            text-align: center;
            cursor: pointer;
            font-size: 17px;
            font-weight: bold;
            color: #333;
            padding: 4px 0 0;
            margin-top: 34px;
          }
          .storyToggle img {
            display: block;
            width: calc(100% + 10px);
            height: auto;
            margin-top: 2px;
            margin-left: -10px;
            pointer-events: none;
          }
          .storyReveal {
            font-size: 16px;
            line-height: 1.7;
            color: #333;
            padding: 4px 6px 8px;
          }
        `}</style>
      </div>
    )
  }

  // ===================== 並べ替え画面 =====================
  const q = sentences[index]

  return (
    <div className="app" style={{ paddingBottom: "180px" }}>
      <div className="progressDots">
        {sentences.map((_, i) => (
          <div key={i} className={i === index ? "dot active" : "dot"} />
        ))}
      </div>

      {/* 日本語ヒント */}
      <div className={`chat ${q.position_first || "left"}`}>
        <div className="iconContainer">
          {q.icon_first === "user" || !q.icon_first ? (
            <img src={`/images/avatars/${profile?.avatar || "01.png"}`} alt="" className="characterIcon" />
          ) : (
            <img src={`/images/avatars/${q.icon_first}`} alt="" className="characterIcon" />
          )}
        </div>
        <div className="bubble">
          <div className="en">
            <span className="audioBtn" onClick={() => playSentenceAudio({ text: q.en, audioUrl: resolveAudioUrl(q.audio) })}>
              <img src="/images/icons/speaker-333.svg" alt="音声を再生" />
            </span>
            {q.ja}
          </div>
        </div>
      </div>

      {/* 答えエリア */}
      <div className="chipBox">
        {selected.map((w, i) => (
          <button
            key={i}
            className="chip"
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

      {/* チップ */}
      <div>
        {chips.map((c, i) => (
          <button
            key={i}
            className="chip"
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
          onClick={result === "correct" ? next : result === "wrong" ? () => setResult(null) : check}
        >
          {result === "correct" ? "Next" : result === "wrong" ? "Try again" : "Check"}
        </button>
      </div>

      <WordPopup entry={popupEntry} onClose={() => setPopupEntry(null)} />
      <Navigation />
    </div>
  )
}
