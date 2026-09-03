import { useState, useRef, useEffect } from "react"
import ShareCard from "./ShareCard"

export default function ShareModal({ badge, onClose }) {
  const [bgIndex, setBgIndex] = useState(1)
  const [bgHue, setBgHue] = useState(0)
  const [bgSat, setBgSat] = useState(100)
  const [textLightness, setTextLightness] = useState(0)
  const [showName, setShowName] = useState(true)
  const [toast, setToast] = useState(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const cardRef = useRef(null)
  const stageRef = useRef(null)
  const scaleWrapperRef = useRef(null)
  const [stageWidth, setStageWidth] = useState(340)

  const comment = badge?.share_text || badge?.description || badge?.name || ""

  useEffect(() => {
    if (!stageRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width)
    })
    ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])

  const scale = stageWidth / 1080

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  async function captureCard() {
    const { default: html2canvas } = await import("html2canvas")
    await document.fonts.ready

    // キャプチャ中はスケールを解除して原寸1080×1080でキャプチャ
    const stage = stageRef.current
    const wrapper = scaleWrapperRef.current
    stage.style.overflow = "visible"
    stage.style.width = "1080px"
    stage.style.height = "1080px"
    wrapper.style.transform = "none"

    const canvas = await html2canvas(cardRef.current, {
      width: 1080,
      height: 1080,
      scale: 1,
      backgroundColor: null,
      useCORS: true,
    })

    // 元に戻す
    wrapper.style.transform = `scale(${scale})`
    stage.style.overflow = "hidden"
    stage.style.width = ""
    stage.style.height = ""

    return canvas
  }

  async function handleShare() {
    if (isCapturing) return
    setIsCapturing(true)
    try {
      const cv = await captureCard()
      await new Promise((resolve, reject) => {
        cv.toBlob(async (blob) => {
          try {
            const file = new File([blob], "pochi_share.png", { type: "image/png" })
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], text: "Pochi英語で勉強中！ #Pochi英語" })
            } else {
              const a = document.createElement("a")
              a.download = "pochi_share.png"
              a.href = cv.toDataURL("image/png")
              a.click()
              showToast("この端末は直接シェア非対応。画像を保存したよ！")
            }
            resolve()
          } catch (e) {
            // シェアキャンセルは無視
            resolve()
          }
        }, "image/png")
      })
    } catch (e) {
      showToast("エラーが発生しました")
    } finally {
      setIsCapturing(false)
    }
  }

  function handleCancel() {
    showToast("実績バッジからいつでもシェアできるよ🐾")
    setTimeout(() => onClose(), 1600)
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      overflowY: "auto",
      paddingBottom: "80px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "24px 16px 0",
      }}>
        {/* タイトル */}
        <h2 style={{
          margin: 0,
          fontSize: "20px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "0.5px",
        }}>
          実績をシェアする
        </h2>

        {/* プレビュー（縮小表示） */}
        <div
          ref={stageRef}
          style={{
            width: "min(88vw, 460px)",
            aspectRatio: "1/1",
            overflow: "hidden",
            borderRadius: "20px",
            boxShadow: "0 6px 24px rgba(0,0,0,.25)",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <div ref={scaleWrapperRef} style={{
            width: "1080px",
            height: "1080px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}>
            <ShareCard
              bgIndex={bgIndex}
              bgHue={bgHue}
              bgSat={bgSat}
              textLightness={textLightness}
              showName={showName}
              comment={comment}
              cardRef={cardRef}
            />
          </div>
        </div>

        {/* コントロールパネル */}
        <div style={{
          width: "min(88vw, 460px)",
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: "18px",
          padding: "18px 26px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,.08)",
        }}>
          {/* 背景選択 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6560" }}>背景をえらぶ</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {[{ val: 1, label: "ガーランド" }, { val: 2, label: "夜空" }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setBgIndex(val)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: bgIndex === val ? "2px solid #f4a6c0" : "2px solid #e6e2da",
                    borderRadius: "12px",
                    background: bgIndex === val ? "#fdeef4" : "#faf9f6",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: bgIndex === val ? "#b64d77" : "#6b6560",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 色あいスライダー */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6560" }}>背景の色あい</span>
            <input
              type="range"
              min={0}
              max={360}
              value={bgHue}
              onChange={e => setBgHue(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#f4a6c0" }}
            />
            <div style={{
              width: "100%",
              height: "14px",
              borderRadius: "7px",
              background: "linear-gradient(90deg,#f66,#fd6,#6f6,#6ff,#66f,#f6f,#f66)",
            }} />
          </div>

          {/* あざやかさスライダー */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6560" }}>背景のあざやかさ</span>
            <input
              type="range"
              min={0}
              max={200}
              value={bgSat}
              onChange={e => setBgSat(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#f4a6c0" }}
            />
          </div>

          {/* 文字明るさスライダー */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6560" }}>文字の明るさ（左：黒 〜 右：白）</span>
            <input
              type="range"
              min={0}
              max={100}
              value={textLightness}
              onChange={e => setTextLightness(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#f4a6c0" }}
            />
          </div>

          {/* ユーザー名 トグル */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6560" }}>ユーザー名を表示</span>
            <label style={{ position: "relative", width: "52px", height: "30px", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={showName}
                onChange={e => setShowName(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute",
                inset: 0,
                background: showName ? "#f4a6c0" : "#e6e2da",
                borderRadius: "15px",
                transition: ".2s",
                cursor: "pointer",
              }}>
                <span style={{
                  position: "absolute",
                  width: "24px",
                  height: "24px",
                  left: showName ? "25px" : "3px",
                  top: "3px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: ".2s",
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* ボタン */}
        <div style={{
          width: "min(88vw, 460px)",
          display: "flex",
          gap: "10px",
        }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1,
              padding: "14px",
              border: "none",
              borderRadius: "14px",
              background: "#ece8e1",
              color: "#7a746c",
              fontWeight: 800,
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleShare}
            disabled={isCapturing}
            style={{
              flex: 2,
              padding: "14px",
              border: "none",
              borderRadius: "14px",
              background: isCapturing ? "#e6c6d4" : "#f4a6c0",
              color: "#fff",
              fontWeight: 800,
              fontSize: "15px",
              cursor: isCapturing ? "not-allowed" : "pointer",
            }}
          >
            {isCapturing ? "生成中..." : "シェアする"}
          </button>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "90px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(50,50,50,0.9)",
          color: "#fff",
          borderRadius: "16px",
          padding: "12px 20px",
          fontSize: "14px",
          fontWeight: 500,
          whiteSpace: "nowrap",
          zIndex: 300,
          maxWidth: "90vw",
          textAlign: "center",
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
