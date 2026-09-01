import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import Navigation from "../components/Navigation";
import { getProgress } from "../utils/progressManager";

export default function CategoryList(){
  const [categories, setCategories] = useState([])
  const [storyCounts, setStoryCounts] = useState({}) // category_id -> ストーリー数
  const [progressMap, setProgressMap] = useState({}) // category_id -> 進捗
  const router = useRouter()
  const scrollRefs = useRef({});

  useEffect(()=>{
    async function load() {
      const [catRes, storyRes] = await Promise.all([
        fetch("/data/story/category_list.csv"),
        fetch("/data/story/story_list.csv"),
      ])
      const catData = Papa.parse(await catRes.text(), { header: true, skipEmptyLines: true }).data
      const storyData = Papa.parse(await storyRes.text(), { header: true, skipEmptyLines: true }).data

      const sorted = catData
        .filter(c => c.category_id)
        .sort((a, b) => Number(a.order) - Number(b.order))
      setCategories(sorted)

      // カテゴリごとのストーリー数
      const counts = {}
      storyData.forEach(s => {
        if (!s.category_id) return
        counts[s.category_id] = (counts[s.category_id] || 0) + 1
      })
      setStoryCounts(counts)

      // 各カテゴリの進捗をまとめて取得
      const entries = await Promise.all(
        sorted.map(async (c) => [c.category_id, (await getProgress(c.category_id)) || 0])
      )
      setProgressMap(Object.fromEntries(entries))
    }
    load()
  },[])

  useEffect(() => {
    if (categories.length > 0) {
      const last = localStorage.getItem("lastPlayedCategory");
      if (last && scrollRefs.current[last]) {
        scrollRefs.current[last].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [categories]);

  function openCategory(categoryId){
    localStorage.setItem("lastPlayedCategory", categoryId);
    router.push(`/storyList?category=${categoryId}`)
  }

  return(
    <div className="unitListContainer" style={{ paddingBottom: "100px" }}>
      <div className="unitList">
        <div style={{ textAlign: "center", margin: "25px 0 40px", fontSize: "22px", fontWeight: "bold", color: "#333333" }}>
          Pochi長文
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
            {[0, 0, 0].map((angle, i) => (
              <img key={i} src="/images/icons/book-333.svg" style={{ width: "24px", transform: `rotate(${angle}deg)` }} />
            ))}
          </div>
        </div>

        {categories.map((cat) => {
          const total = storyCounts[cat.category_id] || 0;
          const progress = progressMap[cat.category_id] || 0
          const clearedCount = Math.min(progress, total);

          return (
            <div
              className="unitCard"
              key={cat.category_id}
              ref={(el) => (scrollRefs.current[cat.category_id] = el)}
              onClick={() => openCategory(cat.category_id)}
              data-sound
            >
              <img src="/images/illustrations/unitlist_button.png" className="unitCardBg" />
              <div className="unitCardContent">
                <div className="unitTitle">{cat.category_id.slice(1)}</div>
                <div className="unitName">{cat.category_name}</div>
                <div className="unitBarRow">
                  <div className="progressText" style={{ minWidth: 0, textAlign: "center" }}>{clearedCount}/{total}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Navigation />
    </div>
  )
}
