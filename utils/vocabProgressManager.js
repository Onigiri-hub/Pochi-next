import { db, auth } from "../firebase"
import {
  doc, getDoc, setDoc, collection, addDoc, serverTimestamp,
  getDocs, query, where
} from "firebase/firestore"

// ログインが確定するまで待つ関数
export function waitForUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

// ラウンドの「できた」進捗をFirestoreに保存
export async function saveVocabRoundProgress(roundId, doneWords, totalWords) {
  const user = auth.currentUser
  if (!user) return

  try {
    const roundRef = doc(db, "users", user.uid, "vocab_rounds", roundId)
    const snap = await getDoc(roundRef)
    const existing = snap.exists() ? (snap.data().doneWords || []) : []

    // 既存のできたとマージ（一度できたらずっとできた）
    const merged = [...new Set([...existing, ...doneWords])]

    await setDoc(roundRef, {
      doneWords: merged,
      totalWords: totalWords
    })

    // localStorageも同期
    localStorage.setItem(`vocab_round_${roundId}`, JSON.stringify({
      doneWords: merged,
      totalWords: totalWords
    }))

  } catch (e) {
    console.error("vocab_round保存失敗:", e)
  }
}

// 習熟度をFirestoreに保存
export async function saveVocabMastery(section, modeKey, masteryMap) {
  const user = auth.currentUser
  if (!user) return

  try {
    // 単語ごとにvocab_progressに保存
    await Promise.all(
      Object.entries(masteryMap).map(([wordId, data]) => {
        const progressRef = doc(db, "users", user.uid, "vocab_progress", wordId)
        return setDoc(progressRef, {
          section_id: section,
          [modeKey]: data,
          lastStudied: data.lastStudied || new Date().toISOString()
        }, { merge: true })
      })
    )

    // localStorageも同期
    localStorage.setItem(
      `vocab_mastery_${section}_${modeKey}`,
      JSON.stringify(masteryMap)
    )

  } catch (e) {
    console.error("vocab_mastery保存失敗:", e)
  }
}

// ラウンドの「できた」進捗をFirestoreから取得
export async function getVocabRoundProgress(roundId) {
  const user = await waitForUser()  // ログイン待ち

  // 未ログインはlocalStorageにフォールバック
  if (!user) {
    const local = localStorage.getItem(`vocab_round_${roundId}`)
    return local ? JSON.parse(local) : { doneWords: [], totalWords: 0 }
  }

  try {
    const roundRef = doc(db, "users", user.uid, "vocab_rounds", roundId)
    const snap = await getDoc(roundRef)

    if (snap.exists()) {
      const data = snap.data()
      // localStorageも同期
      localStorage.setItem(`vocab_round_${roundId}`, JSON.stringify(data))
      return data
    }
    return { doneWords: [], totalWords: 0 }

  } catch (e) {
    console.error("vocab_round取得失敗:", e)
    const local = localStorage.getItem(`vocab_round_${roundId}`)
    return local ? JSON.parse(local) : { doneWords: [], totalWords: 0 }
  }
}

// 習熟度をFirestoreから取得（getDocs で1回にまとめる）
export async function getVocabMastery(section, modeKey) {
  const user = await waitForUser()  // ログイン待ち

  // console.log("getVocabMastery呼ばれた:", section, modeKey, "user:", user?.uid)

  // 未ログインはlocalStorageにフォールバック
  if (!user) {
    const local = localStorage.getItem(`vocab_mastery_${section}_${modeKey}`)
    return local ? JSON.parse(local) : {}
  }

  try {
    // localStorageにキャッシュがあればそれを使う
    const local = localStorage.getItem(`vocab_mastery_${section}_${modeKey}`)
    // console.log("localStorageの中身:", local)
    if (local) return JSON.parse(local)

    // localStorageになければFirestoreから一括取得
    // console.log("Firestoreから取得します")
    const q = query(
      collection(db, "users", user.uid, "vocab_progress"),
      where("section_id", "==", section)
    )
    const snap = await getDocs(q)
    // console.log("Firestoreから取得できたドキュメント数:", snap.size)

    // {word_id: {mode1: {...}, mode2: {...}, ...}} の形に整形
    const masteryMap = {}
    snap.forEach(docSnap => {
      const data = docSnap.data()
      if (data[modeKey]) {
        masteryMap[docSnap.id] = data[modeKey]
      }
    })
    // console.log("整形後のmasteryMap:", masteryMap)

    // localStorageにキャッシュとして保存
    localStorage.setItem(
      `vocab_mastery_${section}_${modeKey}`,
      JSON.stringify(masteryMap)
    )

    return masteryMap

  } catch (e) {
    console.error("vocab_mastery取得失敗:", e)
    const local = localStorage.getItem(`vocab_mastery_${section}_${modeKey}`)
    return local ? JSON.parse(local) : {}
  }
}

