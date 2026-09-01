import { useRouter } from "next/router";
import { auth, db } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";

export default function DeleteAccount() {
  const router = useRouter();

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 1. Firestoreのユーザーデータを削除
      await deleteDoc(doc(db, "users", user.uid));
      
      // 2. Authのユーザーを削除
      await deleteUser(user);

      // 3. 完了ページへ
      router.push("/delete-success");
    } catch (error) {
      console.error(error);
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