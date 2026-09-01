export default function WordPopup({ entry, onClose }) {
  if (!entry) return null

  return (
    <>
      {/* 背景オーバーレイ：タップで閉じる */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
        }}
        onClick={onClose}
      />
      {/* ポップアップ本体 */}
      <div style={{
        position: "fixed",
        bottom: "120px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        border: "2px solid #a9b8e7",
        borderRadius: "16px",
        padding: "16px 24px",
        zIndex: 201,
        textAlign: "center",
        minWidth: "200px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
      }}>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>{entry.word}</div>
        <div style={{ fontSize: "16px", color: "#666", marginTop: "6px" }}>{entry.ja}</div>
      </div>
    </>
  )
}