const OPEN_METEO_ELEV = 'https://api.open-meteo.com/v1/elevation'

export interface ElevationData {
  points: number[] // ความสูงตามแนวเส้นทาง (เมตร)
  gain: number // ไต่ระดับรวม (เมตร)
  loss: number // ลดระดับรวม (เมตร)
  max: number
  min: number
}

/** ดึงโปรไฟล์ความสูงตามเส้นทางจาก Open-Meteo (ฟรี ไม่ต้องมี key, สูงสุด 100 จุด/คำขอ) */
export async function fetchElevation(coords: [number, number][], signal?: AbortSignal): Promise<ElevationData> {
  if (coords.length < 2) throw new Error('ต้องมีเส้นทางก่อน')

  // สุ่มให้เหลือ ≤100 จุด (ลิมิตของ API)
  const N = Math.min(100, coords.length)
  const step = coords.length / N
  const sampled: [number, number][] = []
  for (let i = 0; i < N; i++) sampled.push(coords[Math.floor(i * step)])

  const lat = sampled.map((c) => c[0].toFixed(4)).join(',')
  const lng = sampled.map((c) => c[1].toFixed(4)).join(',')
  const res = await fetch(`${OPEN_METEO_ELEV}?latitude=${lat}&longitude=${lng}`, { signal })
  if (!res.ok) throw new Error(`ดึงข้อมูลความสูงไม่สำเร็จ (${res.status})`)
  const data = (await res.json()) as { elevation?: number[] }
  const points = (data.elevation || []).filter((v) => typeof v === 'number')
  if (points.length < 2) throw new Error('ไม่มีข้อมูลความสูง')

  let gain = 0
  let loss = 0
  for (let i = 1; i < points.length; i++) {
    const d = points[i] - points[i - 1]
    if (d > 0) gain += d
    else loss += -d
  }
  return {
    points,
    gain: Math.round(gain),
    loss: Math.round(loss),
    max: Math.round(Math.max(...points)),
    min: Math.round(Math.min(...points)),
  }
}
