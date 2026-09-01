import { useRouter } from "next/router";
import { useProfileContext } from "../utils/ProfileContext";

export default function Navigation() {
  const router = useRouter();
  const { mofu } = useProfileContext();

  const handleHomeClick = () => {
    router.push("/home");
  };

  return (
    <div className="navOuter">
      <div className="navInner">
        <button onClick={handleHomeClick} className="navItem" data-sound>
          <img src="/images/icons/home.svg" alt="ホーム" />
          <span className="label">HOME</span>
        </button>

        <button onClick={() => router.push("/categoryList")} className="navItem" data-sound>
          <img src="/images/icons/book-fff.svg" alt="リスト" />
          <span className="label">READING</span>
        </button>

        <button onClick={() => router.push("/stageList")} className="navItem">
          <img src="/images/icons/honekko.svg" alt="英単語" />
          <span className="label">WORDS</span>
        </button>


        <button onClick={() => router.push("/progress")} className="navItem" data-sound>
          <img src="/images/icons/graph.svg" alt="プロフ" />
          <span className="label">STATS</span>
        </button>

        {/* モフボタン */}
        <button onClick={() => router.push("/mofu")} className="navItem">
          <img src="/images/icons/mofu.svg" alt="モフ" style={{ width: "20px", height: "20px" }}/>
          <span style={{
            fontSize: "11px",
            fontWeight: "bold",
            color: "#ebebeb",
            marginTop: "1px",
          }}>
            {mofu}
          </span>
        </button>

      </div>

      <style jsx>{`
        .navOuter {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          background: #333333;
          z-index: 1000;
        }
        .navInner {
          max-width: 400px;
          margin: 0 auto;
          height: 60px;
          display: flex;
          justify-content: space-around;
          align-items: center;
        }
        .navItem {
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          color: white;
          padding: 5px;
        }
        .navItem img {
          width: 24px;
          height: 24px;
          object-fit: contain;
          margin-bottom: 2px;
        }
        .label {
          font-size: 10px;
          font-weight: bold;
          color: #ebebeb;
        }
      `}</style>
    </div>
  );
}
