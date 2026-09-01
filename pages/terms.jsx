import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import { auth } from "../firebase";
import { useState, useEffect } from "react";


export default function Terms() {

  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user)
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="container">
      <div className="mainContent">
        <div className="header">
          <button className="backBtn" onClick={() => router.back()}>←</button>
          <h2>規約とポリシー</h2>
        </div>


        <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#333", marginTop: "50px", padding: "0 10px" }}>
          <h3 style={{ 
            fontSize: "16px", 
            borderBottom: "1px solid #eee", 
            paddingBottom: "5px",
            textAlign: "center"
          }}>
            利用規約
          </h3>
          <p>最終更新日：2026年5月</p>
          <p>本規約は、ミエリカ・ワークス（以下「当方」）が提供する英語学習アプリ（以下「本サービス」）の利用条件を定めるものです。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第1条（サービス内容）</h3>
          <p>本サービスは、英語学習を支援するアプリです。</p>
          <p>学習負荷を下げ、直感的に英語感覚を身につけることを目的としています。</p>
          <p>なお、本サービスはベータ版であり、コンテンツは未完成です。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第2条（利用条件）</h3>
          <p>年齢制限はありません。</p>
          <p>ただし、13歳未満のお子様は、保護者の同意のもとご利用ください。</p>
          <p>ユーザーは本規約に同意の上、本サービスを利用するものとします。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第3条（コンテンツについて）</h3>
          <p>本サービスのコンテンツは、AI（ChatGPT、Gemini、Claude等）を活用して作成されています。</p>
          <p>そのため、内容に誤りが含まれる可能性があります。</p>
          <p>当方は、内容の正確性・完全性を保証しません。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第4条（知的財産権）</h3>
          <p>本サービスに含まれる文章・画像・コンテンツの著作権は、ミエリカ・ワークスに帰属します。</p>
          <p>無断転載・複製を禁止します。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第5条（サービスの変更・停止）</h3>
          <p>当方は、予告なく本サービスの内容を変更・追加・削除することがあります。</p>
          <p>また、サービスを停止する場合は、原則としてアプリ上で1か月前に告知します。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第6条（免責事項）</h3>
          <p>当方は、以下について一切の責任を負いません。</p>
          <p>・本サービスの利用による学習成果</p>
          <p>・バグ、不具合による影響</p>
          <p>・データの消失・損失</p>
          <p>・その他、本サービスに関連して生じた損害</p>
          <p>個人開発のため、修正対応には限界があることをご理解ください。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第7条（広告）</h3>
          <p>本サービスでは、今後広告（Google AdMob等）が表示される場合があります。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第8条（準拠法）</h3>
          <p>本規約は日本法に準拠します。</p>

        </div>

        <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#333", marginTop: "70px", padding: "0 10px" }}>
          <h3 style={{ 
            fontSize: "16px", 
            borderBottom: "1px solid #eee", 
            paddingBottom: "5px",
            textAlign: "center"
          }}>
            プライバシーポリシー
          </h3>
          <p>最終更新日：2026年5月</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>第1条（収集する情報）</h3>
          <p>本サービスでは以下の情報を取得します。</p>
          <p>・Googleアカウント情報（ログイン時）</p>
          <p>・学習履歴・利用データ</p>        
          
          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第2条（利用目的）</h3>
          <p>取得した情報は以下の目的で使用します。</p>
          <p>・学習記録の保存・表示</p>
          <p>・サービス改善</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第3条（データ管理）</h3>
          <p>データはFirebaseにより管理されます。</p>
          <p>当方は、適切な方法で情報の保護に努めます。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第4条（第三者サービス）</h3>
          <p>本サービスでは、以下の第三者サービスを利用しています。</p>
          <p>・Firebase（Google LLC）</p>
          <p>・Googleログイン</p>
          <p>・Google AdSense（広告配信）</p>
          <p>これらのサービスにおけるデータの取り扱いについては、以下をご確認ください。</p>
          <p>https://policies.google.com/privacy</p>
          <p>https://policies.google.com/terms</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第5条（広告について）</h3>
          <p>本サービスでは、Google AdSenseによる広告配信を行っています。</p>
          <p>本サービスは未成年（13歳未満を含む）の利用も想定しているため、Google AdSenseに対し「子供向け取り扱いタグ」を設定しています。これにより、パーソナライズ広告は配信されず、ユーザーの興味・関心に基づくターゲティング広告は表示されません。</p>
          <p>広告配信に関する詳細は以下をご確認ください。</p>
          <p>https://policies.google.com/technologies/ads</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第6条（第三者提供）</h3>
          <p>取得した情報は、本サービスの提供目的以外では使用しません。</p>
          <p>第三者への提供は行いません（法令に基づく場合を除く）。</p>

          <h3 style={{ fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }}>第7条（お問い合わせ）</h3>
          <p>本サービスに関するお問い合わせは、以下のメールアドレスまでご連絡ください。</p>
          <p>mierika.works@gmail.com</p>
          <p>個人運営のため、ご返信にお時間をいただく場合があります。あらかじめご了承ください。</p>          
        </div>

      </div>
      {isLoggedIn && <Navigation />}  {/* ★ ログイン時のみ表示 */}
    </div>
  );
}