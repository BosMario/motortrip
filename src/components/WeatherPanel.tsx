import type { WeatherPoint } from '../lib/weather'
import { formatThaiDate } from '../lib/format'

interface Props {
  points: WeatherPoint[]
  loading: boolean
  error: string
  usedToday: boolean
  hasWaypoints: boolean
  onFetch: () => void
}

function Stat({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-1.5 py-2 text-center ${warn ? 'bg-blue-500/15' : 'bg-white/[0.04]'}`}>
      <div className="text-[10px] text-dim">{icon} {label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${warn ? 'text-blue-300' : ''}`}>{value}</div>
    </div>
  )
}

export default function WeatherPanel({ points, loading, error, usedToday, hasWaypoints, onFetch }: Props) {
  const rainy = points.filter((p) => p.available && (p.rainProb ?? 0) >= 60)
  const forecastDate = points.find((p) => p.date)?.date

  return (
    <div className="card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="label">🌦️ พยากรณ์อากาศ</div>
        <div className="flex items-center gap-2">
          {forecastDate && <span className="text-[11px] text-dim">{formatThaiDate(forecastDate)}</span>}
          {points.length > 0 && (
            <button onClick={onFetch} disabled={loading} className="text-xs text-brand disabled:opacity-50">
              {loading ? '…' : '🔄'}
            </button>
          )}
        </div>
      </div>

      {/* ยังไม่มีข้อมูล */}
      {points.length === 0 && !loading && (
        <button onClick={onFetch} disabled={!hasWaypoints} className="btn btn-primary w-full py-3 disabled:opacity-40">
          {hasWaypoints ? '🌦️ ดูพยากรณ์อากาศแต่ละจุด' : 'เพิ่มจุดแวะก่อน'}
        </button>
      )}

      {loading && points.length === 0 && (
        <div className="text-sm text-dim text-center py-3 animate-pulse">กำลังดึงพยากรณ์อากาศ…</div>
      )}

      {error && <p className="text-xs text-[#ff6a5f]">⚠️ {error}</p>}

      {usedToday && points.length > 0 && (
        <p className="text-[11px] text-dim">📅 วันทริปอยู่ไกลเกิน 16 วัน — แสดงพยากรณ์ของวันนี้แทน</p>
      )}

      {rainy.length > 0 && (
        <div className="text-sm bg-blue-500/15 border border-blue-500/30 text-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <span className="text-lg leading-none">☔</span>
          <span>เตรียมชุดกันฝน — โอกาสฝนสูงที่ <b>{rainy.map((r) => r.name).join(', ')}</b></span>
        </div>
      )}

      {points.map((p, i) => (
        <div key={i} className="card-2 p-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl shrink-0">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.name}</div>
              <div className="text-xs text-dim">{p.label}</div>
            </div>
          </div>
          {p.available ? (
            <div className="grid grid-cols-3 gap-1.5 mt-2.5">
              <Stat icon="🌡️" label="อุณหภูมิ" value={`${Math.round(p.tempMax ?? 0)}°/${Math.round(p.tempMin ?? 0)}°`} />
              <Stat icon="🌧️" label="โอกาสฝน" value={p.rainProb != null ? `${p.rainProb}%` : '—'} warn={(p.rainProb ?? 0) >= 60} />
              <Stat icon="💨" label="ลม" value={p.windMax != null ? `${Math.round(p.windMax)} กม/ชม` : '—'} />
            </div>
          ) : (
            <div className="text-xs text-dim mt-2">ไม่มีข้อมูลพยากรณ์สำหรับจุดนี้</div>
          )}
        </div>
      ))}
    </div>
  )
}
