import { useEffect, useMemo, useState } from 'react'
import type { RouteData, Waypoint } from '../types'
import { formatDistance } from '../lib/format'
import { refuelCheckpoints } from '../lib/fuel'
import { reverseGeocode } from '../lib/nominatim'

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
  tankLiters?: number
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
    const b: Bike = { id: 'b1', name: 'รถของฉัน', kmPerLiter: old.kmPerLiter || 25, tankLiters: 15 }
    return { depart: old.depart || '07:00', pricePerLiter: old.pricePerLiter || 40, bikes: [b], activeBikeId: b.id }
  } catch {
    const b: Bike = { id: 'b1', name: 'รถของฉัน', kmPerLiter: 25, tankLiters: 15 }
    return { depart: '07:00', pricePerLiter: 40, bikes: [b], activeBikeId: b.id }
  }
}

const RESERVE = 0.15 // เผื่อสำรอง 15% ของถัง

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
  const tank = activeBike?.tankLiters || 15
  const distanceKm = route ? route.distance / 1000 : 0
  const liters = kmPerLiter > 0 ? distanceKm / kmPerLiter : 0
  const cost = liters * s.pricePerLiter

  // ── วงแหวนน้ำมัน ──
  const rangeKm = kmPerLiter * tank // เต็มถัง
  const usableKm = rangeKm * (1 - RESERVE) // เผื่อสำรอง → ควรเติมก่อนถึงระยะนี้
  const checkpoints = useMemo(
    () => (route ? refuelCheckpoints(route.coordinates, usableKm * 1000, route.distance) : []),
    [route, usableKm],
  )
  const refuels = checkpoints.length

  // reverse-geocode จุดเติม (ทีละจุด เคารพ Nominatim 1req/วิ)
  const [nearNames, setNearNames] = useState<Record<number, string>>({})
  useEffect(() => {
    setNearNames({})
    if (!checkpoints.length) return
    let alive = true
    const ac = new AbortController()
    ;(async () => {
      for (let i = 0; i < checkpoints.length; i++) {
        if (!alive) return
        try {
          const name = await reverseGeocode(checkpoints[i].lat, checkpoints[i].lng, ac.signal)
          if (!alive) return
          setNearNames((prev) => ({ ...prev, [i]: name.split(',').slice(0, 2).join(',') }))
        } catch {
          /* noop */
        }
        await new Promise((r) => setTimeout(r, 1100))
      }
    })()
    return () => {
      alive = false
      ac.abort()
    }
  }, [checkpoints])

  const setBikeField = (field: 'kmPerLiter' | 'tankLiters', v: number) =>
    setS((prev) => ({ ...prev, bikes: prev.bikes.map((b) => (b.id === prev.activeBikeId ? { ...b, [field]: v } : b)) }))
  const addBike = () => {
    const name = window.prompt('ชื่อรถ (เช่น CB650R, PCX160):', 'รถคันใหม่')
    if (name === null) return
    const id = 'b' + Date.now().toString(36)
    setS((prev) => ({ ...prev, bikes: [...prev.bikes, { id, name: name.trim() || 'รถคันใหม่', kmPerLiter: 25, tankLiters: 15 }], activeBikeId: id }))
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
        <p className="text-sm text-dim">เพิ่มจุดแวะ ≥ 2 จุด แล้วระบบจะประเมินค่าน้ำมัน วางแผนจุดเติม และเวลาถึงให้</p>
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

        <div className="grid grid-cols-3 gap-2 mt-2">
          <Field label="วิ่งได้" unit="กม./ล." value={kmPerLiter} onChange={(v) => setBikeField('kmPerLiter', v)} />
          <Field label="ถัง" unit="ลิตร" value={tank} onChange={(v) => setBikeField('tankLiters', v)} />
          <Field label="น้ำมัน" unit="฿/ล." value={s.pricePerLiter} onChange={(v) => setS({ ...s, pricePerLiter: v })} />
        </div>
      </div>

      {/* ===== วงแหวนน้ำมัน (Fuel range) ===== */}
      <div className="border-t border-white/[0.07] pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="label">🛞 วงแหวนน้ำมัน</div>
          <div className="text-xs text-dim">
            เต็มถัง ~<span className="font-bold text-white">{Math.round(rangeKm)}</span> กม.
          </div>
        </div>

        {/* แถบระยะทาง + หมุดจุดเติม */}
        <FuelBar distanceKm={distanceKm} usableKm={usableKm} checkpoints={checkpoints} />

        {refuels === 0 ? (
          <div className="mt-2.5 text-sm flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-300">
            <span>✅</span>
            <span>เต็มถังเดียวถึงปลายทาง ไม่ต้องเติมระหว่างทาง</span>
          </div>
        ) : (
          <div className="mt-2.5">
            <div className="text-sm mb-1.5">
              ต้องเติมน้ำมัน <span className="font-bold text-brand">{refuels}</span> ครั้ง ·
              <span className="text-dim"> ควรเติมก่อนวิ่งเกิน ~{Math.round(usableKm)} กม./ถัง</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {checkpoints.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5 card-2 px-3 py-2">
                  <span className="w-7 h-7 shrink-0 rounded-lg grid place-items-center text-sm" style={{ background: 'linear-gradient(135deg,var(--g1),var(--g2))' }}>
                    ⛽
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {nearNames[i] || <span className="text-dim">กำลังหาสถานที่ใกล้เคียง…</span>}
                    </div>
                    <div className="text-[11px] text-dim">เติมประมาณ กม.ที่ {Math.round(c.distM / 1000)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-dim mt-1.5">* จุดเติมเป็นระยะโดยประมาณ — หาปั๊มจริงใกล้จุดนั้นได้ในหน้า "ร้าน/ปั๊ม"</p>
          </div>
        )}
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

function Field({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field flex flex-col items-center px-2 py-2">
      <span className="text-[10px] text-dim">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-center font-bold text-base outline-none"
      />
      <span className="text-[10px] text-dim">{unit}</span>
    </div>
  )
}

/** แถบระยะทางทั้งทริป + หมุด ⛽ ตามจุดเติม */
function FuelBar({ distanceKm, usableKm, checkpoints }: { distanceKm: number; usableKm: number; checkpoints: { distM: number }[] }) {
  const total = distanceKm * 1000 || 1
  return (
    <div className="relative pt-4 pb-1">
      {/* หมุดจุดเติม */}
      {checkpoints.map((c, i) => (
        <div key={i} className="absolute -top-0.5 -translate-x-1/2 text-sm" style={{ left: `${Math.min(96, (c.distM / total) * 100)}%` }}>
          ⛽
        </div>
      ))}
      {/* แถบ */}
      <div className="h-2.5 rounded-full overflow-hidden bg-white/[0.08] relative">
        <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg,var(--g1),var(--g2))', opacity: 0.85 }} />
        {/* เส้นแบ่งช่วงถัง */}
        {usableKm > 0 &&
          Array.from({ length: Math.floor(distanceKm / usableKm) }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-px bg-black/50" style={{ left: `${(((i + 1) * usableKm) / distanceKm) * 100}%` }} />
          ))}
      </div>
      <div className="flex justify-between text-[10px] text-dim mt-1">
        <span>▶ เริ่ม</span>
        <span>{Math.round(distanceKm)} กม.</span>
        <span>🏁 ถึง</span>
      </div>
    </div>
  )
}
