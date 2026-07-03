import { useEffect, useRef, useState, type ReactNode } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'

interface Props {
  snap: SheetSnap
  onSnapChange: (s: SheetSnap) => void
  header: ReactNode
  children: ReactNode
}

// สัดส่วนความสูงของ sheet ต่อ viewport
const HEIGHTS: Record<SheetSnap, number> = { peek: 0.16, half: 0.5, full: 0.9 }
const ORDER: SheetSnap[] = ['peek', 'half', 'full']

export default function BottomSheet({ snap, onSnapChange, header, children }: Props) {
  const [dragY, setDragY] = useState<number | null>(null)
  const startY = useRef(0)
  const vh = useRef(typeof window !== 'undefined' ? window.innerHeight : 800)

  useEffect(() => {
    const onResize = () => (vh.current = window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const baseHeight = HEIGHTS[snap] * vh.current
  const height = dragY != null ? Math.max(60, Math.min(vh.current * 0.92, baseHeight - dragY)) : baseHeight

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    setDragY(0)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragY == null) return
    setDragY(e.clientY - startY.current)
  }
  const onPointerUp = () => {
    if (dragY == null) return
    // เลือก snap ที่ใกล้ที่สุดกับความสูงปัจจุบัน
    const ratio = height / vh.current
    let nearest: SheetSnap = 'peek'
    let best = Infinity
    for (const s of ORDER) {
      const d = Math.abs(HEIGHTS[s] - ratio)
      if (d < best) { best = d; nearest = s }
    }
    setDragY(null)
    onSnapChange(nearest)
  }

  const cycle = () => {
    const idx = ORDER.indexOf(snap)
    onSnapChange(ORDER[(idx + 1) % ORDER.length])
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1200] rounded-t-[1.75rem] flex flex-col pb-safe border-t border-white/10"
      style={{
        height,
        background: 'rgba(14,14,16,0.86)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        boxShadow: '0 -20px 60px -20px rgba(0,0,0,0.9)',
        transition: dragY == null ? 'height 0.28s cubic-bezier(0.22,1,0.36,1)' : 'none',
      }}
    >
      {/* handle + header (แตะเพื่อสลับระดับ, ลากได้) */}
      <div
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="flex justify-center pt-3 pb-1.5" onClick={cycle}>
          <div className="w-9 h-1 rounded-full bg-white/25" />
        </div>
        <div className="px-4 pb-2">{header}</div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-4 pb-6 overscroll-contain">{children}</div>
    </div>
  )
}
