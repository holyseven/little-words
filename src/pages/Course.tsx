import { courseAssets, courseUnits, courseURL, formatDuration, getCourseAsset, getCourseUnit, unitAssets, type CourseAsset } from '../content/curriculum'
import { useApp } from '../store/AppContext'
import { navigate } from '../router'
import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { BigButton } from '../components/BigButton'
import { NotFound } from './NotFound'
import { useCourseDownloads } from '../course/downloads'
import './Course.css'

export function CourseHome() {
  const { settings, progress } = useApp()
  const current = getCourseUnit(settings.currentUnitId) ?? courseUnits[0]!
  const previous = getCourseAsset(progress.curriculum?.lastAssetId)
  return <div className="course-home">
    <section className="course-hero"><span className="course-eyebrow">{settings.showZh ? '一年级上册 · 和学校一起学' : 'Grade 1 · Term 1'}</span><div className="course-hero-title"><span className="emoji" aria-hidden="true">{current.emoji}</span><div><h2>Unit {current.number} · {current.title}</h2>{settings.showZh && <p>{current.zh}</p>}</div></div>
      <BigButton variant="primary" icon="▶" onClick={() => navigate(`/course/unit/${current.id}`)}>{settings.showZh ? '继续今天的课' : 'Today’s lesson'}</BigButton>
      {previous && previous.unitId === current.id && <button className="course-resume" onClick={() => navigate(`/course/play/${previous.id}`)}>{settings.showZh ? '接着上次：' : 'Continue: '}{previous.pageLabel} {settings.showZh ? previous.title : previous.titleEn} · {formatDuration(progress.curriculum!.media[previous.id]!.position)}</button>}
    </section>
    <h2>{settings.showZh ? '我的课本' : 'My textbook'}</h2>
    <div className="course-unit-grid">{courseUnits.map((unit) => {
      const assets = unitAssets(unit.id), done = assets.filter((a) => progress.curriculum?.media[a.id]?.completed).length
      return <button className={`course-unit-card ${unit.id === current.id ? 'is-current' : ''}`} key={unit.id} onClick={() => navigate(`/course/unit/${unit.id}`)}>
        <span className="emoji" aria-hidden="true">{unit.emoji}</span><span><small>Unit {unit.number}{unit.id === current.id ? ' · ★' : ''}</small><b>{unit.title}</b>{settings.showZh && <span>{unit.zh}</span>}<small>{done} / {assets.length} {settings.showZh ? '已听 / 看完' : 'completed'}</small></span>
      </button>
    })}</div>
    <BigButton icon="📚" onClick={() => navigate('/course/extras')}>{settings.showZh ? '复习合集与拓展阅读' : 'Review & extra stories'}</BigButton>
  </div>
}

export function CourseUnitPage({ unitId }: { unitId: string }) {
  const { settings, progress } = useApp()
  const unit = getCourseUnit(unitId)
  const downloads = useCourseDownloads()
  if (!unit) return <NotFound />
  const assets = unitAssets(unit.id)
  const groups = [
    { kind: 'lesson-audio', title: settings.showZh ? '听课文' : 'Listen', icon: '👂' },
    { kind: 'animation', title: settings.showZh ? '看动画' : 'Watch', icon: '🎬' },
    { kind: 'vocabulary-audio', title: settings.showZh ? '单词跟读' : 'Words', icon: '🔊' },
  ]
  return <main className="page page-enter course-page"><header className="page-header"><BackButton to="/" /><h1>Unit {unit.number}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body course-content"><div className="course-heading"><span className="emoji" aria-hidden="true">{unit.emoji}</span><div><h2>{unit.title}</h2>{settings.showZh && <p>{unit.zh} · 一年级上册</p>}</div></div>
      <p className="course-status">{assets.every((a) => downloads.cached.includes(a.id)) ? (settings.showZh ? '✓ 本单元已可离线学习' : '✓ Ready offline') : (settings.showZh ? '请家长在设置中下载，可离线学习' : 'Ask a parent to download for offline use')}</p>
      {groups.map((group) => <section className="course-section" key={group.kind}><h2>{group.icon} {group.title}</h2><div className={group.kind === 'animation' ? 'course-video-grid' : 'course-asset-list'}>{assets.filter((a) => a.kind === group.kind).map((asset) => <CourseAssetCard key={asset.id} asset={asset} cached={downloads.cached.includes(asset.id)} />)}</div></section>)}
      {(unit.number === 2 || unit.number === 6) && <section className="course-section"><h2>{settings.showZh ? '再玩一会儿' : 'More to explore'}</h2><p className="course-status">{settings.showZh ? '单词乐园里的数字与颜色小游戏，练习范围可能比课本更广。' : 'Explore more words in the word garden.'}</p><BigButton onClick={() => navigate(`/theme/${unit.number === 2 ? 'numbers' : 'colors'}`)}>{settings.showZh ? '打开拓展小游戏' : 'Open word games'}</BigButton></section>}
    </div>
  </main>
}

export function CourseExtras() {
  const { settings } = useApp()
  const downloads = useCourseDownloads()
  return <main className="page page-enter course-page"><header className="page-header"><BackButton to="/" /><h1>{settings.showZh ? '复习与拓展' : 'Review & stories'}</h1></header><div className="page__body course-content">
    {['compilation-audio', 'appendix-audio'].map((kind) => <section className="course-section" key={kind}><h2>{kind === 'compilation-audio' ? (settings.showZh ? '📚 复习合集' : '📚 Review') : (settings.showZh ? '🌱 拓展阅读与活动' : '🌱 Extra stories & activities')}</h2><div className="course-asset-list">{courseAssets.filter((a) => a.kind === kind).map((asset) => <CourseAssetCard key={asset.id} asset={asset} cached={downloads.cached.includes(asset.id)} />)}</div></section>)}
  </div></main>
}

function CourseAssetCard({ asset, cached }: { asset: CourseAsset; cached: boolean }) {
  const { progress, settings } = useApp()
  const state = progress.curriculum?.media[asset.id]
  const title = settings.showZh ? asset.title : asset.titleEn
  return <button className={`course-asset ${asset.poster ? 'has-poster' : ''}`} onClick={() => navigate(`/course/play/${asset.id}`)} aria-label={`${asset.pageLabel ?? ''} ${title}`}>
    {asset.poster ? <img src={courseURL(asset.poster)} alt="" loading="lazy" /> : <span className="emoji" aria-hidden="true">{asset.kind === 'vocabulary-audio' ? '🔤' : '🔊'}</span>}
    <span className="course-asset-text"><b>{asset.pageLabel && <small>{asset.pageLabel}</small>}{title}</b><small>{formatDuration(asset.duration)}{cached ? ' · ↓' : ''}{state?.completed ? (settings.showZh ? ' · ✓ 已完成' : ' · ✓') : state?.position ? ` · ${formatDuration(state.position)}` : ''}</small></span><span aria-hidden="true">▶</span>
  </button>
}
