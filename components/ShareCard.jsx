import { useEffect, useRef } from "react"
import { useProfileContext } from "../utils/ProfileContext"

const BG_PATHS = {
  1: "/images/illustrations/share_bg1.png",
  2: "/images/illustrations/share_bg2.png",
}
const FOOTER_PATH = "/images/illustrations/share_footer.png"

// CSS filter「hue-rotate(deg) saturate(%)」相当の色変換をピクセル配列へ直接適用する。
// iOS Safari は canvas の ctx.filter を未対応のため、その代替（プレビュー＝書き出しを一致させる）。
// W3C Filter Effects のカラーマトリクスに基づき、適用順は hue-rotate → saturate。
function applyHueSat(data, hueDeg, satPct) {
  const a = (hueDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const s = satPct / 100

  // hue-rotate 行列
  const h = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ]
  // saturate 行列
  const sm = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ]
  // 合成 M = saturate · hue-rotate
  const m = new Array(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      m[r * 3 + c] = sm[r * 3] * h[c] + sm[r * 3 + 1] * h[3 + c] + sm[r * 3 + 2] * h[6 + c]
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const R = data[i], G = data[i + 1], B = data[i + 2]
    const nr = m[0] * R + m[1] * G + m[2] * B
    const ng = m[3] * R + m[4] * G + m[5] * B
    const nb = m[6] * R + m[7] * G + m[8] * B
    data[i]     = nr < 0 ? 0 : nr > 255 ? 255 : nr
    data[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng
    data[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb
  }
}

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
      ctx.drawImage(img, 0, 0, 1080, 1080)
      // iOS Safari は ctx.filter 非対応のため、ピクセル演算で色相・彩度を焼き込む。
      if (bgHue !== 0 || bgSat !== 100) {
        const imageData = ctx.getImageData(0, 0, 1080, 1080)
        applyHueSat(imageData.data, bgHue, bgSat)
        ctx.putImageData(imageData, 0, 0)
      }
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
