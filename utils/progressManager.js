import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// 進捗は story_id（"s001" など）単位で管理する。CSV の order 列（並び順専用）には依存しない。
// 旧データを story_id 文字列へ変換:
//   旧A: { cleared: [1, 3, ...] }（order番号）→ "s001", "s003"
//   旧B(watermark): { value: N } → "s001".."sNNN" を既学習とみなす
//   新:  { cleared: ["s001", "s003", ...] } はそのまま
function toStoryId(v) {
  if (typeof v === "string" && v.startsWith("s")) return v; // 新スキーマ
  const n = Number(v);
  return n > 0 ? `s${String(n).padStart(3, "0")}` : null;   // 旧order番号を変換
}

function readClearedSet(snap) {
  if (!snap.exists()) return new Set();
  const data = snap.data();
  if (Array.isArray(data.cleared)) {
    return new Set(data.cleared.map(toStoryId).filter(Boolean));
  }
  const value = Number(data.value) || 0;
  const set = new Set();
  for (let i = 1; i <= value; i++) set.add(`s${String(i).padStart(3, "0")}`);
  return set;
}

// カテゴリのクリア済み story_id 集合を返す（未ログインはlocalStorageにフォールバック）
export async function getClearedStories(unit) {
  const key = `cleared_u${unit}`;
  const user = auth.currentUser;

  const fromLocal = () => {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw).map(toStoryId).filter(Boolean) : []);
  };

  if (!user) return fromLocal();

  try {
    const snap = await getDoc(doc(db, "users", user.uid, "progress", `u${unit}`));
    const set = readClearedSet(snap);
    localStorage.setItem(key, JSON.stringify([...set]));
    return set;
  } catch (e) {
    console.error("進捗の取得に失敗:", e);
    return fromLocal();
  }
}

// カテゴリのクリア済みストーリー数を返す（categoryList の X/Y 表示用）
export async function getProgress(unit) {
  return (await getClearedStories(unit)).size;
}

// ストーリークリアを保存。ストーリーは任意の順で読めるので story_id 単位で記録する。
// ★ 戻り値：{ isFirstClear: boolean }（そのストーリーを初めてクリアしたか）
export async function saveProgress(unit, clearedStoryId) {
  const user = auth.currentUser;
  if (!user) return { isFirstClear: false };

  const storyId = String(clearedStoryId);

  try {
    const progressRef = doc(db, "users", user.uid, "progress", `u${unit}`);
    const snap = await getDoc(progressRef);
    const cleared = readClearedSet(snap);

    // ★ まだクリアしていないストーリー = 初クリア
    const isFirstClear = !cleared.has(storyId);

    if (isFirstClear) {
      cleared.add(storyId);
      await setDoc(progressRef, { cleared: [...cleared] }, { merge: true });
      localStorage.setItem(`cleared_u${unit}`, JSON.stringify([...cleared]));
    }

    // 新しいストーリーでも復習でも毎回記録する
    await addDoc(collection(db, "users", user.uid, "history"), {
      unit_NO: String(unit),
      lesson_NO: storyId,
      clearedAt: serverTimestamp(),
      dateString: new Date().toLocaleDateString("sv-SE"),
    });

    return { isFirstClear };

  } catch (e) {
    console.error("進捗の保存に失敗:", e);
    return { isFirstClear: false };
  }
}
