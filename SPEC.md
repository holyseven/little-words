# SPEC.md — 儿童英语启蒙离线 Web App

## 0. 给 AI 的执行说明

- 本文档是唯一需求来源。有歧义时优先遵守：**儿童安全 > 离线可用 > iOS Safari 兼容 > 视觉舒适 > 功能数量**。
- 按第 15 节的里程碑顺序实现，默认阶段结束后输出测试说明并等待真机验收。**2026-09-08 用户已明确要求继续 M4 并完成全部需求，本次授权连续完成 M4–M5；仍须如实保留未完成的真机验收。**
- 不引入任何运行时需要联网的资源：不用 Google Fonts、不用 CDN 脚本、不用外部图片/音频 URL。所有依赖必须打包进构建产物。
- 不添加任何数据上报、分析、广告、第三方 SDK、外部链接。
- 每个阶段结束时更新 `README.md`（本地运行、iPad 局域网预览、部署、添加到主屏幕的步骤）。

## 1. 项目概述

**名称**（临时）：Little Words
**目标用户**：5–8 岁中文母语儿童，及其家长
**核心目标**：通过看图（Emoji/SVG）、听发音、玩小游戏，认识并听懂 100 个左右的基础英语单词
**使用场景**：家长把网页"添加到主屏幕"后，孩子在 iPad / iPhone 上完全离线独立使用，每次 5–20 分钟
**非目标（v1 不做）**：账号登录、服务器、语音识别评分、外部视频、多用户档案、上架 App Store

## 2. 技术栈

| 项 | 选择 | 说明 |
|---|---|---|
| 构建 | Vite 5 + TypeScript | |
| UI | React 18 | 函数组件 + hooks |
| 路由 | Hash 路由（`#/theme/animals`） | GitHub Pages 刷新不 404；自己实现或用 `react-router` 的 `HashRouter` |
| PWA | `vite-plugin-pwa`（Workbox） | `registerType: 'autoUpdate'`，核心预缓存 + 家长管理课程下载 |
| 状态/存储 | React state + IndexedDB（`idb-keyval`） | 见第 12 节 |
| 动画 | CSS transitions/keyframes + `framer-motion`（可选） | 纸屑用 `canvas-confetti` |
| 音频 | 人声：构建期预生成 m4a；音效：Web Audio API 合成 | 见第 10 节。人声不用运行时 TTS（iOS 拿不到好语音），TTS 仅作兜底 |
| 图形 | Emoji + 内联 SVG | 课程封面使用随包保存的原片截图 |
| 测试 | Vitest（逻辑单测：进度计算、选词算法） | UI 以真机验收为主 |
| 部署 | GitHub Pages（默认）或 Vercel | `vite.config.ts` 中 `base` 可配置 |

## 3. 运行环境与兼容目标

- **首要**：iOS / iPadOS 16+ Safari，从主屏幕以 standalone 模式启动
- **次要**：macOS Safari / Chrome（开发预览）、Android Chrome（顺带支持）
- 屏幕：iPhone 竖屏（375×667 起）、iPad 竖屏与横屏（768×1024 起）、Mac 窗口
- 输入：**触控优先**，鼠标可用；支持多指同时触碰不出错
- 离线：首次联网加载后，飞行模式下所有功能可用

## 4. 设计原则

1. **护眼舒适**：低饱和、偏暖的大面积背景，绝不用纯白/纯黑，无快速闪烁（详见第 5 节）
2. **零挫败**：没有"失败""游戏结束""倒计时"；答错不扣分、不出红叉、不出刺耳声音
3. **大目标、少文字**：所有可点元素 ≥ 64×64 px，相邻间距 ≥ 12 px；孩子不需要识字也能操作（靠图标 + 语音）
4. **即时反馈**：每次点击都有声音 + 动效；答对有庆祝；答错有温和引导
5. **短会话**：每局 8–10 题，2–3 分钟完成；每日任务 10 分钟内可做完
6. **安全**：无外链、无内购、无输入框收集信息；家长页有家长门

## 5. 视觉规范（重点：眼睛舒适）

### 5.1 色彩系统（CSS 变量，放在 `src/styles/tokens.css`）

**Day 模式（默认）**——暖米色纸感，低饱和

```css
:root {
  --bg:            #F6F1E7;  /* 页面背景：暖米色，非纯白 */
  --bg-soft:       #EFE8DA;  /* 次级区域 */
  --surface:       #FDFAF3;  /* 卡片表面：奶油白 */
  --surface-2:     #F3ECDD;
  --text:          #3B3934;  /* 正文：暖深灰，非纯黑 */
  --text-muted:    #6C665B;  /* M5 加深：在 bg-soft 上对比度 ≥ 4.5:1 */
  --border:        #E2D9C6;

  /* 强调色：中低饱和，只用于小面积（按钮、图标、星星） */
  --coral:         #EE9B86;  /* 主按钮 */
  --sage:          #9BC49B;  /* 正确/完成 */
  --sky:           #8FB8DC;  /* 信息/链接 */
  --butter:        #F2D27E;  /* 星星/奖励 */
  --lilac:         #BFAEDC;  /* 装饰 */
  --peach:         #F3C4A6;  /* 温和提示（替代红色错误） */

  --shadow:        0 4px 14px rgba(80, 60, 30, 0.10);
  --radius:        24px;
}
```

**Night 模式**（家长页可选：自动/白天/夜间；自动 = 跟随系统 `prefers-color-scheme` 或 19:00–7:00）——暖深色，降低夜间亮度

```css
[data-theme="night"] {
  --bg:         #2B2824;
  --bg-soft:    #332F2A;
  --surface:    #3A352F;
  --surface-2:  #443E37;
  --text:       #EDE6D8;
  --text-muted: #B3AA99;
  --border:     #4F4840;
  /* 强调色整体降低 15% 亮度，保持同一色相 */
}
```

