// 認証・プラン確定のサーバーサイド共通処理。
// ★フェーズ2で firebase-admin を導入したら、この関数内でIDトークンを検証して
//   実際の uid / plan を返すように差し替える。呼び出し側（API Route）は無改修。
//
// 現状（フェーズ1・ベータ）: firebase-admin 未導入のため、検証はスタブ。
//   Authorization ヘッダの有無に関わらず free プランの仮ユーザーを返す。

export async function verifyUser(req) {
  // TODO(フェーズ2): firebase-admin で検証
  //   const admin = getAdmin()
  //   const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "")
  //   const decoded = await admin.auth().verifyIdToken(token)
  //   const uid = decoded.uid
  //   const snap = await admin.firestore().doc(`users/${uid}`).get()
  //   const plan = snap.data()?.plan || "free"
  //   return { uid, plan }

  return { uid: null, plan: "free" }
}

// プランごとの上限値（設計書0-1）。サーバー側の検証で使う。
export const PLAN_LIMITS = {
  free:    { storyPerDay: 1, enWords: 50,  jaChars: 200, chatTurns: 3  },
  basic:   { storyPerDay: 1, enWords: 200, jaChars: 200, chatTurns: 10 },
  premium: { storyPerDay: 1, enWords: 200, jaChars: 200, chatTurns: 30 },
}
