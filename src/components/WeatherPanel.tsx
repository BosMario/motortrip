import type { WeatherPoint } from '../lib/weather'

interface Props {
  points: WeatherPoint[]
  loading: boolean
  error: string
  usedToday: boolean
  hasWaypoints: boolean
  onFetch: () => void
}

export default function WeatherPanel({ points, loading, error, usedToday, hasWaypoints, onFetch }: Props) {
  const rainy = points.filter((p) => p.available && (p.rainProb ?? 0) >= 60)

  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="label">สภาพอากาศ (Open-Meteo · ฟรี)</div>

      <button
        onClick={onFetch}
        disabled={loading || !hasWaypoints}
        className="btn btn-ghost w-full py-2.5 text-sm disabled:opacity-40"
      >
        {loading ? 'กำลังดึงพยากรณ์…' : points.length ? '🔄 อัปเดตพยากรณ์' : '🌦️ ตรวจอากาศตามเส้นทาง'}
      </button>

      {error && <p className="text-xs text-[#ff6a5f]">⚠️ {error}</p>}

      {points.length > 0 && (
        <>
          {usedToday && (
            <p className="text-[11px] text-dim">* วันทริปอยู่นอกช่วงพยากรณ์ (16 วัน) — แสดงของวันนี้แทน</p>
          )}
          {rainy.length > 0 && (
            <div className="text-xs bg-blue-500/15 border border-blue-500/30 text-blue-200 rounded-lg px-3 py-2">
              ☔ เตรียมชุดกันฝน — โอกาสฝนสูงที่ {rainy.map((r) => r.name).join(', ')}
            </div>
          )}
          <ul className="flex flex-col gap-1.5">
            {points.map((p, i) => (
              <li key={i} className="card-2 flex items-center gap-3 px-3 py-2">
                <span className="text-2xl shrink-0">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-dim">{p.label}</div>
                </div>
                {p.available ? (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">
                      {Math.round(p.tempMax ?? 0)}°
                      <span className="text-dim font-normal"> / {Math.round(p.tempMin ?? 0)}°</span>
                    </div>
                    <div className="text-[11px] text-dim">
                      {p.rainProb != null && (
                        <span className={p.rainProb >= 60 ? 'text-blue-300' : ''}>💧{p.rainProb}%</span>
                      )}
                      {p.windMax != null && <> · 💨{Math.round(p.windMax)}</>}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-dim shrink-0">ไม่มีข้อมูล</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
