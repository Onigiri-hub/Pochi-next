import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useProfileContext } from "../utils/ProfileContext";
import Navigation from "../components/Navigation";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { loadCSV } from "../utils/csvLoader";

export default function AvatarSettings() {
  const [selectedAvatar, setSelectedAvatar] = useState("01.png");
  const [selectedHead, setSelectedHead] = useState(null);
  const [selectedEye, setSelectedEye] = useState(null);
  const [selectedMouth, setSelectedMouth] = useState(null);
  const [avatarItems, setAvatarItems] = useState([]);
  const [headItems, setHeadItems] = useState([]);
  const [eyeItems, setEyeItems] = useState([]);
  const [mouthItems, setMouthItems] = useState([]);
  const [toast, setToast] = useState(null);

  const avatarCarouselRef = useRef(null);
  const headCarouselRef = useRef(null);
  const eyeCarouselRef = useRef(null);
  const mouthCarouselRef = useRef(null);

  const router = useRouter();
  const { profile, setProfile } = useProfileContext();

  const setupCarousel = (ref, setter) => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const value = entry.target.getAttribute("data-value");
            setter(value === "nothing" ? null : value);
          }
        });
      },
      { root: ref.current, threshold: 0.6 }
    );
    const elements = ref.current.querySelectorAll(".avatarOption");
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      if (profile) {
        setSelectedAvatar(profile.avatar || "01.png");
        setSelectedHead(profile.acc_head || null);
        setSelectedEye(profile.acc_eye || null);
        setSelectedMouth(profile.acc_mouth || null);
      }

      const itemsSnap = await getDocs(collection(db, "users", user.uid, "items"));
      const purchasedIds = new Set(itemsSnap.docs.map((d) => d.id));

      const allItems = await loadCSV("/data/itemList.csv");
      const purchased = allItems.filter(
        (item) => item.mofu_cost === "0" && item.unlock_condition === "none"
          || purchasedIds.has(item.item_id)
      );

      setAvatarItems(purchased.filter((i) => i.category === "avatar"));
      setHeadItems(purchased.filter((i) => i.category === "head"));
      setEyeItems(purchased.filter((i) => i.category === "eye"));
      setMouthItems(purchased.filter((i) => i.category === "mouth"));
    });

    return () => unsubscribe();
  }, []);

  const showToast = (msg, callback) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
      if (callback) callback();
    }, 1500);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("ログイン状態が確認できません。");
      return;
    }
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        avatar: selectedAvatar,
        acc_head: selectedHead,
        acc_eye: selectedEye,
        acc_mouth: selectedMouth,
        updatedAt: new Date(),
      }, { merge: true });
      setProfile({
        ...profile,
        avatar: selectedAvatar,
        acc_head: selectedHead,
        acc_eye: selectedEye,
        acc_mouth: selectedMouth,
      });
      showToast("アバターを保存しました！", () => router.back());
    } catch (error) {
      console.error(error);
      showToast("保存に失敗しました。");
    }
  };

  const renderCarousel = (ref, items, selected, setter, category) => {
    const nothingValue = "nothing";
    const allItems = category === "avatar"
      ? items
      : [{ item_id: "nothing", file_name: "nothing.png" }, ...items];

    return (
      <div className="avatarCarousel" ref={ref}>
        {allItems.map((item) => {
          const value = item.item_id === "nothing" ? null : item.file_name;
          const isSelected = selected === value;
          return (
            <div
              key={item.item_id}
              data-value={item.item_id === "nothing" ? nothingValue : item.file_name}
              className={`avatarOption ${isSelected ? "active" : ""}`}
              onClick={() => setter(value)}
            >
              <img
                src={`/images/avatars/${item.file_name}`}
                alt={item.item_id}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="mainContent" style={{ paddingBottom: "160px" }}>
        <div className="header">
          <button className="backBtn" onClick={() => router.back()} style={{ color: "#333333", fontSize: "14px" }}>◀</button>
          <h2>アバターの設定</h2>
        </div>

        {/* プレビュー */}
        <section className="settingSection">
          <h3>プレビュー</h3>
          <div style={{
            position: "relative",
            width: "120px",
            height: "120px",
            margin: "0 auto",
          }}>
            <img
              src={`/images/avatars/${selectedAvatar}`}
              alt="avatar"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
            {selectedEye && (
              <img
                src={`/images/avatars/${selectedEye}`}
                alt="eye"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
            {selectedMouth && (
              <img
                src={`/images/avatars/${selectedMouth}`}
                alt="mouth"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
            {selectedHead && (
              <img
                src={`/images/avatars/${selectedHead}`}
                alt="head"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            )}
          </div>
        </section>

        {/* アバター選択 */}
        <section className="settingSection">
          <h3>アバター</h3>
          {renderCarousel(avatarCarouselRef, avatarItems, selectedAvatar, setSelectedAvatar, "avatar")}
        </section>

        {/* 頭アクセサリ */}
        <section className="settingSection">
          <h3>ぼうし</h3>
          {renderCarousel(headCarouselRef, headItems, selectedHead, setSelectedHead, "head")}
        </section>

        {/* 目元アクセサリ */}
        <section className="settingSection">
          <h3>アイテム ①</h3>
          {renderCarousel(eyeCarouselRef, eyeItems, selectedEye, setSelectedEye, "eye")}
        </section>

        {/* 口元アクセサリ */}
        <section className="settingSection">
          <h3>アイテム ②</h3>
          {renderCarousel(mouthCarouselRef, mouthItems, selectedMouth, setSelectedMouth, "mouth")}
        </section>

        <div
          className="actionButtons"
          style={{
            position: "fixed",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: "400px",
            margin: 0,
            padding: "12px 20px",
            background: "white",
            boxSizing: "border-box",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
            zIndex: 100,
          }}
        >
          <button className="saveBtn" onClick={handleSave}>保存する</button>
        </div>

      </div>
      <Navigation />

      {toast && (
        <div style={{
          position: "fixed", bottom: "90px", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(50,50,50,0.85)",
          color: "#fff", borderRadius: "20px",
          padding: "10px 20px", fontSize: "13px",
          whiteSpace: "nowrap", zIndex: 1001,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
