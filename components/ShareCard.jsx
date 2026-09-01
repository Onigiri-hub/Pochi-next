import { useEffect, useRef } from "react"
import { useProfileContext } from "../utils/ProfileContext"

const BG_PATHS = {
  1: "/images/illustrations/share_bg1.png",
  2: "/images/illustrations/share_bg2.png",
}
const FOOTER_PATH = "/images/illustrations/share_footer.png"

export default function ShareCard({ bgIndex, bgHue, bgSat, textLightness, showName, comment, cardRef }) {
  const { profile } = useProfileContext()
  const canvasRef = useRef(null)
  const commentRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.src = BG_PATHS[bgIndex]
    img.onload = () => {
      ctx.clearRect(0, 0, 1080, 1080)
      ctx.filter = bgHue !== 0 || bgSat !== 100
        ? `hue-rotate(${bgHue}deg) saturate(${bgSat}%)`
        : "none"
      ctx.drawImage(img, 0, 0, 1080, 1080)
      ctx.filter = "none"
    }
  }, [bgIndex, bgHue, bgSat])

  // コメント文字数に応じてフォントサイズを自動縮小
  useEffect(() => {
    const el = commentRef.current
    if (!el) return
    let size = 76
    el.style.fontSize = size + "px"
    while (el.scrollHeight > el.clientHeight && size > 32) {
      size -= 2
      el.style.fontSize = size + "px"
    }
  }, [comment])

  const textColor = `hsl(0, 0%, ${textLightness}%)`

  return (
    <div
      ref={cardRef}
      style={{
        width: "1080px",
        height: "1080px",
        position: "relative",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* 背景 canvas（色相/彩度を焼き込み） */}
      <canvas
        ref={canvasRef}
        width={1080}
        height={1080}
        style={{ position: "absolute", inset: 0, width: "1080px", height: "1080px" }}
      />

      {/* コメント文（M PLUS Rounded 1c） */}
      <div
        ref={commentRef}
        style={{
          position: "absolute",
          left: "60px",
          right: "60px",
          top: "150px",
          height: "390px",
          overflow: "hidden",
          textAlign: "center",
          fontWeight: 800,
          fontSize: "76px",
          lineHeight: 1.35,
          color: textColor,
          whiteSpace: "pre-wrap",
          fontFamily: "var(--font-mplus)",
          letterSpacing: "1px",
        }}
      >
        {comment}
      </div>

      {/* アバター（レイヤー：avatar → 目元 → 口元 → 頭） */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "552px",
        transform: "translateX(-50%)",
        width: "380px",
        height: "380px",
      }}>
        <img
          src={`/images/avatars/${profile?.avatar || "01.png"}`}
          alt="avatar"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
        {profile?.acc_eye && (
          <img
            src={`/images/avatars/${profile.acc_eye}`}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
        )}
        {profile?.acc_mouth && (
          <img
            src={`/images/avatars/${profile.acc_mouth}`}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
        )}
        {profile?.acc_head && (
          <img
            src={`/images/avatars/${profile.acc_head}`}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
        )}
      </div>

      {/* フッター画像（最前面オーバーレイ） */}
      <img
        src={FOOTER_PATH}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "1080px",
          height: "1080px",
          pointerEvents: "none",
        }}
      />

      {/* ユーザー名（白固定） */}
      {showName && profile?.nickname && (
        <div style={{
          position: "absolute",
          right: "40px",
          bottom: "16px",
          fontSize: "40px",
          fontWeight: 700,
          color: "#ffffff",
          fontFamily: "var(--font-mplus)",
        }}>
          {profile.nickname}
        </div>
      )}

    </div>
  )
}
