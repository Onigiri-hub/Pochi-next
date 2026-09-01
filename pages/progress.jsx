// pages/progress.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useProfileContext } from "../utils/ProfileContext"
import Navigation from "../components/Navigation";
import ShareModal from "../components/ShareModal";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { getBadges, loadBadgeList } from "../utils/badgeManager";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BADGE_CATEGORIES = [
  {
    label: "連続記録",
    ids: ["streak_3", "streak_7", "streak_10", "streak_30", "streak_50", "streak_100", "streak_200", "streak_365"],
  },
  {
    label: "長文レッスン",
    ids: ["first_clear", "lesson_5", "lesson_10", "lesson_50", "lesson_100", "lesson_200", "lesson_250", "lesson_300"],
  },
  {
    label: "英単語レッスン",
    ids: ["round_5", "round_10", "round_20", "round_30", "round_50", "round_100", "round_200", "round_500"],
  },
]

export default function Progress() {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [vocabHistoryData, setVocabHistoryData] = useState([])
  const [earnedBadges, setEarnedBadges] = useState([])
  const [badgeList, setBadgeList] = useState([])
  const [startDate, setStartDate] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const router = useRouter();
  const { profile, streak } = useProfileContext()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) return;

      const userRef = doc(db, "users", u.uid)

      // 1. userドキュメントを取得してstartDateをチェック
      const userSnap = await getDoc(userRef)
      const userData = userSnap.exists() ? userSnap.data() : {}
      let userStartDate = userData.startDate || null

      let hSnap, vocabSnap

      if (userStartDate) {
        // startDateあり → 直近30日だけ取得
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const cutoff = thirtyDaysAgo.toLocaleDateString("sv-SE")

        ;[hSnap, vocabSnap, , , ] = await Promise.all([
          getDocs(query(
            collection(db, "users", u.uid, "history"),
            where("dateString", ">=", cutoff),
            orderBy("dateString", "desc")
          )),
          getDocs(query(
            collection(db, "users", u.uid, "vocab_history"),
            where("dateString", ">=", cutoff),
            orderBy("dateString", "desc")
          )),
        ])
      } else {
        // startDateなし → 全件取得して最古日を保存（マイグレーション）
        ;[hSnap, vocabSnap] = await Promise.all([
          getDocs(query(collection(db, "users", u.uid, "history"), orderBy("clearedAt", "desc"))),
          getDocs(query(collection(db, "users", u.uid, "vocab_history"), orderBy("clearedAt", "desc"))),
        ])

        // 最古日を計算
        const allHistory = [...hSnap.docs.map(d => d.data()), ...vocabSnap.docs.map(d => d.data())]
        if (allHistory.length > 0) {
          const oldest = allHistory.reduce((acc, h) =>
            h.dateString < acc ? h.dateString : acc
          , allHistory[0].dateString)
          userStartDate = oldest
        } else {
          // 履歴ゼロなら今日をstartDateに
          userStartDate = new Date().toLocaleDateString("sv-SE")
        }

        // Firestoreに保存（次回以降は直近30日だけで済む）
        await setDoc(userRef, { startDate: userStartDate }, { merge: true })
      }

      setStartDate(userStartDate)

      // 2. バッジ取得
      const [earnedBadgesData, badgeListData] = await Promise.all([
        getBadges(),
        loadBadgeList(),
      ])

      setHistoryData(hSnap.docs.map(d => d.data()));
      setVocabHistoryData(vocabSnap.docs.map(d => d.data()));
      setEarnedBadges(earnedBadgesData);
      setBadgeList(badgeListData);

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const getGraphData = () => {
    const days = []
    const grammarCounts = []
    const vocabCounts = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const s = d.toLocaleDateString('sv-SE')
      days.push(d.toLocaleDateString('ja-JP', { weekday: 'short' }))

      const grammarCount = historyData.filter(h => h.dateString === s).length
      const vocabCount = vocabHistoryData.filter(h => h.dateString === s).length
      grammarCounts.push(grammarCount)
      vocabCounts.push(vocabCount)
    }

    return {
      labels: days,
      datasets: [
        {
          label: "長文",
          data: grammarCounts,
          backgroundColor: "#FF9F43",
          borderRadius: 5,
        },
        {
          label: "英単語",
          data: vocabCounts,
          backgroundColor: "#02ccbb",
          borderRadius: 5,
        },
      ],
    }
  }

  if (loading) return null;

  return (
    <div className="container">
      <div className="mainContent">
        <div className="header" style={{ justifyContent: "flex-end" }}>
          <button className="settingsBtn" onClick={() => router.push("/settings")}>
            <img src="/images/icons/settings-333.svg" alt="設定" />
          </button>
        </div>

        <div className="profileSection">

          <h2 className="nickname">{profile ? profile.nickname : ""}</h2>

          <div className="avatarCircle" style={{ position: "relative", cursor: "pointer" }} onClick={() => router.push("/avatar-settings")}>
            {/* レイヤー1: アバター（ベース） */}
            <img
              src={`/images/avatars/${profile?.avatar || "01.png"}`}
              alt="Avatar"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
            {/* レイヤー2: 目元アクセサリ */}
            {profile?.acc_eye && (
              <img
                src={`/images/avatars/${profile.acc_eye}`}
                alt="eye"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
            {/* レイヤー3: 口元アクセサリ */}
            {profile?.acc_mouth && (
              <img
                src={`/images/avatars/${profile.acc_mouth}`}
                alt="mouth"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
            {/* レイヤー4: 頭アクセサリ（最前面） */}
            {profile?.acc_head && (
              <img
                src={`/images/avatars/${profile.acc_head}`}
                alt="head"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
          </div>

          <div style={{ width: "100%", textAlign: "right" }}>
            <button
              onClick={() => router.push("/avatar-settings")}
              style={{
                background: "none",
                border: "none",
                fontSize: "13px",
                color: "#6f70a7",
                fontWeight: "bold",
                cursor: "pointer",
                padding: "4px 0",
                marginTop: "8px",
              }}
            >
              ▶ アバターを変更する
            </button>
          </div>
        </div>

        <div className="statsGrid">
          <div className="statItem">
            <span className="statLabel">学習開始</span>
            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              {startDate
                ? `${startDate.slice(0, 4)}年${Number(startDate.slice(5, 7))}月`
                : "-"
              }
            </span>
          </div>
          <div className="statItem">
            <span className="statLabel">連続記録</span>
            <span className="statValue">{streak}日</span>
          </div>
        </div>

        {/* グラフエリア */}
        <div className="graphContainer"
          style={{
            background: "#f8f8f8",
            padding: "10px",
            borderRadius: "10px",
            marginTop: "20px",
            height: "200px"
          }}>
          <Bar
            data={getGraphData()}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true, position: "bottom" }
              },
              scales: {
                x: {
                  stacked: true,
                  grid: { display: false },
                },
                y: {
                  stacked: true,
                  display: true,
                  grid: { display: false },
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1,
                    callback: (value) => {
                      if (Math.floor(value) === value) return value
                    }
                  }
                }
              }
            }}
          />
        </div>

        {/* バッジ一覧（カテゴリ別） */}
        <div style={{ marginTop: "50px" }}>
          <h3 style={{ fontSize: "16px", color: "#666", marginBottom: "20px" }}>
            実績バッジ
          </h3>
          {BADGE_CATEGORIES.map(category => {
            // 獲得済み + 次の1個だけ表示
            const visible = []
            let nextShown = false
            for (const id of category.ids) {
              if (earnedBadges.includes(id)) {
                visible.push({ id, earned: true })
              } else if (!nextShown) {
                visible.push({ id, earned: false })
                nextShown = true
              } else {
                break
              }
            }
            if (visible.length === 0) return null
            return (
              <div key={category.label} style={{ marginBottom: "32px" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#888", marginBottom: "12px" }}>
                  {category.label}
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}>
                  {visible.map(({ id, earned }) => {
                    const badge = badgeList.find(b => b.badge_id === id)
                    if (!badge) return null
                    return (
                      <div
                        key={id}
                        onClick={earned ? () => setShareTarget(badge) : undefined}
                        style={{
                          textAlign: "center",
                          opacity: earned ? 1 : 0.35,
                          cursor: earned ? "pointer" : "default",
                        }}
                        title={earned ? `${badge.name}（タップしてシェア）` : badge.description}
                      >
                        <img
                          src={earned
                            ? `/images/badges/${badge.image_earned}`
                            : `/images/badges/${badge.image_locked}`
                          }
                          alt={badge.name}
                          style={{
                            width: "70%",
                            aspectRatio: "1",
                            objectFit: "contain",
                            borderRadius: "12px",
                          }}
                        />
                        <div style={{
                          fontSize: "10px",
                          color: "#555",
                          marginTop: "4px",
                          lineHeight: 1.2,
                        }}>
                          {badge.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>


      </div>
      <Navigation />

      {shareTarget && (
        <ShareModal
          badge={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
