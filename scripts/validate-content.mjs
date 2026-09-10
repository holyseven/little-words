import { readdirSync, readFileSync } from 'node:fs'

const directory = new URL('../src/content/themes/', import.meta.url)
const themeIds = new Set(), wordIds = new Set(), orders = new Set()
for (const filename of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
  const theme = JSON.parse(readFileSync(new URL(filename, directory), 'utf8'))
  if (!theme.id || themeIds.has(theme.id) || orders.has(theme.order)) throw new Error(`主题 id 或顺序重复：${filename}`)
  themeIds.add(theme.id); orders.add(theme.order)
  if (!Array.isArray(theme.words) || theme.words.length < 8 || theme.words.length > 10) throw new Error(`主题词数须为 8–10：${filename}`)
  for (const word of theme.words) {
    if (!word.id || wordIds.has(word.id)) throw new Error(`单词 id 重复：${word.id}`)
    if (!word.text || !word.zh || !word.sentence || (!word.emoji && !word.svg)) throw new Error(`单词内容不完整：${word.id}`)
    wordIds.add(word.id)
  }
}
console.log(`[content] ${themeIds.size} 个主题，${wordIds.size} 个单词，id 校验通过`)