**每个主题一个专属"氛围色"**（用于地图站点和主题页顶部区域），全部为低饱和粉彩：
Animals `#DCE9D2` · Fruits `#F6E3D0` · Colors `#E7DDF0` · Numbers `#D9E6EF` · Vehicles `#E0E5EC` · Weather `#DCEAF0` · Body `#F3E2DA` · Food `#F5EBD3`

### 5.2 护眼硬性规则

- 大面积区域（背景、卡片、面板）饱和度 ≤ 35%，明度在 88–97% 之间（Day）
- 正文文字与背景对比度 ≥ 4.5:1，大字（≥ 32px）≥ 3:1
- **禁止**任何频率 > 3 Hz 的闪烁、频闪、屏幕整体闪白
- 纸屑/庆祝动画：持续 ≤ 1.5 秒，粒子 ≤ 80 个，不覆盖全屏中心内容
- 错误反馈用"轻微抖动 + 桃色描边 + 低柔音"，**不用红色、不用红叉**
- 页面切换用淡入淡出或轻微滑动（200–300ms），不用高速缩放
- 渐变只用相邻色、低对比（如 `--bg` → `--bg-soft`）
- 尊重 `prefers-reduced-motion`：关闭纸屑、弹跳，仅保留淡入淡出
- 不使用高亮纯色大块背景（如纯黄、纯蓝整屏）

### 5.3 字体与排版

```css
font-family: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "PingFang SC", system-ui, sans-serif;
```

- 仅用系统字体，不引入 web font
- 单词展示 ≥ 56px（iPad ≥ 72px），字重 700
- 按钮文字 ≥ 22px，正文 ≥ 20px，家长页正文 ≥ 16px
- 中文提示（可关）用 `--text-muted`，字号为英文的 40–50%
- 行高 1.4，字距略宽（`letter-spacing: 0.01em`）

### 5.4 形状与布局

- 全部圆角（卡片 24px，按钮 20px，小元素 12px），无尖角
- 柔和阴影，无硬边线
- 使用 `100dvh` 与 `env(safe-area-inset-*)` 处理全屏与刘海/底部条
- iPhone 竖屏：单列，选项 2×2；iPad：更大间距，选项 2×2 或 1×4（横屏）
- 所有页面左上角固定"返回"按钮（🏠 或 ←，≥ 64px），standalone 模式无浏览器返回

## 6. 信息架构

```
#/                首页：关卡地图 + 星星数 + 陪伴角色 + 今日任务入口
#/theme/:id       主题页：该主题的活动入口（学单词 / 3 个游戏）+ 进度
#/theme/:id/learn 单词卡学习
#/theme/:id/game/listen   听音选图
#/theme/:id/game/memory   记忆翻牌
#/theme/:id/game/bubble   泡泡射击
#/stickers        贴纸册 + 徽章墙
#/daily           今日任务详情 / 完成庆祝
#/parent          家长页（需通过家长门）
```

## 7. 功能详述

### 7.1 首页：关卡地图

- 一条弯曲的路径（SVG path），8 个主题站点依次排布，可纵向滚动
- 站点状态：`locked`（灰色轮廓 + 小锁）/ `available`（氛围色 + 主题 emoji + 轻微呼吸动画）/ `completed`（氛围色 + 徽章 + 小星星）
- 解锁规则：第 1 个主题默认可用；完成第 N 个后解锁第 N+1 个（家长页可开"全部解锁"）
- 顶部：⭐ 星星总数（数字变动有滚动动画）、贴纸册入口、今日任务小卡（3 个圆点表示完成度）
- 右下角：陪伴角色，进入时打招呼（TTS："Hi! Let's learn some words!"）
- 左上角：家长入口（小齿轮，进入需家长门）

### 7.2 主题页

- 顶部区域为主题氛围色，显示主题 emoji + 英文名 + 中文名（可关）
- 4 个大入口卡：📖 Learn / 👂 Listen & Pick / 🃏 Memory / 🫧 Bubbles
- 显示进度：已学单词 x/10；每个游戏最佳成绩（星星数）
- 完成条件：全部单词在 Learn 中标记"I know it" **且** 任意一个游戏正确率 ≥ 80%
- 完成时：徽章解锁动画 + 角色庆祝 + TTS "You finished Animals! Amazing!"

### 7.3 单词卡学习（Learn）

- 一次一张大卡片：上方 emoji（≥ 120px），下方单词，再下方中文（可关）
- 进入卡片自动朗读单词（需已完成音频解锁，见 10.2；未解锁时显示"点我听"提示）
- 点 emoji：再读一次单词；点单词文字：朗读例句（如 "The cat is sleeping."）并显示例句
- 底部两个按钮：🔊 再听一次 / ⭐ I know it（首次标记 +1 星）
- 左右滑动或点箭头切换；末尾显示总结页（学了 N 个词，得 N 星）
- 卡片切换动画：轻微滑动 + 淡入

### 7.4 游戏：听音选图（Listen & Pick）

- 每局 8 题；开局前显示"▶ Start"大按钮（用于解锁音频）
- 每题：角色说单词（TTS），中间显示大 🔊 按钮可重听，下方 4 个 emoji 选项（1 正确 + 3 同主题干扰项）
- 答对：选项放大 + 绿色（sage）描边 + 正确音效 + 小范围纸屑 + 星星 +1 + 角色 happy；800ms 后下一题
- 答错：该选项抖动 + 桃色描边 + 低柔音 + 角色 encourage（TTS "Try again!"）；自动重读单词；第 2 次答错后正确项发光提示，点中即过（不计分）
- 选词算法：优先抽正确率低 / 未见过的词（见 12.3）
- 局末：显示 x/8、获得星星、角色庆祝（≥ 6 分播放 celebrate 音效 + 纸屑）；按钮"再玩一次 / 回主题"

