import { useRouter } from "next/router";
import Navigation from "../components/Navigation"; // パスが正しいか確認！

export default function Help() {
  const router = useRouter();

  const faqs = [
    { q: "開発者は何者？", a: "開発者（中の人）は、みなさんと同じ英語学習中の一般人です。英語の専門家ではないので、ChatGPTとかGemini、ClaudeなどのAIに助けてもらいながら、このアプリを制作しています。" },
    { q: "データが消えた！", a: "開発者（中の人）は、アプリ構築やシステム関連の専門家でもありませんので、ChatGPTとかGemini、ClaudeなどのAIを使用してアプリを構築しています。不慮のアクシデントでデータが消えることもあるかもしれませんが、開発者の未熟さ故対応できない可能性もあります。本当にすみません。" },
    { q: "バグが発生した", a: "まだお問い合わせ窓口ができていないので、すみませんがしばらくお待ちください。お問い合わせ窓口ができたら、可能な限り対応します！" },
    { q: "英検に対応してる？", a: "英検や中学の英語にはあまり対応していません。でも、英語に触れる機会を設けているので、英検勉強の足しにはなると思います。" },
    { q: "このアプリをやっても全然成績伸びない！", a: "学習効果には個人差があり、効果を保証することはできません。" },
    { q: "解説が間違ってるんだけど…", a: "できるだけ正しい情報提供に努めていますが、個人開発のため限界はあります。このアプリを使用するかしないかはご自身でご判断ください。また、明らかな誤植の場合は、お問い合わせ窓口設置後、ご報告いただけますと幸いです。" },
    { q: "お金はかかりますか？", a: "ベータ版公開中は無料でご利用いただけます。今後料金をいただく可能性がございます。" },
    { q: "内容すくないなぁ", a: "現在ベータ版として公開中です。未完成ですので、今後コンテンツが増える予定です。" },
  ];

  return (
    <div className="container">
      <div className="mainContent">
        <div className="header">
          {/* backBtnのスタイルが未定義なら style={{cursor: "pointer"}} とか付けておいてな */}
          <button className="backBtn" onClick={() => router.back()}>←</button>
          <h2>ヘルプ</h2>
        </div>
        <div className="helpList" style={{ marginTop: "20px" }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ marginBottom: "20px", padding: "15px", background: "#f9f9f9", borderRadius: "8px" }}>
              <p style={{ fontWeight: "bold", color: "#FF9F43", margin: 0 }}>Q. {f.q}</p>
              <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: "1.5" }}>A. {f.a}</p>
            </div>
          ))}
        </div>
      </div>
      <Navigation />
    </div>
  );
}