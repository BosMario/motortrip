import { useEffect, useState } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance } from '../lib/format'

interface Props {
  route: RouteData | null
  waypoints: Waypoint[]
  roundTrip: boolean
}

const KEY = 'moto-estimate-v2'
interface Bike {
  id: string
  name: string
  kmPerLiter: number
}
interface Settings {
  depart: string
  pricePerLiter: number
  bikes: Bike[]
  activeBikeId: string
}
function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s && Array.isArray(s.bikes) && s.bikes.length) return s
    // migrate จาก v1 (คันเดียว)
    const old = JSON.parse(localStorage.getItem('moto-estimate-v1') || '{}')
    const b: Bike = { id: 'b1', name: 'รถของฉัน', kmPerLiter: old.kmPerLiter || 25 }
    return { depart: old.depart || '07:00', pricePerLiter: old.pricePerLiter || 40, bikes: [b], activeBikeId: b.id }
  } catch {
    const b: Bike = { id: 'b1', name: 'รถของฉัน', kmPerLiter: 25 }
    return { depart: '07:00', pricePerLiter: 40, bikes: [b], activeBikeId: b.id }
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
  return `${hh}:${mm}${day > 0 ? ` +${day}วัน` : ''}`
}

export default function TripEstimate({ route, waypoints, roundTrip }: Props) {
  const [s, setS] = useState<Settings>(load)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s))
  }, [s])

  const activeBike = s.bikes.find((b) => b.id === s.activeBikeId) || s.bikes[0]
  const kmPerLiter = activeBike?.kmPerLiter || 25
  const distanceKm = route ? route.distance / 1000 : 0
  const liters = kmPerLiter > 0 ? distanceKm / kmPerLiter : 0
  const cost = liters * s.pricePerLiter

  const setActiveKmPerLiter = (v: number) =>
    setS((prev) => ({ ...prev, bikes: prev.bikes.map((b) => (b.id === prev.activeBikeId ? { ...b, kmPerLiter: v } : b)) }))
  const addBike = () => {
    const name = window.prompt('ชื่อรถ (เช่น CB650R, PCX160):', 'รถคันใหม่')
    if (name === null) return
    const id = 'b' + Date.now().toString(36)
    setS((prev) => ({ ...prev, bikes: [...prev.bikes, { id, name: name.trim() || 'รถคันใหม่', kmPerLiter: 25 }], activeBikeId: id }))
  }
  const deleteActiveBike = () =>
    setS((prev) => {
      if (prev.bikes.length <= 1) return prev
      const bikes = prev.bikes.filter((b) => b.id !== prev.activeBikeId)
      return { ...prev, bikes, activeBikeId: bikes[0].id }
    })

  const hasLegs = !!route && route.legs.length > 0
  const arrivals: { name: string; time: string }[] = []
  if (hasLegs && route) {
    let acc = 0
    arrivals.push({ name: waypoints[0]?.name || 'จุดเริ่ม', time: addTime(s.depart, 0) })
    for (let i = 1; i < waypoints.length; i++) {
      acc += (route.legs[i - 1]?.duration || 0) * 1.2
      arrivals.push({ name: waypoints[i].name, time: addTime(s.depart, acc / 60) })
    }
    if (roundTrip && route.legs[waypoints.length - 1]) {
      acc += route.legs[waypoints.length - 1].duration * 1.2
      arrivals.push({ name: `กลับถึง ${waypoints[0]?.name || 'จุดเริ่ม'}`, time: addTime(s.depart, acc / 60) })
    }
  }

  if (!route) {
    return (
      <div className="card p-3">
        <div className="label mb-1">⛽ ค่าน้ำมัน & 🕐 เวลา</div>
        <p className="text-sm text-dim">เพิ่มจุดแวะ ≥ 2 จุด แล้วระบบจะประเมินค่าน้ำมันและเวลาถึงให้</p>
      </div>
    )
  }

  return (
    <div className="card p-3 flex flex-col gap-4">
      {/* ===== ค่าน้ำมัน ===== */}
      <div>
        <div className="label mb-1.5">⛽ ค่าน้ำมันทั้งทริป (ประเมิน)</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">฿{Math.round(cost).toLocaleString()}</span>
          <span className="text-sm text-dim">
            ≈ {liters.toFixed(1)} ลิตร · ระยะ {formatDistance(route.distance)}
          </span>
        </div>
        {/* เลือกรถ */}
        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
          <span className="text-xs text-dim">🏍️</span>
          {s.bikes.map((b) => (
            <button
              key={b.id}
              onClick={() => setS({ ...s, activeBikeId: b.id })}
              className={`chip px-2.5 py-1 ${b.id === s.activeBikeId ? 'chip-on' : ''}`}
            >
              {b.name}
            </button>
          ))}
          <button onClick={addBike} className="chip px-2 py-1">
            ＋
          </button>
          {s.bikes.length > 1 && (
            <button onClick={deleteActiveBike} className="text-xs text-[#ff6a5f] ml-auto">
              ลบคันนี้
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <div className="field flex-1 flex items-center gap-1.5 px-3 py-2">
            <span className="text-xs text-dim whitespace-nowrap">วิ่งได้</span>
            <input
              type="number"
              inputMode="decimal"
              value={kmPerLiter}
              onChange={(e) => setActiveKmPerLiter(Number(e.target.value))}
              className="w-10 bg-transparent text-center font-bold text-base outline-none"
            />
            <span className="text-xs text-dim whitespace-nowrap">กม./ลิตร</span>
          </div>
          <div className="field flex-1 flex items-center gap-1.5 px-3 py-2">
            <span className="text-xs text-dim whitespace-nowrap">น้ำมัน ฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={s.pricePerLiter}
              onChange={(e) => setS({ ...s, pricePerLiter: Number(e.target.value) })}
              className="w-10 bg-transparent text-center font-bold text-base outline-none"
            />
            <span className="text-xs text-dim whitespace-nowrap">/ลิตร</span>
          </div>
        </div>
      </div>

      {/* ===== เวลาถึงแต่ละจุด ===== */}
      <div className="border-t border-white/[0.07] pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="label">🕐 เวลาถึงแต่ละจุด</div>
          <div className="flex items-center gap-1.5 text-xs text-dim">
            ออกเดินทาง
            <input
              type="time"
              value={s.depart}
              onChange={(e) => setS({ ...s, depart: e.target.value })}
              className="field px-2 py-1 text-sm font-semibold"
            />
          </div>
        </div>
        {arrivals.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {arrivals.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm card-2 px-3 py-2">
                <span className="truncate mr-2">
                  <span className="text-dim mr-1.5">{i + 1}.</span>
                  {a.name}
                </span>
                <span className="font-bold font-mono shrink-0 text-brand">{a.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-dim">เวลาถึงแต่ละจุดแสดงเฉพาะตอนวางแผนเอง/เป็นแอดมิน</p>
        )}
      </div>
    </div>
  )
}