### 7.5 游戏：记忆翻牌（Memory）

- iPhone：6 对（3×4）；iPad：8 对（4×4）
- 卡背：统一图案（主题氛围色 + 小星星纹理）；卡面：一半是 emoji，一半是单词文字
- 翻开任意卡时朗读对应单词
- 配对成功：两卡发光 + 正确音效 + 星星 +1，保持翻开
- 不匹配：1 秒后翻回，无负面音效（只用轻柔 flip 音）
- 无步数限制、无计时；完成后庆祝页

### 7.6 游戏：泡泡射击（Bubbles）

- 屏幕底部缓慢升起泡泡（半透明圆 + 内部 emoji），同时最多 5 个，上升 8–12 秒到顶后消失并重新生成
- 顶部显示目标：🔊 + 单词文字；角色朗读目标词
- 点中正确泡泡：泡泡破裂动画 + pop 音 + 星星 +1 → 下一个目标词
- 点错泡泡：泡泡晃动不破裂，轻柔提示音
- 每局 10 个目标词；速度恒定缓慢，**没有时间压力和失败状态**
- 使用 `requestAnimationFrame`，页面不可见时暂停

### 7.7 陪伴角色（Mascot）

- 内联 SVG 卡通形象（AI 自行设计一只圆润的小熊或小恐龙，命名如 "Momo"），尺寸随屏幕 96–160px
- 状态与 CSS 动画：
  - `idle`：每 3–5 秒随机眨眼，轻微上下呼吸
  - `happy`：跳起 + 举手臂 + 微笑，1 秒后回 idle
  - `encourage`：点头 + 身体前倾，0.8 秒
  - `sleepy`：闭眼 + 冒 "z z z"（用于每日限时到达）
- 说话时显示气泡（英文 + 可选中文小字），气泡出现与 TTS 同步
- 台词库（随机取）：
  - 打招呼：Hi there! / Let's play! / Ready to learn?
  - 答对：Great job! / You did it! / Awesome! / Yes!
  - 答错：Try again! / Almost! / Listen once more.
  - 完成：You finished! / Amazing work! / See you tomorrow!

### 7.8 奖励系统

- **星星**：答对 +1；首次标记 "I know it" +1；完成一局 +5；完成每日任务 +10
- **贴纸**：每 10 颗星自动获得 1 张贴纸（从贴纸池随机，不重复直到池空）。贴纸池 = 40 个装饰性 emoji（🦄🌈🎈🍭🐣🦋🌻🚀⭐️🎨…）
- **贴纸册**：网格页，已获得的显示 emoji，未获得的为虚线空位；点贴纸有弹跳 + tap 音
- **徽章**：每完成一个主题获得该主题徽章（主题 emoji + 圆形底 + 缎带 SVG），显示在贴纸册下方"徽章墙"
- 获得贴纸时：全屏浅色遮罩 + 贴纸放大旋转登场 + celebrate 音 + TTS "You got a new sticker!"

### 7.9 每日任务

- 每天（按本地日期）生成 3 个任务，例如：
  - 在【当前可用主题】学 5 个新单词
  - 玩一局 Listen & Pick
  - 复习 5 个曾经答错的词（无错词则换成玩一局 Memory）
- 首页任务卡显示 3 个圆点；全部完成 → 跳转 `#/daily` 庆祝页 + 10 星 + 角色 "See you tomorrow!"
- 任务完成后不阻止继续玩
- 任务及目标词当天固定；新词/错词不足 5 个时使用实际数量，新词全学过时改为复习，避免无法完成。奖励标记与进度一起存储，刷新不重复发放

### 7.10 每日时长限制

- 家长页设置（默认 20 分钟，可选 10/15/20/30/关闭）；仅统计 App 学习区域在前台的时间，家长设置与休息页不计时
- 到达上限：淡出到"晚安页"，背景切换为更暗的暖色，角色 sleepy，TTS "Time to rest. See you tomorrow!"；仅家长门可解除（当日再加 10 分钟）

### 7.11 家长页

- **家长门**：长按齿轮 3 秒 → 弹出题目"请回答：7 + 5 = ?"（两位数加法，随机）→ 正确进入；可选设置 4 位 PIN 替代
- 内容（中文界面，字号可正常）：
  - 学习概览：总星星、已完成主题、每个词的 正确/错误 次数（可排序）
  - 设置：中文提示 开/关；语音选择（列出可用 en 语音）；语速 0.7–1.0；音效 开/关；外观 自动/白天/夜间；每日时长；解锁全部主题
  - 数据：导出进度（下载 JSON）/ 导入进度（选择 JSON 文件）/ 重置全部（二次确认）
  - 关于：版本号、离线状态（Service Worker 是否就绪、`storage.persist` 是否成功）
- 家长页不含任何外链

## 8. 内容数据

### 8.1 数据结构（`src/content/types.ts`）

```ts
export interface Word {
  id: string;         // 'cat'
  text: string;       // 'cat'
  emoji?: string;     // '🐱'  ，与 svg 二选一
  svg?: string;       // 内联 SVG 组件名，emoji 无法表达时使用
  zh: string;         // '猫'
  sentence: string;   // 'The cat is sleeping.'
}

export interface Theme {
  id: string;         // 'animals'
  title: string;      // 'Animals'
  zh: string;         // '动物'
  emoji: string;      // '🐾'
  tint: string;       // '#DCE9D2'
  order: number;
  words: Word[];      // 8–10 个
}
```

### 8.2 初始词表（v1，8 主题 × 10 词）

