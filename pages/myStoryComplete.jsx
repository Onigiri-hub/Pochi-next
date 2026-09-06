import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"
import Navigation from "../components/Navigation"
import { useProfileContext } from "../utils/ProfileContext"
import { updateStreak, addMofu } from "../utils/mofuManager"

// My長文（フェーズ1・その場プレイ）専用の軽量コンプリート画面。
// 本家 storyComplete と違い category/進捗保存/バッジ/totalLessons は扱わず、
// 「モフ +1」と「連続記録(streak)」だけ加算する。ボタンは「一覧へ戻る」のみ。
const MY_STORY_MOFU = 1

export default function MyStoryComplete() {
  const router = useRouter()
  const { setMofu, setStreak } = useProfileContext()
  const [mofuEarned, setMofuEarned] = useState(0)
  const [streakCount, setStreakCount] = useState(0)
  const [showStreakPopup, setShowStreakPopup] = useState(false)
  const [showRest, setShowRest] = useState(false)
  const ranRef = useRef(false)

  // 報酬加算（マウント時に1回だけ）
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const audio = window._kirakira || new Audio("/sound/kirakira.mp3")
    audio.volume = 0.2
    audio.currentTime = 0
    audio.play().catch(() => {})

    ;(async () => {
      // 連続記録を更新
      const { count: streak, isFirstToday } = await updateStreak()
      setStreak(streak)
      if (isFirstToday && streak >= 2) {
        setStreakCount(streak)
        setShowStreakPopup(true)
      }
      // モフ +1
      await addMofu(MY_STORY_MOFU)
      setMofuEarned(MY_STORY_MOFU)
      setMofu(prev => prev + MY_STORY_MOFU)
    })()
  }, [setMofu, setStreak])

  // 引っ張りバウンス抑止（本家 storyComplete と同じ）
  useEffect(() => {
    document.documentElement.style.overscrollBehavior = "none"
    document.body.style.overscrollBehavior = "none"
    return () => {
      document.documentElement.style.overscrollBehavior = ""
      document.body.style.overscrollBehavior = ""
    }
  }, [])

  // 「一覧へ戻る」ボタンを少し遅れて出す
  useEffect(() => {
    const timer = setTimeout(() => setShowRest(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="completePage" style={{ paddingBottom: "80px" }}>
      <div className="app">
        <div className="completeArea" style={{ flexDirection: "column" }}>
          <video src="/animations/animation-great.mp4" autoPlay muted playsInline style={{ width: "70%" }} />

          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#333333", marginTop: "6px" }}>
            コンプリート！
          </div>

          {mofuEarned > 0 && (
            <div style={{
              fontSize: "24px", fontWeight: "bold", color: "#FF9F43", marginTop: "10px",
              animation: "poyon 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards"
            }}>
              +{mofuEarned} モフ獲得！
            </div>
          )}
        </div>

        {/* 連続学習ポップアップ */}
        {showStreakPopup && (
          <>
            <div
              onClick={() => setShowStreakPopup(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }}
            />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: "white", borderRadius: "20px", padding: "30px 24px", zIndex: 101,
              textAlign: "center", minWidth: "280px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>🔥</div>
              <div style={{ fontSize: "22px", fontWeight: "bold", color: "#FF9F43" }}>{streakCount}日連続！</div>
              <div style={{ fontSize: "14px", color: "#888", margin: "8px 0 20px" }}>すごい！頑張ってるね！</div>
              <button
                onClick={() => setShowStreakPopup(false)}
                style={{ padding: "10px 30px", borderRadius: "20px", border: "none", background: "#FF9F43", color: "white", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}
              >
                やった！
              </button>
            </div>
          </>
        )}

        {showRest && (
          <div className="bottomArea">
            <div className="completeBottom">
              <button className="finishButton" onClick={() => router.replace("/myStoryList")} data-sound>
                一覧へ戻る
              </button>
            </div>
          </div>
        )}
      </div>
      <Navigation />
    </div>
  )
}
