import { workerHttpBase } from './sync'

export interface ParsedLoc {
  lat: number
  lng: number
}

/** ดึงพิกัดจากลิงก์/ข้อความ Google Maps (ฝั่ง client) */
function extract(s: string): ParsedLoc | null {
  let m
  m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  m = s.match(/[?&](?:q|query|destination|ll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  if (m) return { lat: +m[1], lng: +m[2] }
  return null
}

/**
 * แปลง input เป็นพิกัด — รองรับ:
 *  1) พิกัดตรง ๆ "17.6, 100.1"
 *  2) ลิงก์ Google Maps เต็ม (มี @lat,lng / !3d!4d / q=)
 *  3) ลิงก์ย่อ maps.app.goo.gl → ส่งให้ Worker resolve (client ทำเองไม่ได้เพราะ CORS)
 */
export async function parseLocation(input: string): Promise<ParsedLoc | null> {
  const s = input.trim()
  if (!s) return null

  // พิกัดตรง ๆ
  const pc = s.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/)
  if (pc) return { lat: +pc[1], lng: +pc[2] }

  // ลิงก์เต็ม
  const local = extract(s)
  if (local) return local

  // ลิงก์ย่อ / อื่น ๆ → Worker resolve
  if (/^https?:\/\//.test(s)) {
    try {
      const res = await fetch(`${workerHttpBase()}/api/resolve?url=${encodeURIComponent(s)}`)
      const d = await res.json()
      if (d && typeof d.lat === 'number' && typeof d.lng === 'number') return { lat: d.lat, lng: d.lng }
    } catch {
      /* noop */
    }
  }
  return null
}
