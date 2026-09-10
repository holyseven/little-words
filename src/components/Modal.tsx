import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [])
  return createPortal(<div className="modal-backdrop">
    <div className="modal-panel parent-page" ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <header className="page-header"><h2>{title}</h2><div className="page-header__spacer" /><button className="icon-btn" onClick={close} aria-label="关闭">×</button></header>
      {children}
    </div>
  </div>, document.body)
}
