import { useRouter } from "next/router";
import { auth, db } from "../firebase";
import { doc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function DeleteAccount() {
  const router = useRouter();

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 0. セキュリティのため再認証（時間経過による requires-recent-login を回避）
      //    先に再認証しておくことで「Firestoreだけ消えてAuthが残る」中途半端な状態を防ぐ
      await reauthenticateWithPopup(user, new GoogleAuthProvider());

      const uid = user.uid;

      // 1. Firestoreのサブコレクションを削除（親ドキュメントを消しても残るため）
      const subCollections = [
        "progress", "history", "vocab_rounds",
        "vocab_progress", "vocab_history",
        "vocab_section_state", "arrange_word_status",
        "streak", "badges",
        "completedUnits", "items", "unlocked",
      ];
      await Promise.all(
        subCollections.map(async (colName) => {
          const ref = collection(db, "users", uid, colName);
          const snap = await getDocs(ref);
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        })
      );

      // 2. Firestoreのユーザードキュメントを削除
      await deleteDoc(doc(db, "users", uid));

      // 3. Authのユーザーを削除
      await deleteUser(user);

      // 4. 完了ページへ
      router.push("/delete-success");
    } catch (error) {
      console.error(error);
      // ユーザーが再認証ポップアップを閉じただけの場合は何もしない
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        return;
      }
      alert("エラーが発生しました。再ログインしてから試してください（セキュリティの関係で、ログインから時間がたっていると削除できないことがあります。）");
    }
  };

  return (
    <div className="container" style={{ 
      maxWidth: "400px", 
      margin: "0 auto", 
      minHeight: "100vh", 
      position: "relative",
      backgroundColor: "#fff" 
    }}>
      <div className="mainContent" style={{ 
        textAlign: "center", 
        padding: "50px 20px" 
      }}>
        <h2>本当に削除しますか？</h2>
        <p>アカウントを削除すると、これまでの学習記録も削除されます。</p>
        
        <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "15px" }}>
          <button 
            onClick={() => router.back()}
            style={{ padding: "15px", borderRadius: "10px", border: "none", background: "#333333", cursor: "pointer" }}
          >
            やっぱアカウント削除しないで戻る
          </button>
          
          <button 
            onClick={handleDelete}
            style={{ padding: "15px", borderRadius: "10px", border: "none", background: "#333333", color: "white", cursor: "pointer" }}
          >
            アカウント削除する
          </button>
        </div>
      </div>

    </div>
  );
}