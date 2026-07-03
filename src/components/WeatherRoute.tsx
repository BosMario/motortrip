import { useEffect, useRef, useState } from 'react'
import { fetchRouteWeather, type RouteWeatherPoint } from '../lib/weather'

interface Props {
  coords: [number, number][]
  distanceM: number
  durationS: number
  tripDate: string
}

function depart(): string {
  try {
    return JSON.parse(localStorage.getItem('moto-estimate-v2') || '{}').depart || '07:00'
  } catch {
    return '07:00'
  }
}

export default function WeatherRoute({ coords, distanceM, durationS, tripDate }: Props) {
  const [pts, setPts] = useState<RouteWeatherPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ctrl = useRef<AbortController | null>(null)
  const lastSig = useRef('')
  const sig = coords.length ? `${coords.length}|${distanceM}|${tripDate}` : ''

  const load = async () => {
    if (coords.length < 2 || durationS <= 0) return
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    setLoading(true)
    setError('')
    try {
      setPts(await fetchRouteWeather(coords, distanceM, durationS, depart(), tripDate, ac.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('ดึงพยากรณ์ตามเส้นทางไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (coords.length >= 2 && durationS > 0 && sig !== lastSig.current) {
      lastSig.current = sig
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, durationS])

  const rainy = pts.filter((p) => (p.rainProb ?? 0) >= 60)

  if (coords.length < 2) return null

  return (
    <div className="card p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="label">🌧️ อากาศตามเส้นทาง (ตามเวลาที่จะถึง)</div>
        {pts.length > 0 && (
          <button onClick={load} disabled={loading} className="text-xs text-brand disabled:opacity-50">
            {loading ? '…' : '🔄'}
          </button>
        )}
      </div>

      {loading && pts.length === 0 && <div className="text-sm text-dim text-center py-3 animate-pulse">กำลังดึงพยากรณ์…</div>}
      {error && (
        <button onClick={load} className="btn btn-ghost w-full py-2 text-sm">
          ⚠️ {error} — แตะลองใหม่
        </button>
      )}

      {rainy.length > 0 && (
        <div className="text-sm bg-blue-500/15 border border-blue-500/30 text-blue-200 rounded-xl px-3 py-2.5">
          ☔ เจอฝนช่วง {rainy.map((r) => `กม.${Math.round(r.km)} (~${r.time})`).join(', ')} — เตรียมชุดกันฝน
        </div>
      )}

      {pts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {pts.map((p, i) => {
            const wet = (p.rainProb ?? 0) >= 60
            return (
              <div
                key={i}
                className={`shrink-0 w-[70px] rounded-xl px-2 py-2.5 text-center border ${wet ? 'bg-blue-500/15 border-blue-500/30' : 'card-2'}`}
              >
                <div className="text-[10px] text-dim">กม.{Math.round(p.km)}</div>
                <div className="text-xs font-bold font-mono">{p.time}</div>
                <div className="text-2xl my-0.5">{p.emoji}</div>
                <div className={`text-[11px] ${wet ? 'text-blue-300 font-semibold' : 'text-dim'}`}>💧{p.rainProb ?? 0}%</div>
                {p.temp != null && <div className="text-[10px] text-dim">{Math.round(p.temp)}°</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
