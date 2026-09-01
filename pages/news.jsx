import { useRouter } from "next/router";
import Navigation from "../components/Navigation";

const newsItems = [
  {
    date: "2026-09-01",
    title: "Pochi-NEXT β版を公開しました",
    body: "Pochi-NEXTアプリをリリースしました。Pochi（本家）よりもハイレベルな英単語と、長文読解を扱っていきます。",
  },
];

export default function News() {
  const router = useRouter();

  return (
    <div className="container">
      <div className="mainContent">
        <div className="header">
          <button className="backBtn" onClick={() => router.back()}>←</button>
          <h2>お知らせ</h2>
        </div>
        <div style={{ marginTop: "20px" }}>
          {newsItems.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa", marginTop: "40px" }}>
              現在お知らせはありません
            </p>
          ) : (
            newsItems.map((item, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                }}
              >
                <p style={{ fontSize: "12px", color: "#aaa", margin: "0 0 6px" }}>
                  {item.date}
                </p>
                <p style={{ fontWeight: "bold", color: "#FF9F43", margin: "0 0 8px" }}>
                  {item.title}
                </p>
                {item.body && (
                  <p style={{ fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                    {item.body}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <Navigation />
    </div>
  );
}
