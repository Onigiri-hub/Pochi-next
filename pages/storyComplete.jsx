import { useRouter } from "next/router"
import { saveProgress, checkAndSaveUnitComplete } from "../utils/progressManager"
import { loadCSV } from "../utils/csvLoader"
import { checkAndEarnBadges, loadBadgeList } from "../utils/badgeManager"
import { useEffect, useState } from "react"
import { useProfileContext } from "../utils/ProfileContext"
import Navigation from "../components/Navigation";
import { updateStreak, calcMofu, addMofu, addTotalLessons } from "../utils/mofuManager"
import ShareModal from "../components/ShareModal"

export default function StoryComplete() {
  const router = useRouter()
  const { category, order, isPerfect } = router.query
  const {
    setMofu, setStreak,
    setTotalLessons, totalLessons,
    totalRounds,
    completedUnits, setCompletedUnits
  } = useProfileContext()
  const [newBadges, setNewBadges] = useState([])
  const [mofuEarned, setMofuEarned] = useState(0)
  const [streakCount, setStreakCount] = useState(0)
  const [showStreakPopup, setShowStreakPopup] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [showRest, setShowRest] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)

  useEffect(() => {
    if (!category) return;

    const audio = window._kirakira || new Audio("/sound/kirakira.mp3");
    audio.volume = 0.2;
    audio.currentTime = 0;
    audio.play().catch(e => console.log("音の再生に失敗:", e));

    let cancelled = false;

    async function updateProgress() {
      if (cancelled) return;

      // 1. 進捗保存 → 初クリアかどうかが返ってくる
      const { isFirstClear } = await saveProgress(category, Number(order));

      // 2. 連続日数を更新して取得
      const { count: streak, isFirstToday } = await updateStreak()
      setStreak(streak)

      if (isFirstToday && streak >= 2) {
        setStreakCount(streak)
        setShowStreakPopup(true)
      }

      // 3. モフを計算して加算
      const mofu = calcMofu(streak, isFirstClear);
      await addMofu(mofu);
      if (isFirstClear) {
        await addTotalLessons()
        setTotalLessons(prev => prev + 1)
      }
      setMofuEarned(mofu);
      setMofu(prev => prev + mofu)

      // 4. カテゴリ完了チェック
      const storyList = await loadCSV("/data/story/story_list.csv")
      const stories = storyList.filter(r => r.category_id === String(category))
      const totalStoriesInCategory = stories.length

      const isCategoryComplete = await checkAndSaveUnitComplete(category, totalStoriesInCategory, completedUnits)
      if (isCategoryComplete) {
        setCompletedUnits(prev => new Set([...prev, `u${category}`]))
      }

      // 5. バッジチェック
      const newBadgeIds = await checkAndEarnBadges({
        streak,
        totalLessons: totalLessons + (isFirstClear ? 1 : 0),
        totalRounds,
        isUnitComplete: isCategoryComplete ? String(category) : null,
        isPerfect: isPerfect === "true",
        completedUnitCount: completedUnits.size + (isCategoryComplete ? 1 : 0),
      })

      // 6. IDからバッジオブジェクトに変換
      if (newBadgeIds.length > 0) {
        const badgeList = await loadBadgeList()
        const badgeObjects = newBadgeIds
          .map(id => badgeList.find(b => b.badge_id === id))
          .filter(Boolean)
        setNewBadges(badgeObjects)
        if (!(isFirstToday && streak >= 2)) setShowPopup(true)
      }
    }

    updateProgress();
    return () => { cancelled = true };
  }, [category])

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = "none"
    document.body.style.overscrollBehavior = "none"
    return () => {
      document.documentElement.style.overscrollBehavior = ""
      document.body.style.overscrollBehavior = ""
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowRest(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="completePage" style={{ paddingBottom: "80px" }}>
      <div className="app">
        <div className="completeArea" style={{ flexDirection: "column" }}>
          <video src="/animations/animation-great.mp4" autoPlay muted playsInline style={{ width: "70%" }} />

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
              onClick={() => { setShowStreakPopup(false); if (newBadges.length > 0) setShowPopup(true) }}
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
                onClick={() => { setShowStreakPopup(false); if (newBadges.length > 0) setShowPopup(true) }}
                style={{ padding: "10px 30px", borderRadius: "20px", border: "none", background: "#FF9F43", color: "white", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}
              >
                やった！
              </button>
            </div>
          </>
        )}

        {/* バッジ獲得ポップアップ */}
        {showPopup && newBadges.length > 0 && (
          <>
            <div onClick={() => setShowPopup(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: "white", borderRadius: "20px", padding: "30px 24px", zIndex: 101,
              textAlign: "center", minWidth: "280px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎉</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>バッジ獲得！</div>
              {newBadges.map(badge => (
                <div key={badge.badge_id} style={{ background: "#fffbe6", border: "2px solid #FFD700", borderRadius: "12px", padding: "12px 16px", marginBottom: "10px" }}>
                  <div style={{ fontSize: "32px" }}>{badge.icon}</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold" }}>{badge.name}</div>
                  <div style={{ fontSize: "13px", color: "#888", marginTop: "4px" }}>{badge.description}</div>
                  <button
                    onClick={() => { setShowPopup(false); setShareTarget(badge) }}
                    style={{ marginTop: "10px", padding: "8px 20px", borderRadius: "16px", border: "none", background: "#f4a6c0", color: "#fff", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}
                  >
                    shareする
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowPopup(false)}
                style={{ marginTop: "16px", padding: "10px 30px", borderRadius: "20px", border: "none", background: "#FF9F43", color: "white", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}
              >
                やった！
              </button>
            </div>
          </>
        )}

        {shareTarget && <ShareModal badge={shareTarget} onClose={() => setShareTarget(null)} />}

        {showRest && (
          <div className="bottomArea">
            <div className="completeBottom">
              <button className="finishButton" onClick={() => router.replace(`/storyList?category=${category}`)} data-sound>
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
      <Navigation />
    </div>
  )
}
