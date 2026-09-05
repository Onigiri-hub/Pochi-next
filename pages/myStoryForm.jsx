import { useState } from "react"
import { useRouter } from "next/router"
import { auth } from "../firebase"
import Navigation from "../components/Navigation"
import { DIFFICULTY_LEVELS, TONE_LEVELS, DEFAULT_DIFFICULTY, DEFAULT_TONE } from "../lib/difficulty"

// めっちゃMy長文の作成フォーム。
// フェーズ1（無料版）: /api/story/generate を叩き、返ってきた sentences を sessionStorage に置いて
//   その場プレイ（/story?source=my）へ遷移する（保存なし）。
export default function MyStoryForm() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [inputLang, setInputLang] = useState("en")
  const [title, setTitle] = useState("")
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [tone, setTone] = useState(DEFAULT_TONE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 無料版の上限（表示用）。将来はプランに応じて出し分ける。
  const limit = inputLang === "en" ? { unit: "語", max: 50 } : { unit: "字", max: 200 }
  const count = inputLang === "en"
    ? (text.trim() ? text.trim().split(/\s+/).length : 0)
    : text.trim().length
  const over = count > limit.max

  // 3択ボタン（セグメント）の共通スタイル
  const segStyle = (active) => ({
    flex: 1, padding: "9px 4px", borderRadius: "10px", cursor: "pointer", fontSize: "13px",
    border: active ? "2px solid #e8963c" : "1px solid #ccc",
    background: active ? "#fff6ec" : "#fff",
    color: "#333", fontWeight: "bold",
  })

  async function submit() {
    if (!text.trim() || loading || over) return
    setLoading(true)
    setError("")
    try {
      // ログイン済みならIDトークンを付与（サーバー側は将来これを検証）
      let headers = { "Content-Type": "application/json" }
      const user = auth.currentUser
      if (user) {
        const token = await user.getIdToken()
        headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch("/api/story/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ text, inputLang, title, difficulty, tone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || "生成に失敗しました。もう一度お試しください。")
        return
      }

      // その場プレイ用に sessionStorage へ保存して story へ遷移
      sessionStorage.setItem(
        `myStory:${data.storyId}`,
        JSON.stringify({ title: data.title, sentences: data.sentences })
      )
      router.push(`/story?source=my&id=${data.storyId}`)
    } catch {
      setError("通信エラーが発生しました。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app" style={{ paddingBottom: "120px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button
          onClick={() => router.push("/myStoryList")}
          style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
        >
          ◀
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: "#333", margin: "6px 0 24px" }}>
        めっちゃMy長文を作る
      </div>

      <div style={{ maxWidth: "420px", margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 言語選択 */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[["en", "英語で入力"], ["ja", "日本語で入力"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setInputLang(val)}
              style={{
                flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer",
                border: inputLang === val ? "2px solid #e8963c" : "1px solid #ccc",
                background: inputLang === val ? "#fff6ec" : "#fff",
                color: "#333", fontWeight: "bold",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 難易度 */}
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>難易度</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {Object.entries(DIFFICULTY_LEVELS).map(([val, def]) => (
              <button key={val} onClick={() => setDifficulty(val)} style={segStyle(difficulty === val)}>
                {def.label}
              </button>
            ))}
          </div>
          {inputLang === "en" && (
            <div style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>
              英語入力では、和訳の言葉づかいに反映されます（英文はそのまま）。
            </div>
          )}
        </div>

        {/* カジュアルさ（英語を生成する日本語入力のときだけ効く） */}
        {inputLang === "ja" && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>話し方（カジュアルさ）</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {Object.entries(TONE_LEVELS).map(([val, def]) => (
                <button key={val} onClick={() => setTone(val)} style={segStyle(tone === val)}>
                  {def.label}{def.recommended ? " ◎" : ""}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>
              ◎ 初学者おすすめ。「くだけた表現」はスラングや省略が入るぶん、少し難しめです。
            </div>
          </div>
        )}

        {/* タイトル（任意） */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル（任意）"
          style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ccc", fontSize: "15px" }}
        />

        {/* 本文 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={inputLang === "en" ? "英語の文章を入力してね" : "日本語の文章を入力してね"}
          rows={7}
          style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ccc", fontSize: "15px", lineHeight: 1.6, resize: "vertical" }}
        />

        {/* カウンター */}
        <div style={{ textAlign: "right", fontSize: "13px", color: over ? "#d9534f" : "#888" }}>
          {count} / {limit.max}{limit.unit}
        </div>

        {error && (
          <div style={{ color: "#d9534f", fontSize: "14px", textAlign: "center" }}>{error}</div>
        )}

        <button
          onClick={submit}
          disabled={!text.trim() || over || loading}
          style={{
            padding: "16px", borderRadius: "14px", border: "none", fontSize: "17px", fontWeight: "bold",
            color: "#fff",
            background: (!text.trim() || over || loading) ? "#ccc" : "#e8963c",
            cursor: (!text.trim() || over || loading) ? "default" : "pointer",
          }}
        >
          {loading ? "作成中…" : "並べ替え問題を作る"}
        </button>
      </div>

      <Navigation />
    </div>
  )
}