| 主题 | 单词（emoji） |
|---|---|
| Animals 🐾 | cat 🐱 · dog 🐶 · elephant 🐘 · lion 🦁 · monkey 🐵 · rabbit 🐰 · fish 🐟 · bird 🐦 · cow 🐮 · pig 🐷 |
| Fruits 🍎 | apple 🍎 · banana 🍌 · orange 🍊 · grapes 🍇 · strawberry 🍓 · watermelon 🍉 · pear 🍐 · peach 🍑 · cherry 🍒 · lemon 🍋 |
| Colors 🎨 | red · blue · yellow · green · orange · purple · pink · brown · black · white（用 SVG 圆形色块渲染，不用 emoji；black/white 加描边） |
| Numbers 🔢 | one … ten（SVG：大数字 + 对应数量的小圆点） |
| Vehicles 🚗 | car 🚗 · bus 🚌 · bike 🚲 · train 🚆 · plane ✈️ · boat ⛵ · truck 🚚 · rocket 🚀 · helicopter 🚁 · taxi 🚕 |
| Weather 🌤️ | sunny ☀️ · rainy 🌧️ · cloudy ☁️ · snowy ❄️ · windy 🌬️ · rainbow 🌈 · storm ⛈️ · moon 🌙 · star ⭐ · hot 🌡️ |
| Body 🙂 | eye 👁️ · ear 👂 · nose 👃 · mouth 👄 · hand ✋ · foot 🦶 · tooth 🦷 · leg 🦵 · arm 💪 · hair（SVG） |
| Food 🍞 | bread 🍞 · egg 🥚 · milk 🥛 · rice 🍚 · cake 🎂 · pizza 🍕 · cookie 🍪 · ice cream 🍦 · cheese 🧀 · juice 🧃 |

- 每个词写一句 4–6 词的简单例句
- 词表放在 `src/content/themes/*.json`，便于以后增删；构建时校验 id 唯一

## 9. 图形方案

- Emoji 用 `<span role="img" aria-label="cat">` 包裹，`font-size` 控制大小；用 `font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"` 保证一致
- SVG 插画：扁平、圆润、2–4 色，颜色取自第 5.1 强调色；作为 React 组件放 `src/content/svg/`
- 角色、徽章、地图路径、卡背图案全部为内联 SVG
- 图标（应用图标、apple-touch-icon）由脚本从角色 SVG 生成 PNG（180/192/512），背景色 `--bg`

## 10. 音频方案

> **v1.1 变更（2026-09-08）**：人声改为**构建期预生成音频文件**，不再用运行时 TTS。
>
> 原因：iOS Safari 的 Web Speech API **只暴露设备预装的 compact 档语音**，用户在
> 「设置 → 辅助功能 → 朗读内容」里下载的 Enhanced / Premium 语音拿不到（Apple 开发者
> 论坛 thread/723503 官方确认），且该行为在 iOS 15–18 间反复变动。compact 档就是
> 「词典腔」；部分设备只剩 Eloquence（1980 年代共振峰合成），更机械。
> 听力是本 App 的核心价值，发音质量不能交给设备决定。
>
> 音效（tap / correct / pop 等）仍全部用 Web Audio 合成，不受此变更影响。
> 运行时依然完全离线：音频随构建产物由 Service Worker 预缓存。

### 10.1 预生成人声（`scripts/gen-audio.mjs` + `src/audio/clips.ts`）

- 构建期用 macOS `say` 的 **Enhanced / Premium 档语音**（默认 `Evan (Enhanced)`，按试听结果排序而非档位）渲染，`afconvert` 转 AAC-LC / m4a
- 覆盖三类文本：单词（`w/<id>.m4a`）、例句（`s/<id>.m4a`）、角色台词（`p/<slug>.m4a`）
- 后处理：裁首尾静音（相对峰值 2% 阈值 + 12ms 余量）→ 峰值归一化到 0.89 → 8ms 余弦淡入淡出
  - 不裁静音，点击反馈会发木；不归一化，各词音量忽大忽小
- 语速：单词 145 wpm，例句 165 wpm（`say -r`）
- 采样率 22050 Hz —— 已用频谱分析确认这是这些语音的原生采样率，更高只是重采样
- 码率 48 kbps 单声道；100 词 + 100 句 + 台词约 1.2 MB
- 增量生成：`(语音, 语速, 文本)` 的哈希写进 `src/content/audioManifest.json`，未变更的片段跳过
- 产物 `public/audio/**.m4a` 与清单**提交进仓库**：`say` 只有 macOS 有，CI/Linux 无法重新生成
- 播放走 **Web Audio**（复用已解锁的 `AudioContext`）而非 `<audio>`：绕开 iOS 自动播放限制、解码后缓存在内存、能精确知道播放结束
- 同一时刻只播一条人声，新的打断旧的
- **片段缺失时自动回落到 `speechSynthesis`**：新增主题忘了跑 `npm run audio` 也不会没声音

### 10.2 TTS 兜底（`src/audio/tts.ts`）

仅在音频片段缺失时使用。保留全部 iOS 兼容处理：

- 仅选用设备本地（`localService`）语音，避免联网合成。语音选择优先级：家长设置 > 优选名单（Samantha / Ava / Allison / Susan / Nicky / Aaron…）> 任意可用 `en-US` > 任意可用 `en-*`
- **黑名单**排除搞怪语音（Albert / Zarvox / Bells…）与 Eloquence 家族（Eddy / Flo / Grandma / Grandpa / Reed / Rocko / Sandy / Shelley）
  - 不加黑名单时，「任意 en-US」兜底会选中按字母序排第一的 Albert
- 参数：`rate` 默认 0.85（家长可调），`pitch` 1.05，`volume` 1
- iOS 已知问题处理：
  - 每次 `speak()` 前先 `speechSynthesis.cancel()`
  - 首次用户手势时朗读一个空格字符以「预热」
  - `visibilitychange` 回到前台时 `cancel()` 并重置状态
  - 若 `speaking` 状态卡住 > 5 秒，强制 `cancel()`
  - 队列化：同一时刻只允许一条语句，新语句打断旧语句
