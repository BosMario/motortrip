import type { RouteData, Waypoint } from '../types'
import { formatDistance } from '../lib/format'

interface Props {
  waypoints: Waypoint[]
  route: RouteData | null
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

export default function WaypointList({ waypoints, route, onRemove, onMove }: Props) {
  if (waypoints.length === 0) {
    return (
      <p className="text-sm text-dim text-center py-6">
        ยังไม่มีจุดแวะ — ค้นหาสถานที่ด้านบน<br />หรือกด “ปักหมุด”
      </p>
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {waypoints.map((w, i) => (
        <li key={w.id} className="card-2 flex items-center gap-3 p-2.5">
          <span
            className="shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
            style={{ background: w.custom ? 'linear-gradient(135deg,#a855f7,#6d28d9)' : 'linear-gradient(135deg,#ff7a45,#ff2d55)' }}
          >
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{w.name}</div>
            {route && i > 0 && route.legs[i - 1] && (
              <div className="text-xs text-dim">
                ↳ ห่างจากจุดก่อน {formatDistance(route.legs[i - 1].distance)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onMove(w.id, -1)}
              disabled={i === 0}
              className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 disabled:opacity-25 text-sm active:scale-95 transition"
              aria-label="เลื่อนขึ้น"
            >
              ↑
            </button>
            <button
              onClick={() => onMove(w.id, 1)}
              disabled={i === waypoints.length - 1}
              className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 disabled:opacity-25 text-sm active:scale-95 transition"
              aria-label="เลื่อนลง"
            >
              ↓
            </button>
            <button
              onClick={() => onRemove(w.id)}
              className="w-9 h-9 rounded-lg btn-danger text-sm active:scale-95 transition"
              aria-label="ลบจุด"
            >
              🗑
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
