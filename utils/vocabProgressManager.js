import { db, auth } from "../firebase"
import {
  doc, getDoc, setDoc, collection, addDoc, serverTimestamp
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

// ===== 履修フェーズ：セクション状態（クリア済みラウンド＋定着テスト結果） =====
// 保存先: users/{uid}/vocab_section_state/{section_id}
//   = { clearedRounds: {round_id: true, ...}, test: {passed, lastScore, lastTestedAt} }
// セクション単位の1ドキュメントに集約することで、sectionListは1 read/セクションで済む。

// セクション状態を取得（Firestoreを正とする）
export async function getSectionState(sectionId) {
  const user = await waitForUser()
  if (!user) return { clearedRounds: {}, test: null }
  try {
    const ref = doc(db, "users", user.uid, "vocab_section_state", sectionId)
    const snap = await getDoc(ref)
    const data = snap.exists() ? snap.data() : {}
    return { clearedRounds: data.clearedRounds || {}, test: data.test || null }
  } catch (e) {
    console.error("section_state取得失敗:", e)
    return { clearedRounds: {}, test: null }
  }
}

// 履修ラウンドのクリアを記録し、初クリアかどうかを返す（書き込み1回＋履歴1回）
export async function markRoundCleared(sectionId, roundId) {
  const user = await waitForUser()
  if (!user) return false

  let firstClear = true
  try {
    const ref = doc(db, "users", user.uid, "vocab_section_state", sectionId)
    const snap = await getDoc(ref)
    const cleared = snap.exists() ? (snap.data().clearedRounds || {}) : {}
    firstClear = !cleared[roundId]
    await setDoc(ref, { clearedRounds: { [roundId]: true } }, { merge: true })
  } catch (e) {
    console.error("markRoundCleared失敗:", e)
  }

  // グラフ用の履歴（ラウンド終了時に1回だけ）
  await addVocabHistory(roundId, sectionId)
  return firstClear
}

// 定着テストの結果を保存（合否・直近スコア・受験日時）
export async function saveSectionTest(sectionId, passed, lastScore) {
  const user = await waitForUser()
  if (!user) return
  try {
    const ref = doc(db, "users", user.uid, "vocab_section_state", sectionId)
    await setDoc(ref, {
      test: { passed, lastScore, lastTestedAt: serverTimestamp() }
    }, { merge: true })
  } catch (e) {
    console.error("section_test保存失敗:", e)
  }
}

// ===== 並べ替え単語の履修・自信度ステータス =====
// 保存先: users/{uid}/arrange_word_status/{stage}
//   = { va0001: { learned: true, confidence: "none"|"low"|"high" }, ... }

// ステータスを取得（一覧表示用）
export async function getArrangeWordStatus(stage) {
  const user = await waitForUser()
  const key = `arrange_word_status_${stage}`

  // 未ログインはlocalStorageにフォールバック
  if (!user) {
    const local = localStorage.getItem(key)
    return local ? JSON.parse(local) : {}
  }

  try {
    // ログイン中はFirestoreを正として毎回取得（複数端末で同期させるため）
    // ※1 stage = 1ドキュメント（全語をmapで保持）なので読み取りは1回で済む
    const ref = doc(db, "users", user.uid, "arrange_word_status", stage)
    const snap = await getDoc(ref)
    const data = snap.exists() ? snap.data() : {}
    // localStorageはオフライン/エラー時のフォールバック用にキャッシュ
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
