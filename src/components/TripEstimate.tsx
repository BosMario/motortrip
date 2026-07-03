import { useEffect, useState } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance, formatDuration } from '../lib/format'

interface Props {
  route: RouteData | null
  waypoints: Waypoint[]
  roundTrip: boolean
}

const KEY = 'moto-estimate-v1'
interface Settings {
  depart: string
  kmPerLiter: number
  pricePerLiter: number
}
function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { depart: s.depart || '07:00', kmPerLiter: s.kmPerLiter || 25, pricePerLiter: s.pricePerLiter || 40 }
  } catch {
    return { depart: '07:00', kmPerLiter: 25, pricePerLiter: 40 }
  }
}

/** บวกนาทีเข้ากับเวลา HH:MM → HH:MM (+วัน ถ้าข้ามเที่ยงคืน) */
function addTime(depart: string, addMinutes: number): string {
  const [h, m] = depart.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return '—'
  const total = h * 60 + m + Math.round(addMinutes)
  const day = Math.floor(total / 1440)
  const mins = ((total % 1440) + 1440) % 1440
  const hh = String(Math.floor(mins / 60)).padStart(2, '0')
  const mm = String(mins % 60).padStart(2, '0')
  return `${hh}:${mm}${day > 0 ? ` (+${day}วัน)` : ''}`
}

export default function TripEstimate({ route, waypoints, roundTrip }: Props) {
  const [s, setS] = useState<Settings>(load)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s))
  }, [s])

  const distanceKm = route ? route.distance / 1000 : 0
  const liters = s.kmPerLiter > 0 ? distanceKm / s.kmPerLiter : 0
  const cost = liters * s.pricePerLiter

  // เวลาถึงแต่ละจุด (ต้องมี legs = เฉพาะแอดมิน/วางแผนเอง; สมาชิกที่รับ geometry จะไม่มี)
  const hasLegs = !!route && route.legs.length > 0
  const arrivals: { name: string; time: string }[] = []
  if (hasLegs && route) {
    let acc = 0
    arrivals.push({ name: waypoints[0]?.name || 'จุดเริ่ม', time: addTime(s.depart, 0) })
    for (let i = 1; i < waypoints.length; i++) {
      acc += (route.legs[i - 1]?.duration || 0) * 1.2 // เผื่อพัก 20%
      arrivals.push({ name: waypoints[i].name, time: addTime(s.depart, acc / 60) })
    }
    if (roundTrip && route.legs[waypoints.length - 1]) {
      acc += route.legs[waypoints.length - 1].duration * 1.2
      arrivals.push({ name: `กลับถึง ${waypoints[0]?.name || 'จุดเริ่ม'}`, time: addTime(s.depart, acc / 60) })
    }
  }

  return (
    <div className="card p-3 flex flex-col gap-3">
      <div className="label">⛽ งบน้ำมัน & ⏱️ เวลา (ประเมิน)</div>

      <div className="grid grid-cols-3 gap-2">
        <label className="label flex flex-col gap-1">
          เวลาออก
          <input
            type="time"
            value={s.depart}
            onChange={(e) => setS({ ...s, depart: e.target.value })}
            className="field px-2 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <label className="label flex flex-col gap-1">
          กม./ลิตร
          <input
            type="number"
            inputMode="decimal"
            value={s.kmPerLiter}
            onChange={(e) => setS({ ...s, kmPerLiter: Number(e.target.value) })}
            className="field px-2 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <label className="label flex flex-col gap-1">
          บาท/ลิตร
          <input
            type="number"
            inputMode="decimal"
            value={s.pricePerLiter}
            onChange={(e) => setS({ ...s, pricePerLiter: Number(e.target.value) })}
            className="field px-2 py-2 text-sm normal-case tracking-normal"
          />
        </label>
      </div>

      {route ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="card-2 px-2 py-2.5 text-center">
              <div className="text-[10px] text-dim">💸 ค่าน้ำมัน</div>
              <div className="text-lg font-bold mt-0.5">฿{Math.round(cost).toLocaleString()}</div>
            </div>
            <div className="card-2 px-2 py-2.5 text-center">
              <div className="text-[10px] text-dim">⛽ ใช้น้ำมัน</div>
              <div className="text-lg font-bold mt-0.5">
                {liters.toFixed(1)}
                <span className="text-xs text-dim"> ล.</span>
              </div>
            </div>
            <div className="card-2 px-2 py-2.5 text-center">
              <div className="text-[10px] text-dim">📏 ระยะ</div>
              <div className="text-lg font-bold mt-0.5">{formatDistance(route.distance)}</div>
            </div>
          </div>

          {arrivals.length > 0 ? (
            <div>
              <div className="label mb-1.5">🕐 กำหนดการถึงแต่ละจุด</div>
              <ul className="flex flex-col gap-1">
                {arrivals.map((a, i) => (
                  <li key={i} className="flex items-center justify-between text-sm card-2 px-3 py-2">
                    <span className="truncate mr-2">
                      <span className="text-dim mr-1.5">{i + 1}.</span>
                      {a.name}
                    </span>
                    <span className="font-semibold font-mono shrink-0">{a.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-dim">
              🕐 เวลาถึงแต่ละจุดแสดงเฉพาะตอนวางแผนเอง/เป็นแอดมิน · เวลารวม ~{formatDuration(route.duration, true)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-dim">เพิ่มจุดแวะ ≥ 2 จุดเพื่อประเมินงบและเวลา</p>
      )}
    </div>
  )
}
