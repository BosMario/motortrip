import { useRef, useState } from 'react'
import { fetchElevation, type ElevationData } from '../lib/elevation'

interface Props {
  routeCoords: [number, number][]
}

export default function ElevationProfile({ routeCoords }: Props) {
  const [data, setData] = useState<ElevationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ctrl = useRef<AbortController | null>(null)

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
      if ((e as Error).name !== 'AbortError') setError('ดึงข้อมูลความชันไม่สำเร็จ ลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  // สร้าง path SVG จากจุดความสูง
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

  return (
    <div className="card p-3 flex flex-col gap-2.5">
      <div className="label">⛰️ โปรไฟล์ความชัน (Open-Meteo · ฟรี)</div>

      {!data && (
        <button onClick={load} disabled={loading || routeCoords.length < 2} className="btn btn-ghost w-full py-2.5 text-sm disabled:opacity-40">
          {loading ? 'กำลังดึงข้อมูล…' : routeCoords.length < 2 ? 'ยังไม่มีเส้นทาง' : '⛰️ ดูความชันเส้นทาง'}
        </button>
      )}
      {error && <p className="text-xs text-[#ff6a5f]">⚠️ {error}</p>}

      {data && (
        <>
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
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="card-2 py-1.5">
              <div className="text-[10px] text-dim">↗ ไต่รวม</div>
              <div className="text-sm font-bold text-[#ff7a45]">{data.gain} ม.</div>
            </div>
            <div className="card-2 py-1.5">
              <div className="text-[10px] text-dim">↘ ลงรวม</div>
              <div className="text-sm font-bold text-blue-300">{data.loss} ม.</div>
            </div>
            <div className="card-2 py-1.5">
              <div className="text-[10px] text-dim">สูงสุด</div>
              <div className="text-sm font-bold">{data.max}</div>
            </div>
            <div className="card-2 py-1.5">
              <div className="text-[10px] text-dim">ต่ำสุด</div>
              <div className="text-sm font-bold">{data.min}</div>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="text-xs text-brand self-end disabled:opacity-50">
            {loading ? '…' : '🔄 คำนวณใหม่'}
          </button>
        </>
      )}
    </div>
  )
}
