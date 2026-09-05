import { useRouter } from "next/router"
import Navigation from "../components/Navigation";

// めっちゃMy長文の一覧画面。
// フェーズ1（ベータ・無料版）: 保存機能が無いため一覧は空。「作る」ボタンからその場プレイへ。
// フェーズ2（有料版）: Firestore users/{uid}/myStories を読み込んで一覧表示する（保存枠5件）。
export default function MyStoryList() {
  const router = useRouter()

  // TODO(フェーズ2): premium/basic は Firestore から保存済み長文を取得して stories にセット
  const stories = []

  return (
    <div className="lessonList" style={{ paddingBottom: "80px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button
          onClick={() => router.push("/categoryList")}
          style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
        >
          ◀
        </button>
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
          onClick={() => router.push("/myStoryForm")}
          data-sound
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#e8963c",
            color: "#ffffff",
            fontSize: "17px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ＋ 新しい長文を作る
        </button>
      </div>

      {stories.length === 0 ? (
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
              onClick={() => router.push(`/story?source=my&id=${s.storyId}`)}
              data-sound
            >
              <img src="/images/icons/practice_icon.png" className="iconImage" />
            </div>
            <div className="lessonInfo">
              <div className="lessonName">{s.title || "無題の長文"}</div>
            </div>
          </div>
        ))
      )}

      <Navigation />
    </div>
  )
}
