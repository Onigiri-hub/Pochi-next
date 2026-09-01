// pages/login.js
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // 成功したら index.js に戻してイラストを見せる
      router.push("/"); 
    } catch (error) {
      console.error("ログイン失敗:", error);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Pochi</h1>
      <button onClick={handleGoogleLogin}>Googleでログイン</button>
    </div>
  );
}