import { forwardRef } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance, formatDuration, formatThaiDate } from '../lib/format'

export interface SummaryExtra {
  totalDays?: number
  fuelCost?: number
  liters?: number
  departTime?: string
  arriveTime?: string
  rainAt?: string[]
  elevGain?: number
}

interface Props {
  name: string
  date: string
  waypoints: Waypoint[]
  route: RouteData | null
  extra?: SummaryExtra
}

/** การ์ดสรุปทริป — ออกแบบให้ capture หน้าจอ/export PNG ส่งเข้ากลุ่ม LINE ได้สวย */
const TripSummary = forwardRef<HTMLDivElement, Props>(({ name, date, waypoints, route, extra }, ref) => {
  const e = extra || {}
  const multiDay = (e.totalDays || 1) > 1

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden text-white border border-white/10 shadow-card"
      style={{ background: 'radial-gradient(130% 90% at 0% 0%, #1c1c20 0%, #0d0d0f 60%)' }}
    >
      <div className="h-1" style={{ background: 'linear-gradient(90deg,var(--g1),var(--g2))' }} />

      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] font-bold uppercase tracking-label text-brand">🏍️ SAKTECHTRIP</div>
        <h2 className="text-xl font-bold leading-tight mt-1 tracking-tight">{name || 'ทริปไม่มีชื่อ'}</h2>
        <div className="text-sm text-dim mt-0.5 flex flex-wrap gap-x-2">
          {date && <span>📅 {formatThaiDate(date)}</span>}
          {multiDay && <span>· 🗓️ {e.totalDays} วัน</span>}
        </div>
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

      {/* รายละเอียดเพิ่มเติม */}
      {(e.fuelCost != null || e.departTime || e.elevGain != null) && (
        <div className="grid grid-cols-3 border-t border-white/[0.07]">
          {e.fuelCost != null && (
            <Stat label="💸 ค่าน้ำมัน" value={`฿${Math.round(e.fuelCost).toLocaleString()}`} unit={e.liters ? `${e.liters.toFixed(1)}ล.` : ''} />
          )}
          {e.departTime && <Stat label="⏰ ออก–ถึง" value={e.departTime} unit={e.arriveTime ? `→ ${e.arriveTime}` : ''} />}
          {e.elevGain != null && <Stat label="⛰️ ไต่ระดับ" value={`${e.elevGain.toLocaleString()}`} unit="ม." />}
        </div>
      )}

      {e.rainAt && e.rainAt.length > 0 && (
        <div className="px-4 py-2 text-xs bg-blue-500/15 border-t border-white/[0.07] text-blue-200">
          ☔ เตรียมชุดกันฝน — ฝนช่วง {e.rainAt.join(', ')}
        </div>
      )}

      {waypoints.length > 0 && (
        <ol className="px-4 py-3 text-sm space-y-1.5 border-t border-white/[0.07]">
          {waypoints.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2.5">
              <span
                className="w-5 h-5 shrink-0 rounded-full text-[11px] flex items-center justify-center font-bold text-white"
                style={{ background: 'linear-gradient(135deg,var(--g1),var(--g2))' }}
              >
                {i + 1}
              </span>
              <span className="truncate text-white/90">{w.name}</span>
              {w.overnight && <span className="text-xs">🌙</span>}
            </li>
          ))}
        </ol>
      )}

      <div className="px-4 py-2 text-[10px] text-dim border-t border-white/[0.07] flex items-center justify-between">
        <span>สร้างด้วย SAKTECHTRIP 🏍️</span>
        <span>moto-trip-planner.pages.dev</span>
      </div>
    </div>
  )
})

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="px-2 py-3.5 text-center border-r border-white/[0.07] last:border-0">
      <div className="text-[10px] uppercase tracking-label text-dim">{label}</div>
      <div className="text-base font-bold leading-tight mt-1">
        {value}
        {unit && <span className="text-[11px] font-medium ml-0.5 text-dim">{unit}</span>}
      </div>
    </div>
  )
}

TripSummary.displayName = 'TripSummary'
export default TripSummary
