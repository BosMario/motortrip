import { haversine } from './format'

export interface RefuelPoint {
  /** ระยะจากจุดเริ่ม (เมตร) */
  distM: number
  lat: number
  lng: number
  /** ชื่อสถานที่ใกล้เคียง (เติมภายหลังด้วย reverse geocode) */
  near?: string
}

/** ระยะสะสมตามแนวเส้นทาง (เมตร) ต่อจุด */
function cumulative(coords: [number, number][]): number[] {
  const acc = [0]
  for (let i = 1; i < coords.length; i++) {
    const d = haversine({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] })
    acc.push(acc[i - 1] + d)
  }
  return acc
}

/** หาพิกัดบนเส้นทาง ณ ระยะสะสม targetM (interpolate ระหว่างจุด) */
export function pointAtDistance(coords: [number, number][], cum: number[], targetM: number): [number, number] {
  if (!coords.length) return [0, 0]
  if (targetM <= 0) return coords[0]
  const total = cum[cum.length - 1]
  if (targetM >= total) return coords[coords.length - 1]
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < targetM) lo = mid + 1
    else hi = mid
  }
  const i = Math.max(1, lo)
  const seg = cum[i] - cum[i - 1] || 1
  const t = (targetM - cum[i - 1]) / seg
  return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t]
}

/**
 * จุดที่ควรเติมน้ำมัน — วางไว้ทุกช่วง usableRangeM ตามแนวเส้นทาง
 * (start ออกมาแบบเต็มถัง จึงเติมครั้งแรกที่ ~usableRange)
 */
export function refuelCheckpoints(coords: [number, number][], usableRangeM: number, totalM: number): RefuelPoint[] {
  const out: RefuelPoint[] = []
  if (usableRangeM <= 0 || totalM <= usableRangeM) return out
  const cum = cumulative(coords)
  for (let d = usableRangeM; d < totalM - 1000; d += usableRangeM) {
    const [lat, lng] = pointAtDistance(coords, cum, d)
    out.push({ distM: d, lat, lng })
  }
  return out
}
