import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { themes } from '../content'
import { parkGames, type ParkGameId } from '../content/games'
import { useSfx } from '../hooks/useSfx'
import { navigate } from '../router'
import { useApp } from '../store/AppContext'
import './GamePark.css'

export function GamePark({ gameId }: { gameId?: ParkGameId }) {
  const { progress, settings } = useApp()
  const sfx = useSfx()
  const game = parkGames.find((item) => item.id === gameId)
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const open = (path: string) => { sfx.tap(); navigate(path) }
  const choices = game ? themes.filter((theme) => !game.themes.length || game.themes.some((id) => id === theme.id)) : []

  return <main className="page page-enter game-park">
    <header className="page-header">
      <BackButton to={game ? '/games' : '/'} />
      <h1>{text('游戏乐园', 'Game park')}</h1>
      <div className="page-header__spacer" />
      <StarCounter stars={progress.stars} />
    </header>
    <div className="page__body game-park__body">
      <section className="game-park__welcome" style={game ? { ['--park-tint' as string]: game.tint } : undefined}>
        <span className="emoji game-park__hero-icon" aria-hidden="true">{game?.emoji ?? '🎡'}</span>
        <div><p className="game-park__eyebrow">{game ? game.title : 'PLAY · LISTEN · DISCOVER'}</p>
          <h2>{game ? text(game.zh, 'Choose your words') : text('今天想玩什么？', 'What shall we play?')}</h2>
          <p>{game ? text('选一个主题，就出发！', 'Pick a theme and off we go!') : text('听一听、找一找、说一说，每次都有新发现。', 'Listen, find and speak. A new adventure every time.')}</p>
        </div>
      </section>
      {game ? <>
        <p className="game-park__hint">{game.id === 'restaurant' ? text('水果和食物一起练，还能数一数。', 'Practice fruit, food and counting together.') : text('自由选择练习内容，不用按关卡顺序。', 'Choose any theme to practice.')}</p>
        <div className="game-park__themes" aria-label={text('选择练习主题', 'Choose a theme')}>
          {choices.map((theme) => <button key={theme.id} className="game-park__theme" onClick={() => open(`/theme/${theme.id}/game/${game.id}?from=games`)}>
            <span className="emoji" aria-hidden="true">{theme.emoji}</span>
            <span><strong>{theme.title}</strong>{settings.showZh && <small>{theme.zh}</small>}</span>
            <span aria-hidden="true">→</span>
          </button>)}
        </div>
      </> : <div className="game-park__games" aria-label={text('选择游戏', 'Choose a game')}>
        {parkGames.map((item) => <button key={item.id} className="game-park__card" style={{ ['--park-tint' as string]: item.tint }} onClick={() => open(`/games?game=${item.id}`)}>
          <span className="emoji game-park__card-art" aria-hidden="true">{item.emoji}</span>
          <span className="game-park__card-copy"><strong>{text(item.zh, item.title)}</strong>{settings.showZh && <span lang="en">{item.title}</span>}<small>{text(item.hint, item.description)}</small></span>
          <span className="game-park__arrow" aria-hidden="true">→</span>
        </button>)}
      </div>}
    </div>
  </main>
}
