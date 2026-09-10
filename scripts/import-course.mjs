/** 整理教师原始材料，核对哈希，保留原件并修正副本扩展名。 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
const inventory = JSON.parse(readFileSync(new URL('../docs/curriculum-inventory.json', import.meta.url), 'utf8'))
const output = new URL('../public/course-media/', import.meta.url)
mkdirSync(output, { recursive: true })
const videoTitles = {
 'g1t1-u1': ['你好歌', '认识新朋友', '一起打招呼'],
 'g1t1-u2': ['数数歌', '数气球', '生活中的数字'],
 'g1t1-u3': ['我的家人', '我爱我的家人', '看看全家福'],
 'g1t1-u4': ['我的教室', '欢迎来教室'],
 'g1t1-u5': ['打开我的书包', '一起分享学习用品', '这是什么学习用品'],
 'g1t1-u6': ['颜色歌', '春节里的颜色', '交通灯之歌'],
}
const videoEnglish = {
 'g1t1-u1': ['Hello song', 'Meet new friends', 'Ways to say hello'],
 'g1t1-u2': ['Counting song', 'Count the balloons', 'Numbers around us'],
 'g1t1-u3': ['My family', 'I love my family', 'My family photo'],
 'g1t1-u4': ['My classroom', 'Welcome to our classroom'],
 'g1t1-u5': ['Open my schoolbag', 'Sharing school things', 'School things around us'],
 'g1t1-u6': ['Colours song', 'Colours at Chinese New Year', 'Traffic light song'],
}
const assets = inventory.assets.map((a) => {
 const source = new URL('../' + a.source, import.meta.url)
 const file = `${a.id}-${a.sha256.slice(0, 12)}.${a.container}`
 const prepared = new URL(file, output)
 const hasSource = existsSync(source)
 if (!hasSource && !existsSync(prepared)) throw new Error(`缺少课程素材：${a.source}`)
 const bytes = readFileSync(hasSource ? source : prepared)
 if (bytes.length !== a.bytes || createHash('sha256').update(bytes).digest('hex') !== a.sha256) throw new Error(`课程文件与清单不一致，请核对素材：${a.source}`)
 if (hasSource) copyFileSync(source, prepared)
 const original = a.source.split('/').pop().replace(/\.mp[34]$/, '')
 let title = original
 if (a.kind === 'vocabulary-audio') title = '单词跟读'
 if (a.kind === 'animation') title = videoTitles[a.unitId][Number(a.id.split('-').pop()) - 1]
 if (a.kind === 'lesson-audio') {
  const part = original.match(/(start|read) (\d)$/)
  title = part ? `${part[1] === 'start' ? '开始学' : '读一读'} ${part[2]}` : '拓展活动'
 }
 if (a.kind === 'appendix-audio') {
  const n = original.match(/Appendices ([1-6])/)
  title = n ? `补充活动 ${n[1]}` : original.includes('Beijing') ? 'This is Beijing! · 北京' : `快乐阅读 ${original.endsWith('1') ? '1' : '2'}`
 }
 let titleEn = 'Extra activity'
 if (a.kind === 'animation') titleEn = videoEnglish[a.unitId][Number(a.id.split('-').pop()) - 1]
 if (a.kind === 'vocabulary-audio') titleEn = 'Listen to the words'
 if (a.kind === 'lesson-audio') { const part = original.match(/(start|read) (\d)$/); titleEn = part ? `${part[1] === 'start' ? 'Start' : 'Read'} ${part[2]}` : 'Explore' }
 if (a.kind === 'appendix-audio') titleEn = original.replace(/（[^）]+）/g, '')
 if (a.kind === 'compilation-audio') titleEn = `${original.includes('单词表') ? 'Word review' : original.includes('补充') ? 'Extra activities' : 'Text review'} · Units ${original.includes('1-3') ? '1–3' : '4–6'}`
 return { id: a.id, unitId: a.unitId, kind: a.kind, title, titleEn, originalTitle: original, pageLabel: a.pageLabel,
  file: `course-media/${file}`, duration: a.durationSeconds, bytes: a.bytes, sha256: a.sha256,
  ...(a.kind === 'animation' ? { poster: `course-posters/${a.id}.jpg` } : {}) }
})
const emojis = ['👋', '🔢', '🏡', '🏫', '🎒', '🎨']
const units = inventory.units.map((u, i) => ({ id: u.id, number: u.number, title: u.title, zh: u.zh, emoji: emojis[i],
 assets: u.assets.sort((a, b) => {
  const first = assets.find((x) => x.id === a), second = assets.find((x) => x.id === b)
  return Number(first.pageLabel?.match(/\d+/)?.[0] ?? 0) - Number(second.pageLabel?.match(/\d+/)?.[0] ?? 0) || a.localeCompare(b)
 }) }))
writeFileSync(new URL('../src/content/curriculum.json', import.meta.url), JSON.stringify({ id: inventory.courseId, title: '一年级上册', units, assets }, null, 2) + '\n')
console.log(`[course] ${units.length} 个单元，${assets.length} 份材料，原件保留`)
