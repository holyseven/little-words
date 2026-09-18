import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { defaultSettings } from '../store/settings'
import { emptyProgress, flushProgress } from '../store/progress'
import { themes } from '../content'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { ParentGate } from '../components/ParentGate'
import { Modal } from '../components/Modal'
import { createBackup, parseBackup } from '../logic/backup'
import { getEnglishVoices, setVoiceName, speak } from '../audio/tts'
import { audioVoiceName, stopClip } from '../audio/clips'
import { unlockAudio } from '../audio/audioUnlock'
import { useVoice } from '../hooks/useVoice'
import pkg from '../../package.json'
import { CourseDownloads } from '../components/CourseDownloads'
import { checkForAppUpdate, type AppUpdateStatus } from '../pwa/updates'
import './Parent.css'

const updateMessages: Record<AppUpdateStatus, string> = {
  current: '已检查更新，目前没有待安装的新版本。',
  updating: '发现新版本，正在更新，完成后会自动刷新。',
  offline: '目前离线，请连接网络后再检查。',
  unavailable: '更新服务尚未就绪，请联网刷新后再试。',
  error: '暂时无法检查更新，请稍后重试。',
}

export function Parent() {
  const { parentAuthorized, authorizeParent } = useApp()
  if (!parentAuthorized) return <main className="page page-enter parent-page">
    <header className="page-header"><BackButton to="/" /><h1>家长空间</h1></header>
    <div className="page__body parent-gate-page"><p>请长按齿轮 3 秒，再完成验证。</p><ParentGate onPass={authorizeParent} /></div>
  </main>
  return <ParentSettings />
}