// ===== 並べ替え単語の履修・自信度ステータス =====
// 保存先: users/{uid}/arrange_word_status/{stage}
//   = { va0001: { learned: true, confidence: "none"|"low"|"high" }, ... }

// ステータスを取得（一覧表示用）
export async function getArrangeWordStatus(stage) {
  const user = await waitForUser()
  const key = `arrange_word_status_${stage}`

  if (!user) {
    const local = localStorage.getItem(key)
    return local ? JSON.parse(local) : {}
  }

  try {
    const local = localStorage.getItem(key)
    if (local) return JSON.parse(local)

    const ref = doc(db, "users", user.uid, "arrange_word_status", stage)
    const snap = await getDoc(ref)
    const data = snap.exists() ? snap.data() : {}
    localStorage.setItem(key, JSON.stringify(data))
    return data

  } catch (e) {
    console.error("arrange_word_status取得失敗:", e)
    const local = localStorage.getItem(key)
    return local ? JSON.parse(local) : {}
  }
}

// 右●：自信度をユーザー入力で保存
export async function saveArrangeWordConfidence(stage, wordId, confidence) {
  const key = `arrange_word_status_${stage}`

  // localStorageを先に更新（learnedは保持）
  const local = localStorage.getItem(key)
  const current = local ? JSON.parse(local) : {}
  current[wordId] = { ...(current[wordId] || { learned: false }), confidence }
  localStorage.setItem(key, JSON.stringify(current))

  const user = auth.currentUser
  if (!user) return current

  try {
    const ref = doc(db, "users", user.uid, "arrange_word_status", stage)
    await setDoc(ref, { [wordId]: current[wordId] }, { merge: true })
  } catch (e) {
    console.error("arrange_word_confidence保存失敗:", e)
  }
  return current
}

// 左●：単語ベース出題を一度でもやったら履修にする（例文データ完成後に呼ぶ）
export async function markArrangeWordLearned(stage, wordId) {
  const key = `arrange_word_status_${stage}`

  const local = localStorage.getItem(key)
  const current = local ? JSON.parse(local) : {}
  if (current[wordId]?.learned) return current  // 既に履修済みなら何もしない
  current[wordId] = { confidence: "none", ...(current[wordId] || {}), learned: true }
  localStorage.setItem(key, JSON.stringify(current))

  const user = auth.currentUser
  if (!user) return current

  try {
    const ref = doc(db, "users", user.uid, "arrange_word_status", stage)
    await setDoc(ref, { [wordId]: current[wordId] }, { merge: true })
  } catch (e) {
    console.error("arrange_word_learned保存失敗:", e)
  }
  return current
}

// Round終了時にhistoryに記録（グラフ用）
export async function addVocabHistory(roundId, sectionId) {
  const user = auth.currentUser
  if (!user) return

  try {
    await addDoc(collection(db, "users", user.uid, "vocab_history"), {
      round_id: roundId,
      section_id: sectionId,
      clearedAt: serverTimestamp(),
      dateString: new Date().toLocaleDateString("sv-SE")
    })
  } catch (e) {
    console.error("vocab_history保存失敗:", e)
  }
}

// 並べて英単語（単語ベース・ラウンド制なし）の完了をvocab_historyに記録
// グラフでは英単語（青緑）としてカウントされる
export async function addArrangeWordHistory(stageId) {
  const user = auth.currentUser
  if (!user) return

  try {
    await addDoc(collection(db, "users", user.uid, "vocab_history"), {
      stage_id: stageId,
      mode: "arrangeWord",
      clearedAt: serverTimestamp(),
      dateString: new Date().toLocaleDateString("sv-SE")
    })
  } catch (e) {
    console.error("arrange_word_history保存失敗:", e)
  }
}
