// pages/index.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState("loading"); // "loading" | "animation" | "welcome"

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setPhase("animation");
        setTimeout(() => {
          router.push("/home");
        }, 3000);
      } else {
        setPhase("welcome");
      }
    });

    return () => unsubscribe();
  }, []);

  //const handleGoogleLogin = async () => {
  //  const provider = new GoogleAuthProvider();
  //  await signInWithPopup(auth, provider);
  //  // ログイン成功 → onAuthStateChangedが発火してアニメーション→UnitListへ
  //};

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("ログイン失敗:", error);
    }
  };
  // ログイン済み：アニメーション画面
  

  if (phase === "animation") {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#ebebeb"
      }}>
        <video
          src="/animations/startup.mp4"
          autoPlay
          muted
          playsInline
          style={{ width: "300px" }}
        />
      </div>
    );
  }  


  // 未ログイン：ウェルカム画面
  if (phase === "welcome") {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#fff",
        padding: "60px 24px",
        boxSizing: "border-box"
      }}>

        {/* タイトル */}
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
          Pochiへようこそ！
        </h1>

        {/* 画像（お好みの画像パスに変えてね） */}
        <img
          src="/images/illustrations/pochi.png"
          alt="Pochi"
          style={{ width: "120px", margin: "24px 0" }}
        />

        {/* Googleログインボタン */}
        <button
          onClick={handleGoogleLogin}
          style={{
            backgroundColor: "#333333",
            color: "#fff",
            padding: "14px 28px",
            border: "none",
            borderRadius: "25px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "48px"
          }}
        >
          Googleアカウントではじめる
        </button>

        {/* Pochiとは？ */}
        <div style={{
          maxWidth: "360px",
          width: "100%",
          backgroundColor: "#f8f8f8",
          borderRadius: "16px",
          padding: "24px",
          boxSizing: "border-box"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>
            Pochiとは？
          </h2>
          <p style={{ fontSize: "15px", lineHeight: "1.8", color: "#444", margin: 0 }}>
            ぽちぽちするだけで英語の感覚を身につけるアプリです。<br />
            英語初学者の負荷を下げて、英語を「わかる！」「つかってみたい！」にすることを目指して作りました。<br /><br />
            今のところベータ版で一部公開中。全部無料でお楽しみいただけます！
          </p>
          <img
            src="/images/illustrations/index-introduction.png"
            alt="アプリ紹介"
            style={{
              width: "100%",
              borderRadius: "12px",
              marginTop: "16px"
            }}
          />

        </div>
        
        {/* リンク */}
        <div style={{ marginTop: "32px", fontSize: "13px", color: "#888", textAlign: "center" }}>
          <span
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={() => router.push("/terms")}
          >
            利用規約とプライバシーポリシー
          </span>
        </div>

      </div>
    );
  }

  // loading中は何も表示しない（ちらつき防止）
  return null;
}