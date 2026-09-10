import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { useSfx } from '../hooks/useSfx'
import { usePageVisible } from '../hooks/useGameLoop'
import { Modal } from './Modal'
import { BigButton } from './BigButton'

export function ParentGate({ onPass, label = '家长入口' }: { onPass: () => void; label?: string }) {
  const { settings } = useApp()
  const sfx = useSfx()
  const visible = usePageVisible()
  const [open, setOpen] = useState(false)
  const [holding, setHolding] = useState(false)
  const [answer, setAnswer] = useState('')
  const [hint, setHint] = useState('')
  const [sum, setSum] = useState([0, 0])
  const timer = useRef<number>()
  const active = useRef(false)
  const passed = useRef(false)
  const cancel = () => { clearTimeout(timer.current); active.current = false; setHolding(false) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { if (!visible) { cancel(); setOpen(false); setAnswer('') } }, [visible])
  const hold = () => {
    if (active.current) return
    active.current = true
    setHolding(true)
    sfx.tap()
    timer.current = window.setTimeout(() => {
      active.current = false
      setHolding(false)
      passed.current = false
      setSum([10 + Math.floor(Math.random() * 40), 10 + Math.floor(Math.random() * 40)])
      setAnswer('')
      setHint('')
      setOpen(true)
    }, 3000)
  }
  const submit = () => {
    if (passed.current) return
    const correct = settings.parentPin ? answer === settings.parentPin : answer !== '' && Number(answer) === sum[0] + sum[1]
    if (!correct) { setHint(settings.parentPin ? 'PIN 不正确，请再试一次。' : '请再算一次。'); setAnswer(''); sfx.tap(); return }
    passed.current = true
    setOpen(false)
    setAnswer('')
    sfx.correct()
    onPass()
  }
  return <>
    <button className={`icon-btn parent-gate ${holding ? 'is-holding' : ''}`} aria-label={`${label}，长按 3 秒`} title="长按 3 秒"
      onPointerDown={(event) => { if (!event.isPrimary) return; event.currentTarget.setPointerCapture(event.pointerId); hold() }}
      onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel() }}
      onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) hold() } }}
      onKeyUp={cancel} onBlur={cancel}>
      <span aria-hidden="true">⚙️</span><span className="visually-hidden">{holding ? '请保持按住' : '长按三秒'}</span>
    </button>
    {open && <Modal title="请家长帮忙" close={() => setOpen(false)}>
      <p className="gate-question">{settings.parentPin ? '请输入 4 位家长 PIN' : `请回答：${sum[0]} + ${sum[1]} = ?`}</p>
      <output className="gate-answer" aria-live="polite" aria-label="已输入">{settings.parentPin ? '●'.repeat(answer.length) : answer || '…'}</output>
      <div className="gate-keypad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '退格'].map((key) => <button className="btn" key={key} onClick={() => {
        sfx.tap(); setAnswer((value) => key === '清空' ? '' : key === '退格' ? value.slice(0, -1) : (value + key).slice(0, settings.parentPin ? 4 : 3))
      }}>{key}</button>)}</div>
      {hint && <p role="status">{hint}</p>}
      <BigButton variant="primary" onClick={submit} disabled={!answer}>确认</BigButton>
    </Modal>}
  </>
}
