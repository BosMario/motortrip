import type { Rider } from '../types'
import { haversine } from './format'

export interface RiderProgress {
  id: string
  traveled: number // ระยะที่ไปแล้วตามเส้นทาง (เมตร)
  distToEnd: number // เหลือถึงปลายทาง (เมตร)
  order: number // ลำดับขบวน (1 = นำสุด)
  nextStopName?: string
  distToNext?: number // ถึงจุดถัดไป (เมตร)
}

type LatLng = { lat: number; lng: number }

/** ระยะจากจุดถึง segment (a→b) แบบ equirectangular + คืน t (0..1) ตำแหน่งบน segment */
function pointSeg(p: LatLng, a: [number, number], b: [number, number]) {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111320
  const P = [p.lng * k, p.lat * 110540]
  const A = [a[1] * k, a[0] * 110540]
  const B = [b[1] * k, b[0] * 110540]
  const abx = B[0] - A[0]
  const aby = B[1] - A[1]
  const len2 = abx * abx + aby * aby || 1
  let t = ((P[0] - A[0]) * abx + (P[1] - A[1]) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const d = Math.hypot(P[0] - (A[0] + t * abx), P[1] - (A[1] + t * aby))
  return { t, d }
}

/** โปรเจกต์จุดลงบนเส้นทาง → คืนระยะสะสมถึงตำแหน่งนั้น (เมตร) */
function projectDist(p: LatLng, coords: [number, number][], cum: number[]): number {
  let best = Infinity
  let dist = 0
  for (let i = 1; i < coords.length; i++) {
    const { t, d } = pointSeg(p, coords[i - 1], coords[i])
    if (d < best) {
      best = d
      dist = cum[i - 1] + t * (cum[i] - cum[i - 1])
    }
  }
  return dist
}

/** คำนวณความคืบหน้า/ลำดับขบวนของทุกไรเดอร์ (client-side, ไม่ต้องเรียก API) */
export function computeConvoy(
  positioned: Rider[],
  coords: [number, number][],
  waypoints: { name: string; lat: number; lng: number }[]
): Record<string, RiderProgress> {
  if (coords.length < 2 || positioned.length === 0) return {}

  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] }))
  }
  const total = cum[cum.length - 1]
  const wpDist = waypoints.map((w) => projectDist(w, coords, cum))

  const out: Record<string, RiderProgress> = {}
  for (const r of positioned) {
    if (r.lat == null || r.lng == null) continue
    const traveled = projectDist({ lat: r.lat, lng: r.lng }, coords, cum)
    let nextStopName: string | undefined
    let distToNext: number | undefined
    for (let i = 0; i < waypoints.length; i++) {
      if (wpDist[i] > traveled + 60) {
        nextStopName = waypoints[i].name
        distToNext = wpDist[i] - traveled
        break
      }
    }
    out[r.id] = { id: r.id, traveled, distToEnd: Math.max(0, total - traveled), order: 0, nextStopName, distToNext }
  }
  Object.values(out)
    .sort((a, b) => b.traveled - a.traveled)
    .forEach((p, i) => (p.order = i + 1))
  return out
}
