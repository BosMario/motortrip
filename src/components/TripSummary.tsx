import { forwardRef, Fragment } from 'react'
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
  bikeName?: string
}

interface Props {
  name: string
  date: string
  waypoints: Waypoint[]
  route: RouteData | null
  extra?: SummaryExtra
  weatherEmojis?: (string | undefined)[]
}

/** การ์ดสรุปทริป — ออกแบบให้ export PNG ส่งเข้ากลุ่ม LINE ได้สวย */
const TripSummary = forwardRef<HTMLDivElement, Props>(({ name, date, waypoints, route, extra, weatherEmojis }, ref) => {
  const e = extra || {}
  const multiDay = (e.totalDays || 1) > 1

  // แบ่งวัน
  let d = 1
  const dayOf = waypoints.map((w) => {
    const cur = d
    if (w.overnight) d++
    return cur
  })

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden text-white border border-white/10 shadow-card"
      style={{ background: 'radial-gradient(130% 90% at 100% 0%, #23232a 0%, #141416 45%, #0c0c0e 100%)' }}
    >
      {/* Header */}
      <div className="relative px-4 pt-4 pb-4 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-25 blur-2xl" style={{ background: 'radial-gradient(circle, var(--g2), transparent 70%)' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full grid place-items-center text-[10px]" style={{ background: 'linear-gradient(135deg,var(--g1),var(--g2))' }}>🏍️</span>
            <span className="text-[11px] font-bold uppercase tracking-label">SAKTECHTRIP</span>
          </div>
          {multiDay && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg,var(--g1),var(--g2))' }}>
              🗓️ {e.totalDays} วัน
            </span>
          )}
        </div>
        <h2 className="relative text-2xl font-bold leading-tight mt-2 tracking-tight">{name || 'ทริปไม่มีชื่อ'}</h2>
        <div className="relative text-sm text-dim mt-1 flex flex-wrap gap-x-2">
          {date && <span>📅 {formatThaiDate(date)}</span>}
          {e.bikeName && <span>· 🏍️ {e.bikeName}</span>}
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2">
        <HeroStat label="ระยะทางรวม" value={route ? formatDistance(route.distance) : '—'} accent />
        <HeroStat label="เวลา (เผื่อพัก)" value={route ? formatDuration(route.duration, true) : '—'} />
      </div>
      <div className="grid grid-cols-3 border-t border-white/[0.07]">
        <MiniStat label="จุดแวะ" value={`${waypoints.length}`} />
        {e.fuelCost != null ? (
          <MiniStat label="💸 ค่าน้ำมัน" value={`฿${Math.round(e.fuelCost).toLocaleString()}`} sub={e.liters ? `${e.liters.toFixed(1)} ล.` : ''} />
        ) : (
          <MiniStat label="จุดแวะ" value={`${waypoints.length}`} />
        )}
        {e.departTime ? (
          <MiniStat label="⏰ ออก–ถึง" value={e.departTime} sub={e.arriveTime ? `→ ${e.arriveTime}` : ''} />
        ) : e.elevGain != null ? (
          <MiniStat label="⛰️ ไต่ระดับ" value={`${e.elevGain.toLocaleString()} ม.`} />
        ) : (
          <MiniStat label="—" value="—" />
        )}
      </div>

      {e.rainAt && e.rainAt.length > 0 && (
        <div className="px-4 py-2.5 text-xs bg-blue-500/15 border-t border-white/[0.07] text-blue-200 flex items-start gap-1.5">
          <span>☔</span>
          <span>เตรียมชุดกันฝน — ฝนช่วง {e.rainAt.join(', ')}</span>
        </div>
      )}

      {/* Route timeline */}
      {waypoints.length > 0 && (
        <ol className="px-4 pt-3 pb-1 border-t border-white/[0.07]">
          {waypoints.map((w, i) => {
            const isLast = i === waypoints.length - 1
            const leg = route && i > 0 ? route.legs[i - 1] : null
            const wx = weatherEmojis?.[i]
            const showDay = multiDay && (i === 0 || dayOf[i] !== dayOf[i - 1])
            return (
              <Fragment key={w.id}>
                {showDay && <li className="text-[11px] font-bold text-brand mb-1 mt-1 first:mt-0">🗓️ วันที่ {dayOf[i]}</li>}
                <li className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="w-6 h-6 shrink-0 rounded-full text-[11px] flex items-center justify-center font-bold text-white"
                      style={{ background: w.custom ? 'linear-gradient(135deg,#a855f7,#6d28d9)' : 'linear-gradient(135deg,var(--g1),var(--g2))' }}
                    >
                      {i + 1}
                    </span>
                    {!isLast && <span className="w-0.5 flex-1 min-h-[18px] my-0.5" style={{ background: 'repeating-linear-gradient(180deg,rgba(255,255,255,.25) 0 3px,transparent 3px 7px)' }} />}
                  </div>
                  <div className="flex-1 min-w-0 pb-2.5">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <span className="truncate">{w.name}</span>
                      {wx && <span>{wx}</span>}
                      {w.overnight && <span className="text-xs">🌙</span>}
                    </div>
                    {leg && <div className="text-[11px] text-dim mt-0.5">↳ {formatDistance(leg.distance)} จากจุดก่อน</div>}
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ol>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 text-[10px] text-dim border-t border-white/[0.07] flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <span className="font-semibold">สร้างด้วย SAKTECHTRIP 🏍️</span>
        <span>moto-trip-planner.pages.dev</span>
      </div>
    </div>
  )
})

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-4 py-3 border-r border-white/[0.07] last:border-0">
      <div className="text-[10px] uppercase tracking-label text-dim">{label}</div>
      <div className={`text-2xl font-bold tracking-tight mt-0.5 ${accent ? 'text-brand' : ''}`}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-2 py-2.5 text-center border-r border-white/[0.07] last:border-0">
      <div className="text-[9px] uppercase tracking-label text-dim truncate">{label}</div>
      <div className="text-sm font-bold leading-tight mt-1">
        {value}
        {sub && <span className="text-[10px] font-medium ml-0.5 text-dim">{sub}</span>}
      </div>
    </div>
  )
}

TripSummary.displayName = 'TripSummary'
export default TripSummary
