import { useEffect, useRef, useState } from 'react'
import { fetchElevation, type ElevationData } from '../lib/elevation'

interface Props {
  routeCoords: [number, number][]
}

export default function ElevationProfile({ routeCoords }: Props) {
  const [data, setData] = useState<ElevationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ctrl = useRef<AbortController | null>(null)
  const lastSig = useRef('')

  const sig = routeCoords.length ? `${routeCoords.length}|${routeCoords[0]?.join(',')}|${routeCoords[routeCoords.length - 1]?.join(',')}` : ''

  const load = async () => {
    if (routeCoords.length < 2) return
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    setLoading(true)
    setError('')
    try {
      setData(await fetchElevation(routeCoords, ac.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('ดึงข้อมูลความชันไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  // โหลดอัตโนมัติเมื่อมีเส้นทาง (เปลี่ยนเส้นทาง → ดึงใหม่)
  useEffect(() => {
    if (routeCoords.length >= 2 && sig !== lastSig.current) {
      lastSig.current = sig
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // สร้าง path SVG
  let areaPath = ''
  let linePath = ''
  if (data && data.points.length > 1) {
    const W = 300
    const H = 70
    const range = Math.max(1, data.max - data.min)
    const pts = data.points.map((e, i) => {
      const x = (i / (data.points.length - 1)) * W
      const y = H - ((e - data.min) / range) * (H - 8) - 4
      return [x, y] as [number, number]
    })
    linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    areaPath = `${linePath} L${W},${H} L0,${H} Z`
  }

  // สรุปเป็นภาษาคน
  const climbNote = data
    ? data.gain > 400
      ? 'ทางขึ้นเขาชัน เตรียมรถ+เบรกให้พร้อม 🏔️'
      : data.gain > 150
        ? 'มีเนินบ้าง แต่ไม่หนัก'
        : 'ทางค่อนข้างราบ'
    : ''

  return (
    <div className="card p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="label">⛰️ ความชันเส้นทาง (Open-Meteo · ฟรี)</div>
        {data && (
          <button onClick={load} disabled={loading} className="text-xs text-brand disabled:opacity-50">
            {loading ? '…' : '🔄'}
          </button>
        )}
      </div>

      {loading && !data && <div className="text-sm text-dim text-center py-3 animate-pulse">กำลังดึงข้อมูลความชัน…</div>}
      {error && (
        <button onClick={load} className="btn btn-ghost w-full py-2 text-sm">
          ⚠️ {error} — แตะเพื่อลองใหม่
        </button>
      )}
      {!loading && !data && !error && routeCoords.length < 2 && <p className="text-sm text-dim">เพิ่มจุดแวะ ≥ 2 จุดเพื่อดูความชัน</p>}

      {data && (
        <>
          <div className="text-sm">
            <b className="text-[#ff7a45]">↗ ไต่ขึ้นรวม {data.gain.toLocaleString()} ม.</b>
            <span className="text-dim"> · สูงสุด {data.max.toLocaleString()} ม.</span>
          </div>
          <p className="text-xs text-dim -mt-1">{climbNote}</p>
          <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="w-full h-16 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff7a45" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ff2d55" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#elevGrad)" />
            <path d={linePath} fill="none" stroke="#ff7a45" strokeWidth="1.5" />
          </svg>
          <div className="flex justify-between text-[11px] text-dim">
            <span>◀ ออกเดินทาง</span>
            <span>↘ ลง {data.loss.toLocaleString()} ม. · ต่ำสุด {data.min} ม.</span>
            <span>ปลายทาง ▶</span>
          </div>
        </>
      )}
    </div>
  )
}
