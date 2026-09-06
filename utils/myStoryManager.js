import { db, auth } from "../firebase"
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"

// めっちゃMy長文の保存管理（Firestore: users/{uid}/myStories/{storyId}）。
// フェーズ1のその場プレイ（sessionStorage）とは別に、明示保存したものを永続化する。
// クライアントSDKで直接読み書き（mofuManager と同じパターン。admin不要）。

// 保存枠の上限
export const MY_STORY_LIMIT = 5

function storiesCol(uid) {
  return collection(db, "users", uid, "myStories")
}

// 保存済み一覧を取得（新しい順）。未ログインなら空配列。
export async function listMyStories() {
  const user = auth.currentUser
  if (!user) return []
  try {
    const snap = await getDocs(storiesCol(user.uid))
    const list = snap.docs.map(d => ({ storyId: d.id, ...d.data() }))
    // createdAt（Firestore Timestamp）で新しい順。未設定は末尾。
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    return list
  } catch (e) {
    console.error("My長文の一覧取得失敗:", e)
    return []
  }
}

// 1件取得（story.jsx の保存版読み込み用）。無ければ null。
export async function getMyStory(storyId) {
  const user = auth.currentUser
  if (!user || !storyId) return null
  try {
    const snap = await getDoc(doc(db, "users", user.uid, "myStories", storyId))
    return snap.exists() ? { storyId: snap.id, ...snap.data() } : null
  } catch (e) {
    console.error("My長文の取得失敗:", e)
    return null
  }
}

// 保存（新規 or 上書き）。sentences は { id, en, ja, answer, chips, audio } の配列。
export async function saveMyStory({ storyId, title, inputLang, sentences }) {
  const user = auth.currentUser
  if (!user) throw new Error("not_signed_in")
  await setDoc(doc(db, "users", user.uid, "myStories", storyId), {
    title: title || "",
    inputLang: inputLang || "en",
    sentences: sentences || [],
    createdAt: serverTimestamp(),
  })
}

// タイトルだけ変更（他のフィールドは維持）
export async function renameMyStory(storyId, title) {
  const user = auth.currentUser
  if (!user || !storyId) return
  await setDoc(doc(db, "users", user.uid, "myStories", storyId), { title: title || "" }, { merge: true })
}

// 削除
export async function deleteMyStory(storyId) {
  const user = auth.currentUser
  if (!user || !storyId) return
  try {
    await deleteDoc(doc(db, "users", user.uid, "myStories", storyId))
  } catch (e) {
    console.error("My長文の削除失敗:", e)
  }
}
