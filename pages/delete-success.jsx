import { useRouter } from "next/router";

export default function DeleteSuccess() {
  const router = useRouter();

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
        <h2>ご利用ありがとうございました！</h2>
        <p>アカウントの削除が完了しました。</p>
        <button 
            onClick={() => router.push("/")}
            style={{ marginTop: "30px", padding: "10px 20px", borderRadius: "20px", border: "none", backgroundColor: "#333333" }}
        >
        ログイン画面へ戻る
      </button>
      </div>
      
    </div>
  );
}