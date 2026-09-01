// 並べ替え例文CSVの派生列を生成するスクリプト
//
// 入力（手入力する列）: question_id, arrange_word_id, arrange_word,
//   en1, en2, ja1, ja2, voice1, voice2, included_1or2
// 出力（このスクリプトが自動生成する列）: sentence_first_en, sentence_second_en,
//   answer, chips, audio_first, audio_second, audio_auto
// icon_first / icon_second / position_first / position_second は手入力用に
//   既存の値を保持する（空欄のまま残す）。
//
// 使い方: node scripts/generateArrangeExamples.js
//   対象ファイルの question_id 列（旧 example_id）を元に派生列を埋め直す。

const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const rootDir = path.join(__dirname, '..')
const targetFile = path.join(rootDir, 'public/data/vocab/arrange_sentences/arrange_sentences_ast1.csv')

const BLANK = '____________' // 並べ替え対象の文（空欄バブル）

// 出力する列の順番（手入力10列 → 派生列）
const COLUMNS = [
  'question_id', 'arrange_word_id', 'arrange_word',
  'en1', 'en2', 'ja1', 'ja2', 'voice1', 'voice2', 'included_1or2',
  'voice1_name', 'voice2_name',
  'sentence_first_en', 'sentence_second_en', 'answer', 'chips',
  'audio_first', 'audio_second', 'audio_auto',
  'icon_first', 'icon_second', 'position_first', 'position_second'
]

const text = fs.readFileSync(targetFile, 'utf-8')
const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data

const out = rows.map((r) => {
  // 旧 example_id → question_id にリネーム（どちらのヘッダーでも拾えるように）
  const qid = (r.question_id || r.example_id || '').trim()
  const en1 = r.en1 || ''
  const en2 = (r.en2 || '').trim()
  const included = String(r.included_1or2 || '').trim()

  // 並べ替え対象の文（included_1or2）を空欄バブルにする
  const sentence_first_en = included === '1' ? BLANK : en1
  const sentence_second_en = included === '2' ? BLANK : en2

  // 対象の文が answer。chips は半角スペース区切りを "|" で結合
  const answer = included === '1' ? en1 : en2
  const chips = answer.trim().split(/\s+/).join('|')

  return {
    question_id: qid,
    arrange_word_id: r.arrange_word_id || '',
    arrange_word: r.arrange_word || '',
    en1,
    en2: r.en2 || '',
    ja1: r.ja1 || '',
    ja2: r.ja2 || '',
    voice1: r.voice1 || '',
    voice2: r.voice2 || '',
    included_1or2: included,
    // 手入力用：AmazonPollyで喋らせるキャラ名（大人=Ruth / 子供=Ivy）
    voice1_name: r.voice1_name || '',
    voice2_name: r.voice2_name || '',
    sentence_first_en,
    sentence_second_en,
    answer,
    chips,
    audio_first: qid ? `${qid}-a.mp3` : '',
    audio_second: en2 ? `${qid}-b.mp3` : '', // 2文目が無ければ空
    audio_auto: '1',
    // 手入力用：既存の値を保持（無ければ空欄）
    icon_first: r.icon_first || '',
    icon_second: r.icon_second || '',
    position_first: r.position_first || '',
    position_second: r.position_second || ''
  }
})

const csv = Papa.unparse(out, { columns: COLUMNS })
fs.writeFileSync(targetFile, csv + '\n', 'utf-8')

console.log(`${out.length}行を更新しました → ${path.relative(rootDir, targetFile)}`)
