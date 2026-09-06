import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import { checkAnswer } from "../engines/PracticeEngine"
import { useProfileContext } from "../utils/ProfileContext"
import Navigation from "../components/Navigation"
import { useDictionary } from "../utils/useDictionary"
import WordPopup from "../components/WordPopup"
import { playSentenceAudio, playAllSentences } from "../utils/ttsPlayer"
import { getMyStory, saveMyStory, listMyStories, deleteMyStory, MY_STORY_LIMIT } from "../utils/myStoryManager"

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

  // --- My長文の保存用 ---
  const rawStoryRef = useRef(null)                 // { title, inputLang, sentences: base[] } 保存に使う元データ
  const [saved, setSaved] = useState(false)        // 保存済みか（保存版で開いた/保存した）
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")       // 「ログインが必要」等の通知
  const [showSaveModal, setShowSaveModal] = useState(false) // 上限時の上書き選択
  const [overwriteList, setOverwriteList] = useState([])

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
    // base sentence {id,en,ja,answer,chips,audio} → 本家CSVと同じ列構造へ
    function mapToSData(base) {
      return (base || []).map((s, i) => {
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
    }

    async function load() {
      // --- My長文: まず sessionStorage（その場プレイ）、無ければ Firestore（保存版）---
      if (isMy) {
        const raw = typeof window !== "undefined" ? sessionStorage.getItem(`myStory:${id}`) : null
        let payload = null
        let alreadySaved = false
        if (raw) {
          payload = JSON.parse(raw) // { title, inputLang, sentences: base[] }
        } else {
          const doc = await getMyStory(id) // 保存版
          if (!doc) return
          payload = doc
          alreadySaved = true
        }
        const base = payload.sentences || []
        rawStoryRef.current = { title: payload.title || "My長文", inputLang: payload.inputLang || "en", sentences: base }
        setSaved(alreadySaved)
        setSentences(mapToSData(base))
        setStoryName(payload.title || "My長文")
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
      router.replace("/myStoryComplete")
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

  // --- My長文の保存 ---
  async function handleSaveMyStory() {
    if (saved || saving || !rawStoryRef.current) return
    setSaveMsg("")
    const list = await listMyStories()
    const alreadyThis = list.some(x => x.storyId === id)
    if (list.length >= MY_STORY_LIMIT && !alreadyThis) {
      // 上限 → 上書き対象を選ばせる
      setOverwriteList(list)
      setShowSaveModal(true)
      return
    }
    await doSaveMyStory(null)
  }

  // overwriteId を指定するとその保存を消してから新規保存（＝上書き）
  async function doSaveMyStory(overwriteId) {
    setSaving(true)
    setSaveMsg("")
    try {
      if (overwriteId) await deleteMyStory(overwriteId)
      const r = rawStoryRef.current
      await saveMyStory({ storyId: id, title: r.title, inputLang: r.inputLang, sentences: r.sentences })
      setSaved(true)
      setShowSaveModal(false)
    } catch (e) {
      setSaveMsg(e?.message === "not_signed_in" ? "保存にはログインが必要です。" : "保存に失敗しました。")
    } finally {
      setSaving(false)
    }
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
        <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => router.push(isMy ? "/myStoryList" : `/storyList?category=${category}`)}
            style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
          >
            ◀
          </button>
          {isMy && (
            saved ? (
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#5cb85c" }}>保存済み ✓</span>
            ) : (
              <button
                onClick={handleSaveMyStory}
                disabled={saving}
                style={{
                  padding: "7px 16px", borderRadius: "999px", border: "none",
                  background: saving ? "#ccc" : "#333333", color: "#fff",
                  fontSize: "13px", fontWeight: "bold", cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "保存中…" : "保存する"}
              </button>
            )
          )}
        </div>
        {isMy && saveMsg && (
          <div style={{ textAlign: "center", color: "#d9534f", fontSize: "13px", marginBottom: "6px" }}>{saveMsg}</div>
        )}

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

        {/* 保存枠が満杯のときの上書き選択モーダル */}
        {showSaveModal && (
          <div
            onClick={() => setShowSaveModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1000 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "22px 18px", maxWidth: "360px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", lineHeight: 1.6, marginBottom: "14px", textAlign: "center" }}>
                保存枠がいっぱいです。<br />どの長文に上書きしますか？
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "40vh", overflowY: "auto" }}>
                {overwriteList.map(s => (
                  <button
                    key={s.storyId}
                    onClick={() => doSaveMyStory(s.storyId)}
                    disabled={saving}
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1px solid #e0e0e0", background: "#fff", color: "#333", fontSize: "14px", fontWeight: "bold", textAlign: "left", cursor: "pointer" }}
                  >
                    {s.title || "無題の長文"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{ marginTop: "14px", width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #ccc", background: "#fff", color: "#666", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                やっぱりやめる
              </button>
            </div>
          </div>
        )}

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
