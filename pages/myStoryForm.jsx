import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { auth } from "../firebase"
import Navigation from "../components/Navigation"
import { DIFFICULTY_LEVELS, TONE_LEVELS, DEFAULT_DIFFICULTY, DEFAULT_TONE } from "../lib/difficulty"
import { preloadVoices, warmUpSpeech } from "../utils/ttsPlayer"

// 入力言語とモードのズレを判定する（送信時の確認モーダル用）。
// 返り値: "ja"（英語モードに日本語が混入）/ "en"（日本語モードに英語優勢）/ null（問題なし）。
//   - 英語モード: 日本語が1文字でもあれば警告（英文に和字は基本ありえない）
//   - 日本語モード: 英語が優勢（英字数 > 日本語文字数）なら警告
function langWarning(text, inputLang) {
  const t = text || ""
  const ja = (t.match(/[぀-ゟ゠-ヿ一-鿿]/g) || []).length // かな・カナ・漢字
  const en = (t.match(/[A-Za-z]/g) || []).length
  if (inputLang === "en" && ja >= 1) return "ja"
  if (inputLang === "ja" && en > 0 && en > ja) return "en"
  return null
}
// モーダルの本文（warn の種類ごと）
const WARN_MESSAGE = {
  ja: "英語入力モードに日本語が入力されているようです。このまま続けますか？",
  en: "日本語入力モードに英語が入力されているようです。このまま続けますか？",
}

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
  const [showLangModal, setShowLangModal] = useState(false)

  // マウント時に声リストを事前ロード（再生時のもたつき防止）
  useEffect(() => { preloadVoices() }, [])

  // 無料版の上限（表示用）。将来はプランに応じて出し分ける。
  const limit = inputLang === "en" ? { unit: "語", max: 50 } : { unit: "字", max: 200 }
  const count = inputLang === "en"
    ? (text.trim() ? text.trim().split(/\s+/).length : 0)
    : text.trim().length
  const over = count > limit.max
  // 入力言語とモードのズレ（送信時に確認モーダルを出す）
  const langWarn = langWarning(text, inputLang)

  // 3択ボタン（セグメント）の共通スタイル
  const segStyle = (active) => ({
    flex: 1, padding: "9px 4px", borderRadius: "10px", cursor: "pointer", fontSize: "13px",
    border: active ? "2px solid #e8963c" : "1px solid #ccc",
    background: active ? "#fff6ec" : "#fff",
    color: "#333", fontWeight: "bold",
  })

  // 送信ボタン: 入力言語のズレがあれば確認モーダルを挟む。無ければそのまま生成。
  function submit() {
    if (!text.trim() || loading || over) return
    if (langWarn) {
      setShowLangModal(true)
      return
    }
    runGenerate()
  }

  // 実際の生成処理（モーダルで「このまま続ける」を押したときもここへ）
  async function runGenerate() {
    if (!text.trim() || loading || over) return
    // ユーザー操作中に音声エンジンを起こしておく（await より前＝iOSのジェスチャ要件を満たす）。
    // 生成完了→/story 遷移後、最初のタップで即再生できる。
    warmUpSpeech()
    setShowLangModal(false)
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

  // 生成中スクリーン（API待ちの間フル画面。この間に音声エンジンも温まる）
  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#ebebeb",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px",
      }}>
        <video
          src="/animations/pochi-tokotoko.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "220px" }}
        />
        <div style={{ fontSize: "17px", fontWeight: "bold", color: "#8a5a1a" }}>生成中…</div>
        <div style={{ fontSize: "13px", color: "#999" }}>並べ替え問題と音声を準備しています</div>
      </div>
    )
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

        {/* 語彙・文法レベル */}
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>英語のレベル</div>
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
              ◎ 初学者おすすめ。「カジュアル」はスラングや省略が入るぶん、少し難しめです。
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: "#d9534f", fontSize: "14px", textAlign: "center" }}>{error}</div>
        )}

        {/* AI利用・入力内容に関する注意 */}
        <div style={{ fontSize: "12px", color: "#999", lineHeight: 1.6, background: "#f7f7f7", borderRadius: "8px", padding: "10px 12px" }}>
          この機能はAIで翻訳・問題生成を行います。入力内容はAIサービスに送信され、サービス改善に利用される場合があります。個人情報や見られたくない文章、法令・公序良俗に反する内容は入力しないでください。生成結果について当サービスは責任を負いません。
        </div>

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

      {/* 入力言語ズレの確認モーダル（送信時の抑止） */}
      {showLangModal && (
        <div
          onClick={() => setShowLangModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "16px", padding: "24px 20px",
              maxWidth: "340px", width: "100%", textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px" }}>
              {WARN_MESSAGE[langWarn]}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowLangModal(false)}
                style={{
                  flex: 1, padding: "13px", borderRadius: "12px", border: "1px solid #ccc",
                  background: "#fff", color: "#666", fontWeight: "bold", fontSize: "15px", cursor: "pointer",
                }}
              >
                戻る
              </button>
              <button
                onClick={runGenerate}
                style={{
                  flex: 1, padding: "13px", borderRadius: "12px", border: "none",
                  background: "#e8963c", color: "#fff", fontWeight: "bold", fontSize: "15px", cursor: "pointer",
                }}
              >
                このまま続ける
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