- 若无任何英文语音：UI 正常运行，家长页显示提示「设备未安装英文语音，请在 设置→辅助功能→朗读内容 中下载」

### 10.3 音频解锁（`src/audio/audioUnlock.ts`）

- 在全局第一次 `pointerdown` 时：创建/`resume()` `AudioContext`，并进行 TTS 预热
- 未解锁前，需要自动播放的地方显示醒目的 "▶ 点我开始" 按钮，而不是静默失败

### 10.4 合成音效（`src/audio/sfx.ts`，Web Audio API）

所有音效使用软起音/软释音（attack ≥ 5ms，release ≥ 60ms），主增益 ≤ 0.4，避免爆音：

| 名称 | 设计 |
|---|---|
| `tap` | 正弦波 660Hz，60ms |
| `correct` | 三角波琶音 C5→E5→G5，每音 90ms |
| `celebrate` | 快速上行琶音 C5-E5-G5-C6 + 高频"闪光"噪声 300ms |
| `wrong` | 三角波 220Hz→180Hz 下滑 150ms，增益 0.2（很轻柔） |
| `pop` | 带通滤波白噪声 40ms + 正弦 900Hz→300Hz 下滑 |
| `flip` | 正弦 400Hz→800Hz 上滑 80ms |
| `sticker` | `celebrate` + 铃声（正弦 1320Hz 衰减 400ms） |

- 家长页可整体关闭音效；`prefers-reduced-motion` 不影响音效

## 11. iOS Safari / PWA 专项要求

### 11.1 `index.html` / manifest

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Little Words">
<meta name="theme-color" content="#F6F1E7">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
```

manifest：`display: "standalone"`，`orientation: "any"`，`background_color` 与 `theme_color` = `#F6F1E7`，`start_url` 含 `#/`，图标 192/512（含 maskable）

### 11.2 触控与手势

```css
html, body { touch-action: manipulation; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
* { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; }
.parent-page * { user-select: text; }  /* 家长页允许选择 */
```

- 禁止双击缩放、双指缩放（viewport + touch-action）
- 所有交互用 Pointer Events，处理 `pointercancel`；多指同时触碰时只响应第一个 pointer
- 拖拽区域（若有）设置 `touch-action: none`
- 按钮用 `<button>`，`min-width/min-height: 64px`

### 11.3 布局

- 根容器 `min-height: 100dvh`；顶部/底部使用 `padding: env(safe-area-inset-top) … env(safe-area-inset-bottom)`
- 监听 `orientationchange` / `resize`，游戏画布重新布局
- standalone 模式下无浏览器返回：所有非首页页面必须有可见返回按钮；同时监听 `popstate` 支持系统手势返回

### 11.4 离线与存储

- Service Worker 预缓存核心构建产物（含通用人声音频和课程封面），导航请求回退到 `index.html`。约 53 MiB 课程媒体排除自动预缓存，由家长下载到独立 Cache Storage，支持 Range 请求，详见第 18 节
- `registerType: 'autoUpdate'`，`skipWaiting` + `clientsClaim`，用户下次启动即用新版本，不弹更新提示打扰孩子
- 首次启动后调用 `navigator.storage.persist()`，结果记录到设置并在家长页显示
- 家长页显示 `navigator.storage.estimate()` 用量

### 11.5 生命周期

- `visibilitychange` 隐藏时：暂停游戏动画、停止 TTS、暂停计时；恢复时重新初始化 TTS
- 计时（每日时长）用 `Date.now()` 差值而非 `setInterval` 累加，避免后台不准

## 12. 数据与存储

### 12.1 存储键（IndexedDB via `idb-keyval`，store 名 `little-words`）

```ts
interface Progress {
  version: 1;
  stars: number;
  stickers: string[];                       // 已获得贴纸 emoji
  badges: string[];                         // 已完成主题 id
  themes: Record<string, {
    learned: string[];                      // 已标记 I know it 的词 id
    best: { listen?: number; memory?: number; bubble?: number }; // 最佳正确数/完成标记
    completed: boolean;
  }>;
  wordStats: Record<string, { seen: number; correct: number; wrong: number; lastSeen: number }>;
  daily: { date: string; tasks: DailyTask[]; done: string[]; usedMs: number; bonusMs: number; rewarded?: boolean };
}

interface Settings {
  showZh: boolean;            // 默认 true
  voiceName?: string;
  rate: number;               // 默认 0.85
  sfx: boolean;               // 默认 true
  appearance: 'auto' | 'day' | 'night';  // 默认 auto
  dailyLimitMin: number | 0;  // 默认 20，0=关闭
  unlockAll: boolean;         // 默认 false
  parentPin?: string;
  persisted?: boolean;
}
```

### 12.2 写入策略

- 每次得星/答题立即写入（防止孩子直接关掉 App 丢进度）
- 写入用防抖 ≤ 300ms 合并；关键节点（局末、获得贴纸）立即 flush
- 导出为 `little-words-backup-YYYYMMDD.json`，包含进度和学习设置；导入前做 schema 校验并提示覆盖，在同一个 IndexedDB 事务中替换
- 备份不包含 PIN / 存储授权；导入保留设备现有 PIN / 存储授权，兼容旧版原始 Progress 对象
- DailyTask 保存 `wordIds` / `completedWordIds` / `count`，每日 `rewarded` 防止重复发 10 星；旧版空任务启动时迁移

### 12.3 选词算法（`src/logic/pickWords.ts`，需单测）

- 权重 = `1 + wrong*2 + (unseen ? 3 : 0) + max(0, 3 - correct)`
- 一局内不重复出题；干扰项从同主题中随机且与正确项不同
- 记忆翻牌与泡泡不使用权重（随机即可）

