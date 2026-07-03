import { forwardRef } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance, formatDuration, formatThaiDate } from '../lib/format'

interface Props {
  name: string
  date: string
  waypoints: Waypoint[]
  route: RouteData | null
}

/**
 * การ์ดสรุปทริป — ออกแบบให้ capture หน้าจอส่งเข้ากลุ่ม LINE ได้สวย
 * ใช้ forwardRef เผื่อ Phase 2 ทำ export เป็นรูป
 */
const TripSummary = forwardRef<HTMLDivElement, Props>(({ name, date, waypoints, route }, ref) => {
  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden text-white border border-white/10 shadow-card"
      style={{ background: 'radial-gradient(130% 90% at 0% 0%, #1c1c20 0%, #0d0d0f 60%)' }}
    >
      {/* แถบ accent บนสุด */}
      <div className="h-1" style={{ background: 'linear-gradient(90deg,#ff7a45,#ff2d55)' }} />

      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] font-bold uppercase tracking-label text-brand">🏍️ SAKTECHTRIP</div>
        <h2 className="text-xl font-bold leading-tight mt-1 tracking-tight">{name || 'ทริปไม่มีชื่อ'}</h2>
        {date && <div className="text-sm text-dim mt-0.5">📅 {formatThaiDate(date)}</div>}
      </div>

      <div className="grid grid-cols-3 border-t border-white/[0.07]">
        <Stat label="จุดแวะ" value={`${waypoints.length}`} unit="จุด" />
        <Stat
          label="ระยะทาง"
          value={route ? formatDistance(route.distance).replace(' กม.', '').replace(' ม.', '') : '—'}
          unit={route && route.distance >= 1000 ? 'กม.' : 'ม.'}
        />
        <Stat label="เวลา" value={route ? formatDuration(route.duration, true) : '—'} unit="" />
      </div>

      {waypoints.length > 0 && (
        <ol className="px-4 py-3 text-sm space-y-1.5 border-t border-white/[0.07]">
          {waypoints.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2.5">
              <span
                className="w-5 h-5 shrink-0 rounded-full text-[11px] flex items-center justify-center font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#ff7a45,#ff2d55)' }}
              >
                {i + 1}
              </span>
              <span className="truncate text-white/90">{w.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
})

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="px-2 py-3.5 text-center border-r border-white/[0.07] last:border-0">
      <div className="text-[10px] uppercase tracking-label text-dim">{label}</div>
      <div className="text-lg font-bold leading-tight mt-1">
        {value}
        {unit && <span className="text-xs font-medium ml-0.5 text-dim">{unit}</span>}
      </div>
    </div>
  )
}

TripSummary.displayName = 'TripSummary'
export default TripSummary
