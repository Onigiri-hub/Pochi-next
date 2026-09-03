import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import Navigation from "../components/Navigation"
import { getArrangeWordStatus, saveArrangeWordConfidence } from "../utils/vocabProgressManager"

// 自信度 → 色
const CONFIDENCE_COLORS = {
  none: "#ccc",   // グレー：未入力
  low: "#e53935", // 赤：自信ない
  high: "#02ccbb" // 青緑：自信あり
}
const LEARNED_COLOR = "#ffa726" // オレンジ：履修済み
const UNLEARNED_COLOR = "#ccc"  // グレー：未履修

// 履修/自信度の6区分（バケツ）定義
const BUCKETS = {
  off_none: { learned: false, conf: "none", label: "未習・自信未入力" },
  off_low:  { learned: false, conf: "low",  label: "未習・自信ない" },
  on_none:  { learned: true,  conf: "none", label: "履修済み・自信未入力" },
  on_low:   { learned: true,  conf: "low",  label: "履修済み・自信ない" },
  off_high: { learned: false, conf: "high", label: "未習・自信あり" },
  on_high:  { learned: true,  conf: "high", label: "履修済み・自信あり" },
}
// デフォルトの優先順位（上ほど先に出題）
const DEFAULT_ORDER = ["off_none", "off_low", "on_none", "on_low", "off_high", "on_high"]
const SORT_ORDER_KEY = "arrangeSortOrder"
const WORDS_PER_SESSION = 5 // 「上から順番に」1回の語数（1語2問＝計10問）
const ROW_H = 60 // 設定モーダルの1行の高さ（ドラッグ計算用：行52px + 余白8px）

// 単語のステータス → バケツキー
function bucketKey(status = {}) {
  const learned = status.learned ? "on" : "off"
  const conf = status.confidence || "none"
  return `${learned}_${conf}`
}

// localStorageから優先順位を読む（壊れていればデフォルト）
function getStoredOrder() {
  try {
    const raw = localStorage.getItem(SORT_ORDER_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every(k => arr.includes(k))) {
        return arr
      }
    }
  } catch {}
  return DEFAULT_ORDER
}