## 13. 可访问性与安全

- 所有 emoji/SVG 有 `aria-label`；按钮有可读文本或 `aria-label`
- 支持 `prefers-reduced-motion`、`prefers-color-scheme`
- 无任何外部网络请求（构建后用 DevTools Network 验证，除首次加载自身资源）
- 无 `<a href="http…">`，无第三方脚本，无 cookie
- 家长门保护：家长页、重置数据、时长解除、解锁全部主题

## 14. 项目结构

```
/
├── SPEC.md
├── README.md
├── index.html
├── vite.config.ts
├── package.json
├── scripts/
│   ├── gen-icons.mjs            # 从角色 SVG 生成 PNG 图标
│   ├── gen-audio.mjs            # 生成人声 m4a（macOS Premium 语音，见第 10 节）
│   ├── import-course.mjs        # 整理并校验老师课程材料
│   ├── build.mjs                # 构建包装（补 Node 18 的 crypto flag）
│   └── lib/                     # wav.mjs · audio-post.mjs
├── public/
│   ├── icons/
│   ├── audio/                   # w/*.m4a · s/*.m4a · p/*.m4a（提交进仓库）
│   ├── course-media/            # 61 份课程材料（随项目保存）
│   └── course-posters/          # 17 张原片封面（随项目保存）
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # 路由、全局 Provider、音频解锁监听
│   ├── router.tsx
│   ├── styles/
│   │   ├── tokens.css           # 第 5 节色彩/字号变量
│   │   └── global.css
│   ├── content/
│   │   ├── types.ts
│   │   ├── themes/*.json
│   │   ├── audioManifest.json   # gen-audio 产出，运行时查片段是否存在
│   │   ├── curriculum.json      # import-course 产出的课程清单
│   │   ├── curriculum.ts        # 类型、单元与材料查询
│   │   ├── stickers.ts
│   │   ├── phrases.ts           # 角色台词库
│   │   └── svg/                 # Colors / Numbers / hair 等 SVG 组件
│   ├── course/downloads.ts      # 独立媒体缓存与下载管理
│   ├── audio/
│   │   ├── clips.ts             # 预生成人声播放（主路径）
│   │   ├── tts.ts               # TTS 兜底
│   │   ├── sfx.ts
│   │   └── audioUnlock.ts
│   ├── store/
│   │   ├── db.ts
│   │   ├── progress.ts
│   │   └── settings.ts
│   ├── logic/
│   │   ├── pickWords.ts
│   │   ├── rewards.ts           # 星星→贴纸、主题完成判定
│   │   ├── courseProgress.ts    # 播放覆盖与完成奖励
│   │   └── daily.ts             # 每日任务生成与判定
│   ├── components/
│   │   ├── Mascot/              # SVG + 状态动画 + 气泡
│   │   ├── BigButton.tsx
│   │   ├── WordCard.tsx
│   │   ├── StarCounter.tsx
│   │   ├── BackButton.tsx
│   │   ├── Confetti.tsx
│   │   └── ParentGate.tsx
│   ├── pages/
│   │   ├── Home.tsx             # 课本入口与关卡地图
│   │   ├── Course.tsx            # 单元与材料列表
│   │   ├── CoursePlayer.tsx      # 原声音视频播放
│   │   ├── ThemePage.tsx
│   │   ├── Learn.tsx
│   │   ├── games/
│   │   │   ├── ListenPick.tsx
│   │   │   ├── MemoryFlip.tsx
│   │   │   └── BubblePop.tsx
│   │   ├── Stickers.tsx
│   │   ├── DailyDone.tsx
│   │   ├── GoodNight.tsx
│   │   └── Parent.tsx
│   └── hooks/
│       ├── useVoice.ts          # 人声播放（片段优先，TTS 兜底）
│       ├── useSfx.ts
│       ├── useProgress.ts
│       └── useDailyTimer.ts
└── tests/
    ├── pickWords.test.ts
    ├── rewards.test.ts
    └── daily.test.ts
```

## 15. 里程碑

每个里程碑结束：`npm run build` 无错误、开发服务提供局域网地址、README 更新测试说明。此次按用户授权连续完成剩余实现，真机验收记录在第 16 节及 README。

进度：M0 ✅ 已验收 · M1 ✅ 已验收 · M2–M4 ✅ 代码完成 · M5 ✅ 界面与运行打磨完成，桌面自动化通过；⏳ iPad / iPhone 真机最终验收和 A10 ≥50fps 实测待完成。当前版本 1.2.0；M6 ✅ 老师原始材料、课程每日任务与离线下载已接入，M8 游戏乐园与两个新游戏已接入，范围见第 18、20 节。

### M0 — 骨架与离线（验收重点：iPad 飞行模式可用）
- Vite + React + TS + vite-plugin-pwa 搭建；tokens.css；hash 路由
- 首页（仅 Animals 一个站点）→ 主题页 → Learn 单词卡
- Mascot idle 状态 + 打招呼
- 预生成人声（Evan Enhanced）+ TTS 兜底 + 音频解锁 + 合成 `tap` 音效
- manifest、图标生成、iOS meta、触控禁用规则、safe-area
- 验收：iPad 添加到主屏幕 → 开飞行模式 → 完整走一遍 Learn，有声音且发音自然

### M1 — 第一个游戏与反馈闭环
- Listen & Pick 完整流程 + 正确/错误反馈 + 纸屑 + 星星 + 进度持久化
- 全部音效；Mascot happy / encourage 状态
- 选词算法 + 单测

### M2 — 地图、8 个主题、奖励
- 8 个主题内容 JSON + Colors/Numbers SVG 渲染
- 关卡地图（锁定/可用/完成）+ 解锁逻辑 + 徽章
- 星星→贴纸 + 贴纸册 + 获得贴纸动画

