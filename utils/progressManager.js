import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Firestoreから進捗を取得（未ログインはlocalStorageにフォールバック）
export async function getProgress(unit) {
  const key = `progress_u${unit}`;

  const user = auth.currentUser;
  if (!user) return Number(localStorage.getItem(key) || 0);

  try {
    const snap = await getDoc(doc(db, "users", user.uid, "progress", `u${unit}`));
    const value = snap.exists() ? (snap.data().value || 0) : 0;
    localStorage.setItem(key, value);
    return value;
  } catch (e) {
    console.error("進捗の取得に失敗:", e);
    return Number(localStorage.getItem(key) || 0);
  }
}

// Firestoreの現在値を取得して+1して保存（競合しない）
// ★ 戻り値：{ isFirstClear: boolean }
export async function saveProgress(unit, clearedOrder) {
  const user = auth.currentUser;
  if (!user) return { isFirstClear: false };

  try {
    const progressRef = doc(db, "users", user.uid, "progress", `u${unit}`);
    const snap = await getDoc(progressRef);
    const current = snap.exists() ? (snap.data().value || 0) : 0;

    // ★ クリアしたorderが現在のprogress以上 = 初クリア
    const isFirstClear = clearedOrder >= current;

    if (isFirstClear) {
      const newValue = clearedOrder + 1;
      await setDoc(progressRef, { value: newValue });
      localStorage.setItem(`progress_u${unit}`, newValue);
    }

    // 新しいレッスンでも復習でも毎回記録する
    await addDoc(collection(db, "users", user.uid, "history"), {
      unit_NO: String(unit),
      lesson_NO: String(clearedOrder),
      clearedAt: serverTimestamp(),
      dateString: new Date().toLocaleDateString("sv-SE"),
    });

    return { isFirstClear };

  } catch (e) {
    console.error("進捗の保存に失敗:", e);
    return { isFirstClear: false };
  }
}
