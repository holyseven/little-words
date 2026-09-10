import { useState } from 'react'
import { courseAssets, courseUnits } from '../content/curriculum'
import { cancelDownload, deleteCourseDownload, downloadCourse, scopeAssets, useCourseDownloads } from '../course/downloads'
import { useApp } from '../store/AppContext'
import { BigButton } from './BigButton'
import { Modal } from './Modal'
import '../pages/Course.css'

export function CourseDownloads() {
  const { settings, updateSettings, progress } = useApp()
  const downloads = useCourseDownloads()
  const [remove, setRemove] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const completed = Object.values(progress.curriculum?.media ?? {}).filter((a) => a.completed).length
  return <section className="parent-section course-downloads"><h2>学校课程 · 一年级上册</h2>
    <label className="parent-row">老师教到哪个单元<select value={settings.currentUnitId} onChange={(e) => updateSettings({ currentUnitId: e.target.value })}>{courseUnits.map((u) => <option key={u.id} value={u.id}>Unit {u.number} · {u.title} · {u.zh}</option>)}</select></label>
    <label className="parent-row">每日任务来源<select value={settings.dailySource} onChange={(e) => updateSettings({ dailySource: e.target.value as 'course' | 'themes' })}><option value="course">学校课程</option><option value="themes">单词乐园</option></select></label>
    <p className="parent-help">首页随当前单元更新。当天已经生成的任务保留，新选择从明天的任务生效；当天奖励不会重复领取。</p>
    <label className="parent-row">课文与动画速度<select value={settings.courseRate} onChange={(e) => updateSettings({ courseRate: Number(e.target.value) })}><option value="1">原速 1×</option><option value="0.85">慢一点 0.85×</option><option value="0.7">慢速 0.7×</option></select></label>
    <p>已听 / 看完 {completed} / {courseAssets.length} 份材料；已下载 {downloads.cached.length} / {courseAssets.length} 份。</p>
    <p className="parent-help">逐词点读及课本专属游戏需要校对完整词表；现在可以听原版单词音频、课文、看动画，并在单词乐园拓展练习。</p>
    {!downloads.supported && downloads.checked && <p>此地址不能下载离线材料。请使用 HTTPS 构建版；局域网 HTTP 可以在线播放。</p>}
    <div className="parent-actions">
      <BigButton disabled={!downloads.supported || downloads.busy || deleting} onClick={() => void downloadCourse(settings.currentUnitId)}>下载当前单元</BigButton>
      <BigButton disabled={!downloads.supported || downloads.busy || deleting} onClick={() => void downloadCourse('all')}>下载整册 · 约 53 MiB</BigButton>
      {downloads.busy && <BigButton onClick={cancelDownload}>暂停下载</BigButton>}
    </div>
    {downloads.busy && <div><progress aria-label="课程下载进度" max={downloads.totalBytes} value={downloads.finishedBytes} /><p>{(downloads.finishedBytes / 1048576).toFixed(1)} / {(downloads.totalBytes / 1048576).toFixed(1)} MiB</p></div>}
    {downloads.message && <p role="status">{downloads.message}</p>}
    <div className="course-download-list">{courseUnits.map((u) => {
      const assets = scopeAssets(u.id), count = assets.filter((a) => downloads.cached.includes(a.id)).length
      return <div className="course-download-row" key={u.id}><span><b>Unit {u.number} · {u.zh}</b><small>{count === assets.length ? '已可离线学习' : `已下载 ${count} / ${assets.length}`} · {(assets.reduce((n, a) => n + a.bytes, 0) / 1048576).toFixed(1)} MiB</small></span>
        <button className="btn" disabled={!downloads.supported || downloads.busy || deleting} onClick={() => void downloadCourse(u.id)}>{count === assets.length ? '检查下载' : '下载'}</button>
        <button className="btn" aria-label={`删除 Unit ${u.number} 离线材料`} disabled={!count || downloads.busy || deleting} onClick={() => setRemove(u.id)}>删除</button>
      </div>
    })}</div>
    <BigButton disabled={!downloads.cached.length || downloads.busy || deleting} onClick={() => setRemove('all')}>删除整册离线材料</BigButton>
    {remove && <Modal title="删除离线材料？" close={() => { if (!deleting) setRemove(null) }}><p>会删除{remove === 'all' ? '整册' : courseUnits.find((u) => u.id === remove)?.zh}的下载副本。星星、任务和学习记录会保留，需要时可以重新下载。</p><BigButton disabled={deleting} onClick={async () => { setDeleting(true); await deleteCourseDownload(remove); setDeleting(false); setRemove(null) }}>确认删除离线材料</BigButton></Modal>}
  </section>
}