### M3 — 另两个游戏
- Memory Flip（iPhone/iPad 不同规模）
- Bubble Pop（rAF、暂停、无失败状态）
- 已实现：两个游戏入口、语音/星星/奖励/最佳成绩接入、后台与奖励遮罩暂停、转屏布局、减少动态效果。真机验收见 README「记忆翻牌与泡泡（M3）」。
- 成绩存储口径：`best.memory` 仅在整局完成时写入配对数（6/8，作为完成标记）；`best.bubble` 为 10 个目标中的首次点对数。主题达标分别为 Memory 完成一局、Bubble ≥8/10；点错仍可继续，星星不扣除。

### M4 — 家长功能与日常节奏
- 家长门 + 家长页全部设置
- 每日任务 + 每日时长限制 + 晚安页
- Night 模式 + 自动切换；导出/导入/重置
- 已实现并自动化验证：长按/加法/PIN、全部设置、备份校验与确认、每日任务全流程及一次性奖励、前后台计时、休息拦截与加时、跨午夜重置。补齐每日任务/备份/外观逻辑单测。

### M5 — 打磨
- `prefers-reduced-motion`；老设备（iPad 第 6 代 / A10 级别）性能核查，动画 ≥ 50fps
- 所有页面横竖屏检查；文案与台词润色
- 目标：最终验收清单（第 16 节）全部通过；需要真机的项目保持待验收
- 已完成：4 种屏幕尺寸 × 9 个页面的布局检查；修复矮屏学习卡/听音选图裁切；深色主按钮文字与次级文字对比度修正；减少动态效果、1.45 秒纸屑上限；听音选图后台暂停和同步结算；构建前词表校验
- 本地验证：116 项测试、TypeScript、生产构建通过。实际 iOS Safari 听感、主屏幕离线和 A10 帧率不以桌面模拟结果代替。

## 16. 验收清单（在 iPad 与 iPhone 真机执行）

以下勾选仅用于真实设备验证；桌面自动化通过情况见 README，不自动勾选真机项目。

- [ ] Safari 添加到主屏幕，图标与名称正确，启动无地址栏
- [ ] 开飞行模式，冷启动 App，所有页面与游戏可用，有语音和音效
- [ ] 首次进入点一次后，后续朗读均正常；切到后台再回来仍能朗读
- [ ] 双击、双指捏合不会缩放；长按不出现选字/菜单
- [ ] iPhone 顶部刘海与底部横条不遮挡任何按钮
- [ ] iPad 横屏 ↔ 竖屏切换布局正确，游戏中切换不崩
- [ ] 每个页面都能通过 App 内按钮回到首页
- [ ] 答对/答错反馈符合第 5.2 护眼规则（无红叉、无闪屏）
- [ ] 完全关闭 App 后重开，星星、贴纸、进度保留
- [ ] 两只手同时乱点不报错、不卡死
- [ ] 家长门能挡住孩子（长按 3 秒 + 算术 / PIN）；离开或后台后重新验证
- [ ] 每日三个任务可完成，10 星只发一次；跨日任务及当日计时重置
- [ ] 后台不计时；到点休息且无法绕过，家长验证可加 10 分钟
- [ ] 备份导入/导出有效，坏文件与取消导入不改变数据，重置有二次确认
- [ ] 减少动态效果有效；iPad 第 6 代 / A10 动画实测 ≥50fps
- [ ] 夜间模式下背景为暖深色，文字清晰
- [ ] DevTools Network：除自身资源无任何外部请求
- [ ] Mac Safari / Chrome 打开正常（鼠标可操作）

## 17. 部署与更新

- `npm run build` → `dist/`；GitHub Pages 用 Actions 自动部署（提供 workflow 文件），`base` 设置为仓库名
- 更新流程：改代码 → push → 各设备下次联网启动时自动更新
- README 需包含：本地开发、iPad 局域网预览（`--host` + Mac 的 IP）、Mac Safari 远程调试 iPad 的方法、部署、添加到主屏幕图文步骤、常见问题（没有声音 / 更新未生效 / 进度丢失）


## 18. M6 — 一年级上册课本同步（v1.1.0）

用户新增需求：将老师提供的「一年级上册音频和动画」与现有学习 App 整合。本节扩展原 v1 范围，使用本地随包材料，不引入视频平台、外部资源 URL 或数据上报。原 M0–M5 的游戏与存档保持兼容。

### 18.1 已接入的内容与入口

- 首页「课本同步 / 单词乐园」双入口，默认课本同步；家长指定当前学校单元，提供继续学习与最近播放位置。
- 6 个单元：Hello!、Numbers、Family、My classroom、School things、Colours，课程不受主题游戏解锁条件限制。
- 全部 61 份材料：6 段单元单词音频、23 段课文音频、17 个动画、6 个复习合集、9 个附录音频，共 55,327,436 字节。U4 只有两个现有动画，不创建缺失入口。
- 单课页码来自原始文件名；动画使用实际序号，不假定与某页/某课一一对应。保留原片字幕，封面使用原片截图；不推断未提供的教材版本或词表。
- 大号播放/暂停、重听、上一段/下一段、拖动、视频全屏、位置保存。默认 1×，家长可选 0.85× / 0.7×；不自动开始或连播。退出、后台、奖励遮罩和限时休息时暂停。
- U2 / U6 可进入已有数字/颜色拓展游戏，明确其范围可能比课本更广。

### 18.2 每日任务、进度与奖励

