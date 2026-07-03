import { useRef, useState } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance } from '../lib/format'

interface Props {
  waypoints: Waypoint[]
  route: RouteData | null
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
}

export default function WaypointList({ waypoints, route, onRemove, onReorder }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])

  if (waypoints.length === 0) {
    return (
      <p className="text-sm text-dim text-center py-6">
        ยังไม่มีจุดแวะ — ค้นหาสถานที่ด้านบน<br />หรือกด “ปักหมุด”
      </p>
    )
  }

  const onGripDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragIdx(i)
    setOverIdx(i)
  }
  const onGripMove = (e: React.PointerEvent) => {
    if (dragIdx == null) return
    const y = e.clientY
    // หาแถวที่ pointer อยู่เหนือ (เทียบกับกึ่งกลางแต่ละแถว)
    let target = waypoints.length - 1
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (y < r.top + r.height / 2) {
        target = i
        break
      }
    }
    setOverIdx(target)
  }
  const onGripUp = () => {
    if (dragIdx != null && overIdx != null && dragIdx !== overIdx) onReorder(dragIdx, overIdx)
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <ol className="flex flex-col gap-2">
      {waypoints.map((w, i) => (
        <li
          key={w.id}
          ref={(el) => (itemRefs.current[i] = el)}
          className={`card-2 flex items-center gap-2 p-2.5 transition ${
            dragIdx === i ? 'opacity-60 scale-[0.98] ring-1 ring-brand' : ''
          } ${overIdx === i && dragIdx !== null && dragIdx !== i ? 'ring-1 ring-brand/60' : ''}`}
        >
          {/* grip ลากเพื่อสลับลำดับ */}
          <button
            onPointerDown={onGripDown(i)}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            className="shrink-0 w-7 h-9 -ml-1 flex items-center justify-center text-dim touch-none cursor-grab active:cursor-grabbing"
            aria-label="ลากเพื่อสลับลำดับ"
          >
            ⠿
          </button>
          <span
            className="shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
            style={{ background: w.custom ? 'linear-gradient(135deg,#a855f7,#6d28d9)' : 'linear-gradient(135deg,#ff7a45,#ff2d55)' }}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{w.name}</div>
            {route && i > 0 && route.legs[i - 1] && (
              <div className="text-xs text-dim">↳ ห่างจากจุดก่อน {formatDistance(route.legs[i - 1].distance)}</div>
            )}
          </div>
          <button
            onClick={() => onRemove(w.id)}
            className="w-9 h-9 shrink-0 rounded-lg btn-danger text-sm active:scale-95 transition"
            aria-label="ลบจุด"
          >
            🗑
          </button>
        </li>
      ))}
    </ol>
  )
}
