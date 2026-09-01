# 指示書：アカウント削除処理の修正（Pochi本家へ横展開）

## 背景
Pochi-next の `pages/delete-account.jsx` にあったアカウント削除処理に、以下の不具合があった。
**Pochi本家（元アプリ）にも同じコードが存在する可能性が高いため、同様の修正が必要。**

## 修正前の問題点

1. **サブコレクションが削除されず、データが残留する（重大）**
   - `deleteDoc(doc(db, "users", uid))` は親ドキュメントしか消さない。
   - Firestore の仕様上、`users/{uid}` 配下のサブコレクション
     （`progress`, `history`, `badges`, `items` など）は親を消しても**残り続ける**。
   - 結果、アカウント削除後も学習記録が孤児データとして Firestore に残る。
     プライバシーポリシー上「学習記録も削除されます」と明記しているため実害あり。

2. **削除順序のリスク**
   - Firestore を先に消してから `deleteUser()` を呼んでおり、
     `deleteUser` が `auth/requires-recent-login` で失敗すると
     **Firestore データだけ消えて Auth アカウントが残る**中途半端な状態になる。

3. **再認証の導線がない**
   - 時間が経過したユーザーは削除できず、alert が出るだけ。

## 修正方針

処理の順序を以下に変更する（`reauthenticateWithPopup` を最初に実行）。

1. **再認証**（`reauthenticateWithPopup(user, new GoogleAuthProvider())`）を最初に行う。
   - これで `requires-recent-login` を回避し、
     「Firestoreだけ消えてAuthが残る」中途半端な状態を根本的に防ぐ。
   - Google ログイン前提。他プロバイダを使っている場合は該当の再認証方法に置き換える。
2. サブコレクションを全削除（本家で使っているコレクション名に合わせること）。
3. 親ドキュメント `users/{uid}` を削除。
4. `deleteUser(user)` で Auth を削除。
5. 完了ページへ遷移。
6. ポップアップを閉じただけ（`auth/popup-closed-by-user` /
   `auth/cancelled-popup-request`）のときは何もしない。

## 参照実装（Pochi-next 修正後）

```js
import { doc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";

const handleDelete = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 0. 再認証
    await reauthenticateWithPopup(user, new GoogleAuthProvider());

    const uid = user.uid;

    // 1. サブコレクション削除
    const subCollections = [
      "progress", "history", "vocab_rounds",
      "vocab_progress", "vocab_history", "streak", "badges",
      "completedUnits", "items", "unlocked",
    ];
    await Promise.all(
      subCollections.map(async (colName) => {
        const ref = collection(db, "users", uid, colName);
        const snap = await getDocs(ref);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      })
    );

    // 2. 親ドキュメント削除
    await deleteDoc(doc(db, "users", uid));

    // 3. Auth 削除
    await deleteUser(user);

    // 4. 完了ページへ
    router.push("/delete-success");
  } catch (error) {
    console.error(error);
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return;
    }
    alert("エラーが発生しました。再ログインしてから試してください（...）");
  }
};
```

## 本家で作業するときのチェックリスト

- [ ] `pages/delete-account.jsx`（本家の該当ファイル）を上記方針で修正
- [ ] `subCollections` の配列を**本家で実際に使っているコレクション名**に合わせる
      （本家は英単語/英文法系のコレクション名が異なる可能性あり。要確認）
- [ ] 認証プロバイダが Google 以外の場合は再認証処理を差し替える
- [ ] `settings.jsx` の「データリセット」も同じ subCollections を使っているか確認し整合を取る
- [ ] 実機で削除→Firestore コンソールでサブコレクションが消えているか確認

## 補足（将来的な改善案）
- サブコレクションのドキュメント数が多い場合、クライアント一括削除は非効率・不完全になりうる。
  本格対応するなら Cloud Functions（`onCall`）や Firebase Extension
  「Delete User Data」でサーバー側削除に寄せるのが望ましい。
