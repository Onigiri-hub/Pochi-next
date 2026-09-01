export function getPracticeQuestions(data){
  return data.map(row => ({
    icon_first: row.icon_first,
    icon_second: row.icon_second,
    sentence_first_en: row.sentence_first_en,   // ★ 変更
    sentence_first_ja: row.sentence_first_ja,   // ★ 変更
    sentence_second_en: row.sentence_second_en, // ★ 変更
    sentence_second_ja: row.sentence_second_ja, // ★ 変更
    position_first: row.position_first,   // ★ 追加
    position_second: row.position_second, // ★ 追加
    chips: row.chips,
    answer: row.answer,
    audio_first: row.audio_first,
    audio_second: row.audio_second,
    audio_auto: row.audio_auto,
    ja_show_first: row.ja_show_first,
    ja_show_second: row.ja_show_second,
  }))
}

export function checkAnswer(userAnswer, correctPatterns) {

  const patterns = correctPatterns.split("|")

  return patterns.some((p)=>
    p.trim().toLowerCase() === userAnswer.trim().toLowerCase()
  )

}