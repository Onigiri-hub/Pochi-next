import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// 進捗ドキュメントからクリア済みストーリーorderの集合を作る。
// 新スキーマ: { cleared: [1, 3, ...] } / 旧スキーマ(watermark): { value: N } → 1..N を既学習とみなす
function readClearedSet(snap) {
  if (!snap.exists()) return new Set();
  const data = snap.data();
  if (Array.isArray(data.cleared)) return new Set(data.cleared.map(Number));
  const value = Number(data.value) || 0;
  const set = new Set();
  for (let i = 1; i <= value; i++) set.add(i);
  return set;
}

// カテゴリのクリア済みストーリーorder集合を返す（未ログインはlocalStorageにフォールバック）
export async function getClearedOrders(unit) {
  const key = `cleared_u${unit}`;
  const user = auth.currentUser;

  if (!user) {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw).map(Number) : []);
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid, "progress", `u${unit}`));
    const set = readClearedSet(snap);
    localStorage.setItem(key, JSON.stringify([...set]));
    return set;
  } catch (e) {
    console.error("進捗の取得に失敗:", e);
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw).map(Number) : []);
  }
}

// カテゴリのクリア済みストーリー数を返す（categoryList の X/Y 表示用）
export async function getProgress(unit) {
  return (await getClearedOrders(unit)).size;
}

// ストーリークリアを保存。ストーリーは任意の順で読めるので order 単位で記録する。
// ★ 戻り値：{ isFirstClear: boolean }（そのストーリーを初めてクリアしたか）
export async function saveProgress(unit, clearedOrder) {
  const user = auth.currentUser;
  if (!user) return { isFirstClear: false };

  const order = Number(clearedOrder);

  try {
    const progressRef = doc(db, "users", user.uid, "progress", `u${unit}`);
    const snap = await getDoc(progressRef);
    const cleared = readClearedSet(snap);

    // ★ まだクリアしていないストーリー = 初クリア
    const isFirstClear = !cleared.has(order);

    if (isFirstClear) {
      cleared.add(order);
      await setDoc(progressRef, { cleared: [...cleared] }, { merge: true });
      localStorage.setItem(`cleared_u${unit}`, JSON.stringify([...cleared]));
    }

    // 新しいストーリーでも復習でも毎回記録する
    await addDoc(collection(db, "users", user.uid, "history"), {
      unit_NO: String(unit),
      lesson_NO: String(order),
      clearedAt: serverTimestamp(),
      dateString: new Date().toLocaleDateString("sv-SE"),
    });

    return { isFirstClear };

  } catch (e) {
    console.error("進捗の保存に失敗:", e);
    return { isFirstClear: false };
  }
}
