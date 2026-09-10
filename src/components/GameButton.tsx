import { forwardRef, useRef, type ButtonHTMLAttributes } from 'react'

/** 只响应首个 pointer；取消的手势不作答，键盘仍使用原生 click。 */
export const GameButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function GameButton({ onClick, ...props }, ref) {
  const pointer = useRef<number | null>(null)
  const allowed = useRef(false)
  return <button {...props} ref={ref} type="button"
    onPointerDown={(event) => {
      if (!event.isPrimary || pointer.current !== null) return
      pointer.current = event.pointerId
      allowed.current = false
    }}
    onPointerUp={(event) => {
      if (pointer.current !== event.pointerId) return
      pointer.current = null
      allowed.current = true
    }}
    onPointerCancel={(event) => {
      if (pointer.current === event.pointerId) { pointer.current = null; allowed.current = false }
    }}
    onPointerLeave={() => {
      // 触屏会在 pointerup 和 click 之间发 pointerleave，不能取消刚完成的轻点。
      if (pointer.current !== null) { pointer.current = null; allowed.current = false }
    }}
    onClick={(event) => {
      if (event.detail !== 0 && !allowed.current) return
      allowed.current = false
      onClick?.(event)
    }}
  />
})
