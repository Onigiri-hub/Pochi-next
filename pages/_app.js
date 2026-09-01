import Head from "next/head"
import Script from "next/script"
import { Noto_Sans_JP, M_PLUS_Rounded_1c } from "next/font/google"
import "../styles/home.css";
import "../styles/profile.css";
import "../styles/unitList.css";
import "../styles/lecture.css";
import "../styles/lessonList.css";
import "../styles/practice.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { DictionaryContext } from "../utils/DictionaryContext";
import { ProfileContext } from "../utils/ProfileContext";
import { loadCSV } from "../utils/csvLoader";
import { auth } from "../firebase";


const noto = Noto_Sans_JP({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
})

const mplus = M_PLUS_Rounded_1c({
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mplus",
})

const PUBLIC_PAGES = ["/", "/terms"]

export default function MyApp({ Component, pageProps }) {
  const [dictionary, setDictionary] = useState([])
  const [profile, setProfile] = useState(null)
  const [mofu, setMofu] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalLessons, setTotalLessons] = useState(0)
  const [totalRounds, setTotalRounds] = useState(0)
  const [completedUnits, setCompletedUnits] = useState(new Set())
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const dataLoadedRef = useRef(false)
  const router = useRouter()

  // ★ 認証＆データ取得（起動時1回だけ）
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user)
      setAuthChecked(true)

      if (!user) {
        dataLoadedRef.current = false
        return
      }

      if (dataLoadedRef.current) return
      dataLoadedRef.current = true

      const { doc, getDoc, setDoc, collection, getDocs } = await import("firebase/firestore")
      const { db } = await import("../firebase")

      // プロフィール・mofu・streakを一括取得
      const userRef = doc(db, "users", user.uid)
      const [profileSnap, streakSnap, completedUnitsSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(doc(db, "users", user.uid, "streak", "current")),
        getDocs(collection(db, "users", user.uid, "completedUnits")),
      ])

      const completedUnitIds = new Set(completedUnitsSnap.docs.map(d => d.id))
      setCompletedUnits(completedUnitIds)

      // 取得した値をローカル変数に保持（dailyCheckで使う）
      let currentStreak = 0
      let currentTotalLessons = 0
      let currentTotalRounds = 0

      if (profileSnap.exists()) {
        const data = profileSnap.data()
        setProfile(data)
        setMofu(data.mofu || 0)
        setTotalLessons(data.totalLessons || 0)
        setTotalRounds(data.totalRounds || 0)
        currentTotalLessons = data.totalLessons || 0
        currentTotalRounds = data.totalRounds || 0
      } else {
        const defaultProfile = {
          nickname: user.displayName || "ゲスト",
          avatar: "01.png",
          acc_head: null,
          acc_eye: null,
          acc_mouth: null,
          mofu: 0,
          startDate: new Date().toLocaleDateString("sv-SE"),
        }
        await setDoc(userRef, defaultProfile)
        setProfile(defaultProfile)
        setMofu(0)
      }

      // streak取得
      if (streakSnap.exists()) {
        const data = streakSnap.data()
        const today = new Date().toLocaleDateString("sv-SE")
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE")
        if (data.lastDate === today || data.lastDate === yesterday) {
          setStreak(data.count || 0)
          currentStreak = data.count || 0
        } else {
          setStreak(0)
          currentStreak = 0
        }
      }

      // ★ dailyCheck（1日1回だけ、保険として全バッジ再チェック）
      // 開発中はバッジリスト変更で既存ユーザーに条件達成済みバッジが付与されない可能性があるため
      const today = new Date().toLocaleDateString("sv-SE")
      const lastCheck = localStorage.getItem("dailyCheck")
      if (lastCheck === today) return

      try {
        const { checkAndEarnBadges } = await import("../utils/badgeManager")

        const baseParams = {
          streak: currentStreak,
          totalLessons: currentTotalLessons,
          totalRounds: currentTotalRounds,
          isPerfect: false,
          completedUnitCount: completedUnitIds.size,
        }

        if (completedUnitIds.size > 0) {
          // 各Unitコンプリートバッジをチェック
          for (const unitId of completedUnitIds) {
            await checkAndEarnBadges({
              ...baseParams,
              isUnitComplete: unitId.replace("u", ""),
            })
          }
        } else {
          // Unitコンプリートなしでも、streak/lesson/roundバッジはチェック
          await checkAndEarnBadges({
            ...baseParams,
            isUnitComplete: null,
          })
        }

        localStorage.setItem("dailyCheck", today)

      } catch (e) {
        console.error("dailyCheck失敗:", e)
      }
    })
    return () => unsubscribe()
  }, [])

  // ★ ページ遷移ごとに、未ログイン時のリダイレクト判定だけ行う
  useEffect(() => {
    if (!authChecked) return
    if (!currentUser && !PUBLIC_PAGES.includes(router.pathname)) {
      router.push("/")
    }
  }, [router.pathname, authChecked, currentUser])

  // 辞書読み込み＋効果音プリロード
  useEffect(() => {
    async function load() {
      const data = await loadCSV("/data/word_dic.csv")
      setDictionary(data)
    }
    load()

    // kirakira事前読み込み
    const kirakira = new Audio("/sound/kirakira.mp3")
    kirakira.volume = 0.2
    kirakira.load()
    window._kirakira = kirakira

  }, [])

  return (
    <DictionaryContext.Provider value={dictionary}>
      <ProfileContext.Provider value={{ 
        profile, setProfile, 
        mofu, setMofu, 
        streak, setStreak, 
        totalLessons, setTotalLessons,
        totalRounds, setTotalRounds,
        completedUnits, setCompletedUnits,
      }}>

        <Head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#ebebeb" />
          {/* iOSのホーム画面アイコン用 */}
          <link rel="apple-touch-icon" href="/images/icons/icon-192.png" />
        </Head>
        {/* Google AdSense（本番環境のみ） */}
        {process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && (
          <Script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3714576929730992"
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <main className={`${noto.className} ${mplus.variable}`}>
          <Component {...pageProps} />
        </main>
      </ProfileContext.Provider>
    </DictionaryContext.Provider>
  )
}