- 家长可选每日任务来源：学校课程或单词乐园。课程来源默认取当前单元的课文、动画、单词音频各一段；优先未完成材料。
- 当天任务一旦生成保持固定，切换单元或来源从次日任务生效，首页当前单元立即更新。
- 按真实连续播放合并覆盖区间，拖动和反复播放同一区间不扩大覆盖。累计覆盖 ≥90% 且到达播放结束，首次完成该文件 +1 星；不自动认定词汇掌握。
- 课程每日任务必须当天覆盖 ≥90% 并播完；三项完成 +10 星，每天一次。奖励在片段结束才结算，避免打断最后一句。
- `Progress.curriculum` 为可选字段，包含最近材料 ID、每份材料的位置、累计覆盖、完成状态、最近学习时间及当天覆盖；`DailyTask` 增加 `kind: 'course'` 和 `assetId`。
- `Settings` 增加当前单元、每日来源和媒体语速；旧设置补默认值，旧备份仍可导入。新备份严格校验 ID、时长和覆盖区间，导入仍保留本机 PIN。
- 课程前台时间计入原有每日限时；限时后直达播放路由也受拦截。

### 18.3 媒体整理与离线

- 原件不改动；整理脚本按清单 SHA-256 校验，生成稳定英文 ID 与包含哈希的文件名。32 个实际为 M4A 的文件修正副本扩展名与 MIME，不重压缩。
- `public/course-media/` 和 `public/course-posters/` 随项目保存；构建不依赖原始中文素材目录。`src/content/curriculum.json` 是运行时清单。
- 家长可下载当前单元或整册、暂停/重试、删除离线材料；显示实际大小、完成数与错误原因。删除下载保留学习进度。
- 独立缓存 `little-words-course-v1`，显式下载校验完整响应的字节数与 SHA-256。已有正确副本跳过下载，失败可重试；按实际缓存检查状态。
- Workbox `CacheFirst` 配合 `rangeRequests`，完整媒体缓存返回正确的 206 部分响应，支持离线拖动与续播。课程不受核心预缓存 4 MiB 单文件限制。
- 离线须使用 HTTPS 生产构建版（Mac localhost 可测试）；开发热更新版与 iPad 局域网 HTTP 只作功能预览。核心 Service Worker 就绪与课程下载完成分别显示。

### 18.4 验证与后续内容校对

本地 129 项测试、类型检查、生产构建通过。桌面 Chrome 实测完整整册下载、断网冷启动、音视频播放与 Range 跳转、三个课程每日任务及一次性奖励、下载取消/失败/重试、课程备份导入导出/重置、限时拦截，以及课程横竖屏布局通过。iPad Safari 真机全屏、主屏幕离线启动与性能验收仍待执行，不以桌面模拟代替。

当前已交付原始材料播放、学习记录、课程每日任务及离线整合。逐词点读、课本专属题库、逐句跟读和动画到课文的精确对应，仍需完整词表和句段校对；不将整单元音轨或通用主题词表冒充已经校对的逐词课程。

## 20. M8 — 游戏乐园与两个新游戏

首页新增「游戏乐园」入口，集中展示所有可玩的活动。游戏乐园先选择游戏，再选择练习主题；主题页也保留快捷入口。选择主题不受地图关卡解锁限制，适合家长陪练或自由复习。

- **单词小火车（Word Train）**：系统离线播放 2 个单词的顺序，随后播放 4 轮 3 个单词的顺序。孩子按听到的顺序点击图片让乘客上车，点车厢可放回，确认后火车出发。答对每轮 +1 星，完成 6 轮额外 +5 星；答错只提示重听，不扣分。
- **英语寻宝（English Treasure）**：每轮播放完整英文提示（如 “Find the cat!”、“Find a sunny day!”），森林场景内放置 6 个同主题图片。孩子点击听到的目标，错选轻微抖动后可继续，找对后物品飞入宝箱并 +1 星；完成 6 轮额外 +5 星。
- 两个游戏均使用主题现有图片与 SVG 图形，语音片段随包提供，支持离线运行；后台、离页和奖励遮罩期间暂停。寻宝提示覆盖 80 个词并通过音频清单校验。
- 游戏乐园和新游戏使用独立路由：`#/games`、`#/games?game=train`、`#/games?game=treasure`，从主题快捷入口进入时完成页可回到游戏乐园。
- 新增单元测试覆盖两种游戏的出题、去重、答案判定、路由和 80 条寻宝提示音频完整性。


## 19. M7 — 跟读练习试用版

- 优先单词乐园：单词卡上点击「跟读这个词」即开始 `getUserMedia` + `AudioContext` 实时监听，不跳转。开始前停止示范音和自动朗读；首次使用有浏览器权限对话框。
- 检测到声音后静音约 0.85 秒自动结束，最长 5 秒；切换单词、重新播放示范音、离开或切后台都释放麦克风，权限等待中的请求也会在返回后检查是否已取消。
- 不创建录音文件或 Blob URL；家长设置默认尝试 Azure 音素评估，最多发送本次短音频，评估完成后立即释放。当前版本使用 GitHub Actions Secret 注入网页的限额试用 key；在线服务未配置、离线或请求失败时自动回退 Vosk Browser 的 WASM Worker，也可以在家长设置中固定使用 Vosk。Vosk 的最终识别结果优先，逐词置信度只做温和提示，partial 仅在没有最终词时兜底。
- Azure 首版只用音素评估结果做宽松通过判断（准确度 45 分起，低于 70 分显示温和提示），不向孩子展示分数，不写入单词掌握度；阈值需用真实儿童样本继续校准。网页 key 对访问者可见，仅用于本项目的免费额度试用，不存放儿童录音。
- 课本暂保留材料播放，隐藏旧整段跟读入口；未校对的课程材料不接入逐词练习。
- 精确发音评分仍需要音素级模型或强制对齐；Vosk 的词级识别不能单独证明发音标准。Azure 在线通道已作为试用评估接入，下一步先在真实 iPad Safari 用儿童样本比较 Azure 与 Vosk 的误判，再校准阈值和是否保留在线默认。
