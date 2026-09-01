import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, increment } from "firebase/firestore";

// ===================================
// 連続学習日数を取得
// ===================================
export async function getStreak() {
  const user = auth.currentUser;
  if (!user) return 0;

  try {
    const snap = await getDoc(doc(db, "users", user.uid, "streak", "current"));
    if (!snap.exists()) return 0;
    const data = snap.data();

    const today = new Date().toLocaleDateString("sv-SE");
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE");

    // 今日か昨日が最終学習日ならストリーク継続
    if (data.lastDate === today || data.lastDate === yesterday) {
      return data.count || 0;
    }
    // それ以外はストリーク切れ
    return 0;
  } catch (e) {
    console.error("ストリーク取得失敗:", e);
    return 0;
  }
}

// ===================================
// 連続学習日数を更新（1日1回だけカウント）
// 戻り値: { count, isFirstToday }
// ===================================
export async function updateStreak() {
  const user = auth.currentUser;
  if (!user) return { count: 0, isFirstToday: false };

  try {
    const streakRef = doc(db, "users", user.uid, "streak", "current");
    const snap = await getDoc(streakRef);
    const today = new Date().toLocaleDateString("sv-SE");
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE");

    let newCount = 1;

    if (snap.exists()) {
      const data = snap.data();
      if (data.lastDate === today) {
        // 今日すでに更新済み
        return { count: data.count || 0, isFirstToday: false };
      } else if (data.lastDate === yesterday) {
        newCount = (data.count || 0) + 1;
      } else {
        newCount = 1;
      }
    }

    // streak更新
    await setDoc(streakRef, { count: newCount, lastDate: today });

    return { count: newCount, isFirstToday: true };
  } catch (e) {
    console.error("ストリーク更新失敗:", e);
    return { count: 0, isFirstToday: false };
  }
}

// ===================================
// 連続日数からモフ獲得数を計算
// ===================================
export function calcMofu(streak, isFirstClear) {
  // 初クリアの基本モフ
  const baseFirst = 5;
  // 復習の基本モフ
  const baseReview = 1;

  let mofu;

  if (isFirstClear) {
    if (streak >= 15) mofu = 10;
    else if (streak >= 10) mofu = 8;
    else if (streak >= 7) mofu = 7;
    else if (streak >= 3) mofu = 6;
    else mofu = baseFirst;
  } else {
    // 復習は15日以上だけ2モフ、それ以外は1モフ
    mofu = streak >= 15 ? 2 : baseReview;
  }

  return mofu;
}

// ===================================
// モフを加算してFirestoreに保存
// ===================================
export async function addMofu(amount) {
  const user = auth.currentUser;
  if (!user || amount <= 0) return;

  try {
    const ref = doc(db, "users", user.uid);
    await setDoc(ref, { mofu: increment(amount) }, { merge: true });
  } catch (e) {
    console.error("モフ加算失敗:", e);
  }
}

// ===================================
// 現在のモフ数を取得
// ===================================
export async function getMofu() {
  const user = auth.currentUser;
  if (!user) return 0;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? (snap.data().mofu || 0) : 0;
  } catch (e) {
    console.error("モフ取得失敗:", e);
    return 0;
  }
}

export async function addTotalLessons() {
  const user = auth.currentUser
  if (!user) return
  const ref = doc(db, "users", user.uid)
  await setDoc(ref, { totalLessons: increment(1) }, { merge: true })
}

export async function addTotalRounds() {
  const user = auth.currentUser
  if (!user) return
  const ref = doc(db, "users", user.uid)
  await setDoc(ref, { totalRounds: increment(1) }, { merge: true })
}

// ===================================
// モフを消費する
// ===================================
export async function spendMofu(currentMofu, amount) {
  const user = auth.currentUser
  if (!user) return currentMofu

  const newMofu = Math.max(0, currentMofu - amount)
  const userRef = doc(db, "users", user.uid)
  await setDoc(userRef, { mofu: newMofu }, { merge: true })
  return newMofu
}