// 優先順位（order）でソート。同ランクは元の並び（CSV順）を維持
function sortByPriority(list, statusMap, order) {
  const rankOf = (id) => {
    const r = order.indexOf(bucketKey(statusMap[id]))
    return r === -1 ? order.length : r
  }
  return list
    .map((w, i) => ({ w, i, rank: rankOf(w.arrange_word_id) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(x => x.w)
}

// アルファベット順（大文字小文字を区別しない）でソート
function sortAlphabetically(list) {
  return [...list].sort((a, b) =>
    (a.arrange_word || "").localeCompare(b.arrange_word || "", "en", { sensitivity: "base" })
  )
}

const toolBtnStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "#555",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer"
}

export default function ArrangeSectionList() {
  const [words, setWords] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [popupWord, setPopupWord] = useState(null) // 自信度ポップアップ対象の単語
  const [showSortMenu, setShowSortMenu] = useState(false) // 並べ替え方法の選択メニュー
  const [showSortSettings, setShowSortSettings] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false) // 自分で選んで出題モーダル
  const [selectedIds, setSelectedIds] = useState([]) // 選択中の単語ID（選んだ順）
  const [selectToast, setSelectToast] = useState(null) // 選択モーダル内のトースト
  const [order, setOrderState] = useState(DEFAULT_ORDER)
  const orderRef = useRef(DEFAULT_ORDER)
  const setOrder = (next) => {
    const v = typeof next === "function" ? next(orderRef.current) : next
    orderRef.current = v
    setOrderState(v)
  }
  const [dragIndex, setDragIndexState] = useState(null)
  const dragIndexRef = useRef(null)
  const setDragIndex = (v) => { dragIndexRef.current = v; setDragIndexState(v) }
  const [dragOffset, setDragOffset] = useState(0)
  const pointerStartY = useRef(0)
  const router = useRouter()
  const { stage, name } = router.query
  const stageName = name ? decodeURIComponent(name) : ""

  useEffect(() => {
    if (!stage) return

    async function load() {
      const res = await fetch(`/data/vocab/arrange_words/arrange_words_${stage}.csv`)
      const text = await res.text()
      const data = Papa.parse(text, { header: true, skipEmptyLines: true }).data
      const list = data.filter(w => w.arrange_word)

      const status = await getArrangeWordStatus(stage)
      setStatusMap(status)
      const savedOrder = getStoredOrder()
      setOrder(savedOrder)
      setWords(sortByPriority(list, status, savedOrder))

      setLoading(false)
    }
    load()
  }, [stage])

  function startOrdered() {
    // 「自信あり」は除外して、上位5語を出題
    const pool = words.filter(w => statusMap[w.arrange_word_id]?.confidence !== "high")
    const picked = pool.slice(0, WORDS_PER_SESSION)
    if (picked.length === 0) return
    const ids = picked.map(w => w.arrange_word_id).join(",")
    router.push(`/arrangePractice?stage=${stage}&words=${ids}`)
  }

  async function setConfidence(wordId, confidence) {
    const updated = await saveArrangeWordConfidence(stage, wordId, confidence)
    setStatusMap({ ...updated })
    setPopupWord(null)
  }

  // いま表示中のリストを現在の優先順位で並べ直す
  function resortNow() {
    setWords(sortByPriority(words, statusMap, orderRef.current))
  }

  // 並べ替えメニューから：アルファベット順
  function sortByAlphabet() {
    setWords(sortAlphabetically(words))
    setShowSortMenu(false)
  }

  // 並べ替えメニューから：優先順位の設定どおり
  function sortByPriorityNow() {
    resortNow()
    setShowSortMenu(false)
  }

  // --- 自分で選んで出題 ---
  function openSelectModal() {
    setSelectedIds([])
    setShowSelectModal(true)
  }
  function closeSelectModal() {
    setShowSelectModal(false)
    setSelectedIds([])
  }
  function showSelectToast(msg) {
    setSelectToast(msg)
    setTimeout(() => setSelectToast(null), 2000)
  }
  // 行タップで選択トグル（最大 WORDS_PER_SESSION 個）
  function toggleSelect(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= WORDS_PER_SESSION) {
        showSelectToast(`${WORDS_PER_SESSION}個まで選べます`)
        return prev
      }
      return [...prev, id]
    })
  }
  // 選んだ単語（表示順）で出題開始
  function startSelected() {
    if (selectedIds.length === 0) return
    const ids = words
      .filter(w => selectedIds.includes(w.arrange_word_id))
      .map(w => w.arrange_word_id)
      .join(",")
    router.push(`/arrangePractice?stage=${stage}&words=${ids}`)
  }

  // 設定モーダルを閉じる（保存＆並べ直し）
  function closeSortSettings() {
    localStorage.setItem(SORT_ORDER_KEY, JSON.stringify(orderRef.current))
    setShowSortSettings(false)
    setWords(sortByPriority(words, statusMap, orderRef.current))
  }

  // --- 6区分のドラッグ並べ替え ---
  function startDrag(e, i) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartY.current = e.clientY
    setDragIndex(i)
    setDragOffset(0)
  }

  function onDragMove(e) {
    const di = dragIndexRef.current
    if (di === null) return
    const offset = e.clientY - pointerStartY.current
    const target = Math.max(0, Math.min(orderRef.current.length - 1, di + Math.round(offset / ROW_H)))
    if (target !== di) {
      const next = [...orderRef.current]
      const [moved] = next.splice(di, 1)
      next.splice(target, 0, moved)
      setOrder(next)
      pointerStartY.current += (target - di) * ROW_H
      setDragIndex(target)
      setDragOffset(e.clientY - pointerStartY.current)
    } else {
      setDragOffset(offset)
    }
  }

  function endDrag() {
    setDragIndex(null)
    setDragOffset(0)
  }

  if (loading) return <div>loading...</div>

  return (
    <div className="unitListContainer" style={{ paddingBottom: "100px" }}>
      <div className="unitList" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>

        {/* ヘッダー：◀ Stage名 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", position: "relative" }}>
          <button
            onClick={() => router.push("/stageList")}
            style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
          >
            ◀
          </button>
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontWeight: "bold", fontSize: "16px", color: "#333333" }}>
            {stageName}
          </div>
        </div>

        {/* 出題モードボタン */}
        <div style={{ display: "flex", gap: "12px", margin: "20px 0" }}>
          <button
            onClick={startOrdered}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: "100px",
              border: "none",
              background: "#333333",
              color: "white",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            上から順番にやる！
          </button>
          <button
            onClick={openSelectModal}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: "100px",
              border: "none",
              background: "#333333",
              color: "white",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            自分で選んで出題
          </button>
        </div>

        {/* 設定・並べ替えツールバー */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "8px" }}>
          <button onClick={() => setShowSortMenu(true)} style={toolBtnStyle}>🔃 並べ替え</button>
          <button onClick={() => setShowSortSettings(true)} style={toolBtnStyle}>
            <img src="/images/icons/settings-333.svg" alt="" style={{ width: "1em", height: "1em", verticalAlign: "-0.15em", marginRight: "4px" }} />
            優先順位の設定
          </button>
        </div>

        {/* 単語一覧（スクロール可能エリア） */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          border: "1px solid #eee",
          borderRadius: "12px",
          padding: "8px 0",
          background: "#fafafa"
        }}>
          {words.map((w, i) => {
            const status = statusMap[w.arrange_word_id] || {}
            const learnedColor = status.learned ? LEARNED_COLOR : UNLEARNED_COLOR
            const confidenceColor = CONFIDENCE_COLORS[status.confidence || "none"]

            return (
              <div
                key={w.arrange_word_id || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 18px",
                  borderBottom: i < words.length - 1 ? "1px solid #eee" : "none",
                  fontSize: "15px",
                  color: "#333"
                }}
              >
                <span style={{ width: "42px", color: "#aaa", fontSize: "13px" }}>{i + 1}</span>
                <span style={{ fontWeight: "bold" }}>{w.arrange_word}</span>

                {/* 右寄せの●2つ */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* 左●：履修（表示のみ） */}
                  <span style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: learnedColor,
                    display: "inline-block"
                  }} />
                  {/* 右●：自信度（タップで入力） */}
                  <span
                    onClick={() => setPopupWord(w)}
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      background: confidenceColor,
                      display: "inline-block",
                      cursor: "pointer"
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* 並べ替え方法の選択メニュー */}
      {showSortMenu && (
        <div
          onClick={() => setShowSortMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "20px",
              width: "80%",
              maxWidth: "300px",
              textAlign: "center"
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "17px", marginBottom: "16px" }}>
              並べ替え
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={sortByAlphabet} style={confBtnStyle("#333333")}>
                アルファベット順に並び替え
              </button>
              <button onClick={sortByPriorityNow} style={confBtnStyle("#02ccbb")}>
                優先順位の設定どおりに並び替え
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自分で選んで出題モーダル */}
      {showSelectModal && (
        <div
          onClick={closeSelectModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              width: "88%",
              maxWidth: "360px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "18px 20px 10px", textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "17px" }}>出題する単語を選ぶ</div>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                タップで選択（{selectedIds.length}/{WORDS_PER_SESSION}）
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
              {words.map((w, i) => {
                const checked = selectedIds.includes(w.arrange_word_id)
                const status = statusMap[w.arrange_word_id] || {}
                const learnedColor = status.learned ? LEARNED_COLOR : UNLEARNED_COLOR
                const confidenceColor = CONFIDENCE_COLORS[status.confidence || "none"]
                return (
                  <div
                    key={w.arrange_word_id || i}
                    onClick={() => toggleSelect(w.arrange_word_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 18px",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      background: checked ? "#e6f9f7" : "white"
                    }}
                  >
                    <span style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "6px",
                      border: checked ? "none" : "2px solid #ccc",
                      background: checked ? "#02ccbb" : "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "13px",
                      flexShrink: 0
                    }}>
                      {checked ? "✓" : ""}
                    </span>
                    <span style={{ fontWeight: "bold", fontSize: "15px", color: "#333" }}>{w.arrange_word}</span>

                    {/* 右寄せの●2つ（表示のみ） */}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: learnedColor, display: "inline-block" }} />
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: confidenceColor, display: "inline-block" }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: "flex", gap: "10px", padding: "14px 20px" }}>
              <button
                onClick={closeSelectModal}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "10px",
                  border: "1px solid #ddd", background: "white", color: "#555",
                  fontSize: "15px", fontWeight: "bold", cursor: "pointer"
                }}
              >
                キャンセル
              </button>
              <button
                onClick={startSelected}
                disabled={selectedIds.length === 0}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "10px", border: "none",
                  background: selectedIds.length === 0 ? "#cccccc" : "#333333",
                  color: "white", fontSize: "15px", fontWeight: "bold",
                  cursor: selectedIds.length === 0 ? "not-allowed" : "pointer"
                }}
              >
                GO
              </button>
            </div>
          </div>

          {selectToast && (
            <div style={{
              position: "fixed",
              bottom: "90px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(50,50,50,0.9)",
              color: "#fff",
              borderRadius: "16px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              zIndex: 1100
            }}>
              {selectToast}
            </div>
          )}
        </div>
      )}

      {/* 自信度ポップアップ */}
      {popupWord && (
        <div
          onClick={() => setPopupWord(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "20px",
              width: "80%",
              maxWidth: "300px",
              textAlign: "center"
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "17px", marginBottom: "16px" }}>
              {popupWord.arrange_word}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => setConfidence(popupWord.arrange_word_id, "low")}
                style={confBtnStyle("#e53935")}
              >
                自信がない
              </button>
              <button
                onClick={() => setConfidence(popupWord.arrange_word_id, "high")}
                style={confBtnStyle("#02ccbb")}
              >
                自信あり（もう出題しない）
              </button>
              <button
                onClick={() => setConfidence(popupWord.arrange_word_id, "none")}
                style={confBtnStyle("#bbb")}
              >
                未設定に戻す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 優先順位の並べ替え設定モーダル */}
      {showSortSettings && (
        <div
          onClick={closeSortSettings}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: "16px", padding: "20px", width: "88%", maxWidth: "360px" }}
          >
            <div style={{ fontWeight: "bold", fontSize: "17px", textAlign: "center", marginBottom: "4px" }}>
              優先順位の設定
            </div>
            <div style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "16px" }}>
              上にあるほど先に出題されます（つまんで並べ替え）
            </div>

            <div style={{ position: "relative" }}>
              {order.map((key, i) => {
                const b = BUCKETS[key]
                const isDragging = i === dragIndex
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    style={{
                      height: `${ROW_H - 8}px`,
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      background: "#f4f6f8",
                      border: "1px solid #e6e8ea",
                      boxSizing: "border-box",
                      touchAction: "none",
                      userSelect: "none",
                      cursor: "grab",
                      transform: isDragging ? `translateY(${dragOffset}px)` : "none",
                      transition: isDragging ? "none" : "transform 0.12s",
                      boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.18)" : "none",
                      position: "relative",
                      zIndex: isDragging ? 2 : 1,
                      opacity: isDragging ? 0.95 : 1
                    }}
                  >
                    <span style={{ color: "#bbb", fontSize: "17px", lineHeight: 1 }}>≡</span>
                    <span style={{ display: "flex", gap: "6px" }}>
                      <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: b.learned ? LEARNED_COLOR : UNLEARNED_COLOR }} />
                      <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: CONFIDENCE_COLORS[b.conf] }} />
                    </span>
                    <span style={{ fontSize: "14px", color: "#333" }}>{b.label}</span>
                  </div>
                )
              })}
            </div>

            <button
              onClick={closeSortSettings}
              style={{
                width: "100%", marginTop: "8px", padding: "12px 0", borderRadius: "10px",
                border: "none", background: "#02ccbb", color: "white", fontSize: "15px",
                fontWeight: "bold", cursor: "pointer"
              }}
            >
              保存して閉じる
            </button>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}

function confBtnStyle(color) {
  return {
    padding: "12px 0",
    borderRadius: "10px",
    border: "none",
    background: color,
    color: "white",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer"
  }
}
