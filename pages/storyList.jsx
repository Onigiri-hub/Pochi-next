import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import { getProgress } from "../utils/progressManager"
import Navigation from "../components/Navigation";

export default function StoryList() {
  const [stories, setStories] = useState([])
  const [categoryName, setCategoryName] = useState("")
  const [categoryColor, setCategoryColor] = useState("#e53935")
  const [progress, setProgress] = useState(0)
  const router = useRouter()
  const { category } = router.query

  useEffect(() => {
    if (!category) return;

    async function load() {
      const [catRes, storyRes] = await Promise.all([
        fetch("/data/story/category_list.csv"),
        fetch("/data/story/story_list.csv"),
      ])
      const catData = Papa.parse(await catRes.text(), { header: true, skipEmptyLines: true }).data
      const storyData = Papa.parse(await storyRes.text(), { header: true, skipEmptyLines: true }).data

      const cat = catData.find(c => c.category_id === category)
      setCategoryName(cat?.category_name || "")
      setCategoryColor(cat?.color || "#e53935")

      const list = storyData
        .filter(s => s.category_id === category)
        .sort((a, b) => Number(a.order) - Number(b.order))
      setStories(list)

      setProgress((await getProgress(category)) || 0)
    }
    load()
  }, [category])

  function goStory(s) {
    router.push(`/story?id=${s.category_id}_${s.story_id}`)
  }

  if (stories.length === 0) return <div>loading...</div>

  return (
    <div className="lessonList" style={{ paddingBottom: "80px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button
          onClick={() => router.push("/categoryList")}
          style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
        >
          ◀
        </button>
      </div>

      <div className="lessonHeader" onClick={() => router.push("/categoryList")} data-sound>
        <img src="/images/illustrations/unitlist_button.png" className="unitCardBg" />
        <div className="lessonHeaderContent">
          <h1>{category?.slice(1)}</h1>
          <p>{categoryName}</p>
        </div>
      </div>

      {stories.map((s) => {
        const order = Number(s.order);
        const isCurrent = order === progress + 1;
        const isLocked = order > progress + 1;

        return (
          <div className="lessonRow" key={s.story_id}>
            <div
              className={`lessonIcon ${isLocked ? "locked" : isCurrent ? "current" : "cleared"}`}
              style={{ backgroundColor: isLocked ? "#9e9e9e" : categoryColor }}
              onClick={() => { if (!isLocked) goStory(s) }}
              data-sound
            >
              <img src="/images/icons/practice_icon.png" className="iconImage" />
            </div>
            <div className="lessonInfo">
              <div className="lessonName">{s.story_id.slice(1)} {s.story_name}</div>
            </div>
          </div>
        );
      })}

      <Navigation />
    </div>
  )
}