function ParentSettings() {
  const { progress, settings, updateSettings, replaceData } = useApp()
  const { sayWord } = useVoice()
  const [voices, setVoices] = useState(getEnglishVoices)
  const [sort, setSort] = useState('wrong')
  const [pin, setPin] = useState('')
  const [pinAgain, setPinAgain] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [resetStep, setResetStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [offline, setOffline] = useState({ online: navigator.onLine, ready: false, usage: 0 })
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const refresh = () => setVoices(getEnglishVoices())
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    const delayed = setTimeout(refresh, 800)
    return () => { clearTimeout(delayed); window.speechSynthesis?.removeEventListener('voiceschanged', refresh); stopClip() }
  }, [])
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      let ready = false, usage = 0
      try {
        const registrations = await navigator.serviceWorker?.getRegistrations()
        ready = !!registrations?.some((r) => r.active)
        usage = (await navigator.storage?.estimate())?.usage ?? 0
      } catch { /* HTTP 局域网或隐私模式也能查看家长页。 */ }
      if (alive) setOffline({ ready, usage, online: navigator.onLine })
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 5000)
    window.addEventListener('online', refresh); window.addEventListener('offline', refresh)
    return () => { alive = false; clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh) }
  }, [])
  const stats = useMemo(() => themes.flatMap((theme) => theme.words.map((word) => ({ theme, word, stat: progress.wordStats[word.id] })))
    .sort((a, b) => sort === 'word' ? a.word.text.localeCompare(b.word.text) : (b.stat?.[sort as 'wrong' | 'correct'] ?? 0) - (a.stat?.[sort as 'wrong' | 'correct'] ?? 0)), [progress.wordStats, sort])
  const exportData = async () => {
    await flushProgress()
    const blob = new Blob([JSON.stringify(createBackup(progress, settings), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `little-words-backup-${progress.daily.date.replace(/-/g, '')}.json`
    document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    setMessage('备份已生成。请在下载或分享菜单中保存 JSON 文件。')
  }
  const importData = async (selected?: File) => {
    if (!selected) return
    try {
      if (selected.size > 1024 * 1024) throw new Error('文件超过 1 MB，请选择 Little Words 的 JSON 备份。')
      setPending(parseBackup(await selected.text()))
      setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法读取备份，当前进度没有改变。') }
    if (file.current) file.current.value = ''
  }
  const replace = async (reset: boolean) => {
    if (busy || (!reset && !pending)) return
    setBusy(true)
    try {
      await replaceData(reset ? emptyProgress() : pending!.progress, reset
        ? { ...defaultSettings, persisted: settings.persisted }
        : { ...settings, ...pending!.settings, parentPin: settings.parentPin, persisted: settings.persisted })
      setPending(null); setResetStep(0); setPin(''); setPinAgain('')
      setMessage(reset ? '学习进度和设置已重置。' : '备份已导入，星星、主题和设置已更新。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，原进度没有改变。')
      setPending(null); setResetStep(0)
    } finally { setBusy(false) }
  }
  const checkUpdate = async () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    setUpdateMessage('正在检查更新…')
    try {
      await flushProgress()
      setUpdateMessage(updateMessages[await checkForAppUpdate()])
    } catch {
      setUpdateMessage('暂时无法检查更新，请稍后重试。')
    } finally { setCheckingUpdate(false) }
  }
  return <main className="page page-enter parent-page">
    <header className="page-header"><BackButton to="/" /><h1>家长空间</h1></header>
    <div className="page__body parent-content">
      <section className="parent-section"><h2>学习概览</h2>
        <div className="parent-overview"><p><b>{progress.stars}</b> 颗星星</p><p><b>{progress.badges.length} / 8</b> 个主题</p><p><b>{Math.floor(progress.daily.usedMs / 60000)}</b> 分钟 · 今日</p></div>
        <p>今日任务 {progress.daily.done.length} / 3；额外时长 {Math.floor(progress.daily.bonusMs / 60000)} 分钟。</p>
      </section>
      <CourseDownloads />
      <section className="parent-section"><h2>学习设置</h2>
        <Toggle label="中文提示" value={settings.showZh} change={(showZh) => updateSettings({ showZh })} />
        <Toggle label="游戏音效" value={settings.sfx} change={(sfx) => updateSettings({ sfx })} />
        <Toggle label="解锁全部主题" value={settings.unlockAll} change={(unlockAll) => updateSettings({ unlockAll })} />
        <label className="parent-row">外观<select value={settings.appearance} onChange={(e) => updateSettings({ appearance: e.target.value as typeof settings.appearance })}><option value="auto">自动</option><option value="day">白天</option><option value="night">夜间</option></select></label>
        <p className="parent-help">自动模式：跟随系统深色外观，或在 19:00–7:00 使用暖色夜间背景。</p>
        <label className="parent-row">每日学习时长<select value={settings.dailyLimitMin} onChange={(e) => updateSettings({ dailyLimitMin: Number(e.target.value) })}>{[10, 15, 20, 30, 0].map((n) => <option key={n} value={n}>{n ? `${n} 分钟` : '关闭限制'}</option>)}</select></label>
        <p className="parent-help">只统计前台学习时间；家长空间和休息页不计时。达到上限后，验证家长身份可再加 10 分钟。</p>
        <label className="parent-row">朗读速度：{settings.rate.toFixed(2)}<input aria-label="朗读速度" type="range" min="0.7" max="1" step="0.05" value={settings.rate} onChange={(e) => updateSettings({ rate: Number(e.target.value) })} /></label>
        <p className="parent-help">日常发音：已打包的 {audioVoiceName} 录音，离线可用。</p>
        <BigButton onClick={() => { unlockAudio(); sayWord(themes[0].words[0]) }}>试听单词</BigButton>
        <label className="parent-row">备用英文语音<select value={settings.voiceName ?? ''} onChange={(e) => updateSettings({ voiceName: e.target.value || undefined })}><option value="">自动选择</option>{voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name} · {v.lang}</option>)}</select></label>
        <p className="parent-help">仅在录音缺失时使用备用语音。选择设备内置语音可保证备用发音离线可用。</p>
        {voices.length === 0 ? <p role="status">设备未安装可用英文语音，请在 设置→辅助功能→朗读内容 中下载。已打包的录音仍可使用。</p>
          : <BigButton onClick={() => { unlockAudio(); stopClip(); setVoiceName(settings.voiceName); speak('The cat is sleeping.', { rate: settings.rate }) }}>试听备用语音</BigButton>}
        <label className="parent-row">跟读评估<select value={settings.repeatEngine} onChange={(e) => updateSettings({ repeatEngine: e.target.value as 'azure' | 'vosk' })}><option value="azure">在线音素评估（默认）</option><option value="vosk">本地离线识别</option></select></label>
        <p className="parent-help">默认先尝试在线评估，能更细地看音素；网络或在线服务不可用时会自动用本地 Vosk，不保存录音。在线试用需要在本地代理配置 Azure 密钥，GitHub Pages 会自动使用本地模式。</p>
      </section>
      <section className="parent-section"><h2>家长门</h2><p>当前验证方式：{settings.parentPin ? '4 位 PIN' : '随机加法'}。离开家长空间或切到后台后需要重新验证。</p>
        <label className="parent-row">新 PIN<input aria-label="新 PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="parent-row">再次输入 PIN<input aria-label="再次输入 PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pinAgain} onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ''))} /></label>
        <div className="parent-actions"><BigButton disabled={pin.length !== 4 || pin !== pinAgain} onClick={() => { updateSettings({ parentPin: pin }); setPin(''); setPinAgain(''); setMessage('家长 PIN 已保存。') }}>保存 PIN</BigButton>
          {settings.parentPin && <BigButton onClick={() => { updateSettings({ parentPin: undefined }); setMessage('已改为随机加法验证。') }}>改用加法验证</BigButton>}</div>
        <p className="parent-help">请记住 PIN；备份不会导出或覆盖本机 PIN。</p>
      </section>
      <section className="parent-section"><h2>学习记录</h2><label className="parent-row">排序<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="wrong">错误次数最多</option><option value="correct">正确次数最多</option><option value="word">单词字母顺序</option></select></label>
        <div className="parent-table"><table><thead><tr><th>单词</th><th>正确</th><th>错误</th><th>见过</th></tr></thead><tbody>{stats.map(({ word, stat }) => <tr key={word.id}><th scope="row">{word.text}<small>{word.zh}</small></th><td>{stat?.correct ?? 0}</td><td>{stat?.wrong ?? 0}</td><td>{stat?.seen ?? 0}</td></tr>)}</tbody></table></div>
      </section>
      <section className="parent-section"><h2>备份与数据</h2><p>导入会覆盖进度和学习设置。建议先导出当前备份。</p>
        <div className="parent-actions"><BigButton onClick={() => void exportData()}>导出进度</BigButton><BigButton onClick={() => file.current?.click()}>导入进度</BigButton><BigButton onClick={() => setResetStep(1)}>重置全部</BigButton></div>
        <input ref={file} className="visually-hidden" tabIndex={-1} type="file" accept="application/json,.json" aria-label="选择进度备份" onChange={(e) => void importData(e.target.files?.[0])} />
      </section>
      {message && <p className="parent-message" role="status">{message}</p>}
      <section className="parent-section"><h2>关于与离线状态</h2><p>Little Words · {pkg.version}</p><p>网络：{offline.online ? '已连接' : '离线'}</p><p>离线缓存：{offline.ready ? 'Service Worker 已就绪' : '尚未就绪'}</p><p>持久化存储：{settings.persisted ? '已获准' : '未获准，建议定期导出备份'}</p><p>站点存储占用：{(offline.usage / 1024 / 1024).toFixed(1)} MB</p>
        <p>版本标记：{import.meta.env.DEV ? '本地开发预览' : import.meta.env.VITE_BUILD_ID}</p>
        {!import.meta.env.DEV && <>
          <div className="parent-actions"><BigButton disabled={checkingUpdate} onClick={() => void checkUpdate()}>{checkingUpdate ? '正在检查…' : '检查更新'}</BigButton></div>
          <p className="parent-help">联网后检查最新版本；学习进度和已下载的课程会保留。</p>
          {updateMessage && <p role="status">{updateMessage}</p>}
        </>}
        {!offline.ready && <p>开发模式不安装离线缓存。iPad 离线使用需要首次联网打开 HTTPS 构建版本，等待缓存完成，再添加到主屏幕。</p>}
        <p>进度只保存在本机，没有账号、广告或数据上报。</p>
      </section>
    </div>
    {pending && <Modal title="确认导入备份" close={() => { if (!busy) setPending(null) }}><p>将使用备份中的 {pending.progress.stars} 颗星、{pending.progress.badges.length} 个已完成主题，覆盖当前 {progress.stars} 颗星的进度{pending.settings ? '及学习设置' : ''}。本机 PIN 保持不变。</p><BigButton disabled={busy} variant="primary" onClick={() => void replace(false)}>确认覆盖并导入</BigButton></Modal>}
    {resetStep > 0 && <Modal title={resetStep === 1 ? '重置全部数据？' : '再次确认重置'} close={() => { if (!busy) setResetStep(0) }}><p>{resetStep === 1 ? '星星、贴纸、徽章、学习记录和设置都将清空。请先导出备份。' : '确认后不能撤销，将从第一个主题重新开始。'}</p><BigButton disabled={busy} onClick={() => resetStep === 1 ? setResetStep(2) : void replace(true)}>{resetStep === 1 ? '继续重置' : '确定重置全部'}</BigButton></Modal>}
  </main>
}

function Toggle({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) {
  return <div className="parent-row"><span>{label}</span><button role="switch" aria-label={label} aria-checked={value} className={`parent-switch ${value ? 'is-on' : ''}`} onClick={() => change(!value)}>{value ? '开' : '关'}</button></div>
}
