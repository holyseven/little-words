/**
 * 兜底页：hash 里出现未知路径时显示（不给孩子看到白屏）。
 */

import { BackButton } from '../components/BackButton'
import { Mascot } from '../components/Mascot/Mascot'

export function NotFound() {
  return (
    <main className="page page-enter" style={{ gap: 20 }}>
      <header className="page-header">
        <BackButton to="/" icon="home" />
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div style={{ width: 132 }}>
          <Mascot tappable={false} />
        </div>
        <p style={{ fontSize: 24, fontWeight: 700 }}>这里还没有内容</p>
        <p style={{ color: 'var(--text-muted)' }}>点左上角 🏠 回到首页</p>
      </div>
    </main>
  )
}
