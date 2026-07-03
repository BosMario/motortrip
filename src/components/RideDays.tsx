import { useEffect, useState } from 'react'
import { fetchRideDays, type RideDay } from '../lib/weather'

interface Props {
  lat: number
  lng: number
  startName: string
  tripDate?: string
  onPickDate?: (iso: string) => void
}

function scoreColor(score: number): string {
  if (score >= 80) return '#34d399' // emerald
  if (score >= 62) return '#a3e635' // lime
  if (score >= 42) return '#fbbf24' // amber
  return '#fb7185' // rose
}

export default function RideDays({ lat, lng, startName, tripDate, onPickDate }: Props) {
  const [days, setDays] = useState<RideDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError('')
    fetchRideDays(lat, lng, ac.signal)
      .then(setDays)
      .catch((e) => {
        if (e.name !== 'AbortError') setError('ดึงพยากรณ์ไม่สำเร็จ')
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [lat, lng])

  const best = days.length ? days.reduce((a, b) => (b.score > a.score ? b : a)) : null

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="label">🌤️ ควรไปวันไหน (7 วัน)</div>
        <div className="text-[11px] text-dim truncate max-w-[45%]">📍 {startName}</div>
      </div>

      {loading ? (
        <div className="flex gap-2 overflow-hidden py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[68px] h-28 rounded-xl bg-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-dim py-2">{error}</p>
      ) : (
        <>
          {best && (
            <div className="text-sm mb-2 flex items-center gap-1.5">
              <span>วันที่เหมาะสุดคือ</span>
              <span className="font-bold text-brand">
                {best.dow} {new Date(best.date + 'T00:00:00').getDate()}
              </span>
              <span className="text-dim">· {best.rating} {best.emoji}</span>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {days.map((d) => {
              const dnum = new Date(d.date + 'T00:00:00').getDate()
              const isBest = best?.date === d.date
              const isPicked = tripDate === d.date
              const col = scoreColor(d.score)
              return (
                <button
                  key={d.date}
                  onClick={() => onPickDate?.(d.date)}
                  className={`shrink-0 w-[70px] rounded-xl p-2 border text-center transition active:scale-95 ${
                    isPicked ? 'border-brand shadow-glow' : isBest ? 'border-white/25' : 'border-white/10'
                  }`}
                  style={{ background: isBest ? 'linear-gradient(180deg,rgba(255,255,255,.08),transparent)' : 'rgba(255,255,255,0.03)' }}
                >
                  <div className="text-[11px] text-dim">
                    {d.dow} {dnum}
                  </div>
                  <div className="text-2xl my-0.5">{d.emoji}</div>
                  {/* วงคะแนน */}
                  <div className="relative w-10 h-10 mx-auto my-1">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke={col}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${(d.score / 100) * 94.2} 94.2`}
                      />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-[11px] font-bold" style={{ color: col }}>
                      {d.score}
                    </span>
                  </div>
                  <div className="text-[10px] text-dim">💧{d.rainProb ?? 0}%</div>
                  <div className="text-[10px] text-dim">{Math.round(d.tempMax ?? 0)}°</div>
                  {isBest && <div className="text-[9px] font-bold mt-0.5 text-emerald-300">ดีสุด</div>}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-dim mt-1">แตะวันเพื่อตั้งเป็นวันเดินทาง · คะแนนคิดจากฝน/ลม/อุณหภูมิ</p>
        </>
      )}
    </div>
  )
}
