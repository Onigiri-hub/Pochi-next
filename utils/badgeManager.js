import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import Papa from "papaparse";

// ===================================
// csvからバッジ一覧を読み込む
// ===================================
export async function loadBadgeList() {
  const res = await fetch("/data/badgeList.csv")
  const text = await res.text()
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  }).data
}

// ===================================
// 獲得済みバッジをFirestoreから取得
// ===================================
export async function getBadges() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const snap = await getDoc(doc(db, "users", user.uid, "badges", "earned"));
    if (!snap.exists()) return [];
    return snap.data().list || [];
  } catch (e) {
    console.error("バッジ取得失敗:", e);
    return [];
  }
}


// ===================================
// バッジ条件チェック（クリア画面で呼ぶ）
// 戻り値：新しく獲得したbadge_idの配列
// ===================================
export async function checkAndEarnBadges({
  streak = 0,
  totalLessons = 0,
  totalRounds = 0,
  completedStages = [],
  isPerfect = false,
}) {
  const user = auth.currentUser;
  if (!user) return [];

  const earned = await getBadges();
  const newBadges = [];

  const check = (id, condition) => {
    if (condition && !earned.includes(id)) {
      newBadges.push(id);
    }
  };

  // 長文レッスン系
  await check("first_clear", totalLessons >= 1);
  await check("lesson_5", totalLessons >= 5);
  await check("lesson_10", totalLessons >= 10);
  await check("lesson_50", totalLessons >= 50);
  await check("lesson_100", totalLessons >= 100);
  await check("lesson_200", totalLessons >= 200);
  await check("lesson_250", totalLessons >= 250);
  await check("lesson_300", totalLessons >= 300);

  // 連続学習系
  await check("streak_3", streak >= 3);
  await check("streak_7", streak >= 7);
  await check("streak_10", streak >= 10);
  await check("streak_30", streak >= 30);
  await check("streak_50", streak >= 50);
  await check("streak_100", streak >= 100);
  await check("streak_200", streak >= 200);
  await check("streak_365", streak >= 365);

  // Stage完了系
  for (const stageId of completedStages) {
    await check(`${stageId}_clear`, true);
  }

  // 英単語Round系
  await check("round_5", totalRounds >= 5);
  await check("round_10", totalRounds >= 10);
  await check("round_20", totalRounds >= 20);
  await check("round_30", totalRounds >= 30);
  await check("round_50", totalRounds >= 50);
  await check("round_100", totalRounds >= 100);
  await check("round_200", totalRounds >= 200);
  await check("round_500", totalRounds >= 500);

  // 新しいバッジがあれば1回だけ書き込む
  if (newBadges.length > 0) {
    try {
      const ref = doc(db, "users", user.uid, "badges", "earned");
      await setDoc(ref, { list: [...earned, ...newBadges] });
    } catch (e) {
      console.error("バッジ保存失敗:", e);
    }
  }

  return newBadges;
}
