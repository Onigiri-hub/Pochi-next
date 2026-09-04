import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Papa from "papaparse"
import Navigation from "../components/Navigation"
import { getSectionState } from "../utils/vocabProgressManager"

// 「忘れてるかもゲージ」：合格直後5日は満タン、その後20日でリニアに0へ（合計25日）
function calcGauge(test) {
  if (!test || !test.passed || !test.lastTestedAt) return null
  const d = test.lastTestedAt.toDate ? test.lastTestedAt.toDate() : new Date(test.lastTestedAt)
  const days = (Date.now() - d.getTime()) / 86400000
  if (days <= 5) return 1
  if (days >= 25) return 0
  return 1 - (days - 5) / 20
}

export default function SectionList() {
  const [sections, setSections] = useState([])
  const [roundsMap, setRoundsMap] = useState({})
  const [stateMap, setStateMap] = useState({})   // section_id -> { clearedRounds, test }
  const router = useRouter()
  const { stage, name } = router.query
  const stageName = name ? decodeURIComponent(name) : ""

  useEffect(() => {
    if (!stage) return

    async function load() {
      const res = await fetch("/data/vocab/sectionList.csv")
      const data = Papa.parse(await res.text(), { header: true, skipEmptyLines: true }).data
      const filtered = data.filter(s => s.stage_id === stage)
      setSections(filtered)

      const rmap = {}
      await Promise.all(filtered.map(async (section) => {
        const r = await fetch(`/data/vocab/rounds/${section.rounds_csv}`)
        rmap[section.section_id] = Papa.parse(await r.text(), { header: true, skipEmptyLines: true }).data
      }))
      setRoundsMap(rmap)

      // セクション状態を1 read/セクションで取得
      const entries = await Promise.all(
        filtered.map(async (s) => [s.section_id, await getSectionState(s.section_id)])
      )
      setStateMap(Object.fromEntries(entries))
    }
    load()
  }, [stage])

  if (sections.length === 0) return <div>loading...</div>

  return (
    <div className="unitListContainer" style={{ paddingBottom: "100px" }}>
      <div className="unitList">

        {/* 戻るボタン＋ステージ名 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", position: "relative" }}>
          <button
            onClick={() => router.push("/stageList")}
            style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer" }}
          >
            ◀
          </button>
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontWeight: "bold", fontSize: "16px", color: "#333333" }}>
            {stageName}
          </div>
        </div>

        {sections.map((section) => {
          const rounds = roundsMap[section.section_id] || []
          const state = stateMap[section.section_id] || { clearedRounds: {}, test: null }
          const cleared = state.clearedRounds || {}
          const test = state.test
          const gauge = calcGauge(test)
          const score = test?.lastScore

          return (
            <div key={section.section_id} style={{ marginBottom: "30px" }}>

              {/* セクション名 */}
              <div style={{ marginBottom: "25px", marginTop: "60px", textAlign: "center" }}>
                <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "0px" }}>
                  {section.section_name}
                </div>
                <img src="/images/illustrations/section_underbar.png" style={{ width: "90%", height: "auto" }} />
              </div>

              {/* Roundボタン */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 60px)", gap: "25px", justifyContent: "center", padding: "0 30px" }}>
                {rounds.map((round) => {
                  const isCompleted = cleared[round.round_id] === true
                  return (
                    <div
                      key={round.round_id}
                      onClick={() => {
                        const path = round.mode_type?.includes("typing")
                          ? `/typing1to1?section=${section.section_id}&round=${round.round_id}`
                          : `/fourChoices?section=${section.section_id}&round=${round.round_id}`
                        router.push(path)
                      }}
                      style={{
                        width: "60px", height: "60px", borderRadius: "50%",
                        background: isCompleted ? "#02ccbb" : "#ddd",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: "bold", cursor: "pointer"
                      }}
                    >
                      {isCompleted ? <span style={{ fontSize: "25px" }}>✓</span> : <span>{round.round_no}</span>}
                    </div>
                  )
                })}
              </div>

              {/* セクションテスト ボタン（ラウンドボタン群と同じ幅） */}
              <div style={{ padding: "0 30px", marginTop: "20px" }}>
                <button
                  onClick={() => router.push(`/sectionTest?section=${section.section_id}&stage=${stage}`)}
                  style={{
                    width: "100%", boxSizing: "border-box", border: "none", cursor: "pointer",
                    background: test?.passed ? "#02ccbb" : "#ddd",  // 合格前グレー→合格後は青緑（Roundと同じ）
                    borderRadius: "16px", padding: "14px 18px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)", textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: gauge === null ? 0 : "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "bold", color: "#fff" }}>
                      {section.section_name} テスト！
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fff" }}>
                      {(score ?? 0)}/20
                    </span>
                  </div>

                  {/* 忘れてるかもゲージ（合格後のみ表示・黄色） */}
                  {gauge !== null && (
                    <div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginBottom: "4px" }}>忘れてるかもゲージ</div>
                      <div style={{ height: "8px", background: "rgba(255,255,255,0.35)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.round(gauge * 100)}%`, height: "100%", background: "#ffe000", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}
                </button>
              </div>

            </div>
          )
        })}

      </div>
      <Navigation />
    </div>
  )
}
