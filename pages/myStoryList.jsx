import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import Navigation from "../components/Navigation"
import { listMyStories, deleteMyStory, MY_STORY_LIMIT } from "../utils/myStoryManager"

// めっちゃMy長文の一覧画面。
// 保存済み（Firestore users/{uid}/myStories）を読み込んで表示。保存枠は MY_STORY_LIMIT 件。
export default function MyStoryList() {
  const router = useRouter()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // 削除確認中の story

  async function refresh() {
    setLoading(true)
    const list = await listMyStories()
    setStories(list)
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const atLimit = stories.length >= MY_STORY_LIMIT

  // 「新しい長文を作る」: 上限に達していたら注意モーダル、そうでなければフォームへ
  function handleCreate() {
    if (atLimit) {
      setShowLimitModal(true)
      return
    }
    router.push("/myStoryForm")
  }

  async function handleDelete(storyId) {
    await deleteMyStory(storyId)
    setConfirmDelete(null)
    await refresh()
  }

  return (
    <div className="lessonList" style={{ paddingBottom: "80px" }}>
      <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => router.push("/categoryList")}
          style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
        >
          ◀
        </button>
        {stories.length > 0 && (
          <button
            onClick={() => setEditMode(v => !v)}
            style={{ background: "none", border: "none", fontSize: "14px", fontWeight: "bold", color: editMode ? "#e8963c" : "#888", cursor: "pointer" }}
          >
            {editMode ? "完了" : "編集"}
          </button>
        )}
      </div>

      <div className="lessonHeader" onClick={() => router.push("/categoryList")} data-sound>
        <img src="/images/illustrations/unitlist_button.png" className="unitCardBg" />
        <div className="lessonHeaderContent">
          <h1>My</h1>
          <p>めっちゃMy長文</p>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <button
          onClick={handleCreate}
          data-sound
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "999px",
            border: "none",
            background: "#333333",
            color: "#ffffff",
            fontSize: "17px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ＋ 新しい長文を作る
        </button>
        <div style={{ textAlign: "right", fontSize: "12px", color: atLimit ? "#d9534f" : "#999", marginTop: "8px" }}>
          保存 {stories.length} / {MY_STORY_LIMIT} 件
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: "#aaa", fontSize: "14px" }}>読み込み中…</div>
      ) : stories.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: "#888888", fontSize: "14px", lineHeight: 1.7 }}>
          自分だけの長文で並べ替え問題を作ってみよう！<br />
          上のボタンから、英語または日本語の文章を入力してね。
        </div>
      ) : (
        stories.map((s) => (
          <div className="lessonRow" key={s.storyId}>
            <div
              className="lessonIcon"
              style={{ backgroundColor: "#e8963c" }}
              onClick={() => !editMode && router.push(`/story?source=my&id=${s.storyId}`)}
              data-sound
            >
              <img src="/images/icons/practice_icon.png" className="iconImage" />
            </div>
            <div className="lessonInfo" onClick={() => !editMode && router.push(`/story?source=my&id=${s.storyId}`)}>
              <div className="lessonName">{s.title || "無題の長文"}</div>
            </div>
            {editMode && (
              <button
                onClick={() => setConfirmDelete(s)}
                style={{
                  marginLeft: "auto", marginRight: "16px", background: "none", border: "none",
                  fontSize: "20px", cursor: "pointer",
                }}
                aria-label="削除"
              >
                🗑
              </button>
            )}
          </div>
        ))
      )}

      {/* 上限時の注意モーダル（新規作成を押したとき） */}
      {showLimitModal && (
        <div
          onClick={() => setShowLimitModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px 20px", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px" }}>
              すでに長文の保存上限（{MY_STORY_LIMIT}件）に達しています。<br />
              新しく作って保存すると、今ある長文のどれかに上書きされます。
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowLimitModal(false)}
                style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "1px solid #ccc", background: "#fff", color: "#666", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                やめる
              </button>
              <button
                onClick={() => router.push("/myStoryForm")}
                style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "#333333", color: "#fff", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                作りにいく
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px 20px", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px" }}>
              「{confirmDelete.title || "無題の長文"}」を削除しますか？
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "1px solid #ccc", background: "#fff", color: "#666", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                やめる
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.storyId)}
                style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "#d9534f", color: "#fff", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
