import { workerHttpBase } from './sync'
import { searchPlace } from './nominatim'

export interface ParsedLoc {
  lat: number
  lng: number
  name?: string
  approx?: boolean // true = ได้จากการค้นชื่อ (ไม่ใช่พิกัดตรง)
}

/** ดึงพิกัดจากลิงก์/ข้อความ Google Maps (ฝั่ง client) */
function extract(input: string): ParsedLoc | null {
  let dec = input
  try {
    dec = decodeURIComponent(input.replace(/\+/g, ' '))
  } catch {
    /* noop */
  }
  for (const s of [input, dec]) {
    let m
    m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    if (m) return { lat: +m[1], lng: +m[2] }
    m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    if (m) return { lat: +m[1], lng: +m[2] }
    m = s.match(/[?&](?:q|query|destination|ll|center|sll|daddr|saddr)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
    if (m) return { lat: +m[1], lng: +m[2] }
    m = s.match(/(-?\d{1,2}\.\d{4,}),\s*(-?1?\d{2}\.\d{4,})/)
    if (m) return { lat: +m[1], lng: +m[2] }
  }
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
      // ได้แค่ชื่อ/ที่อยู่ → ค้น Nominatim ต่อ (ตำแหน่งโดยประมาณ)
      // กันกรณี Google ส่ง token ขยะมา (ไม่มีช่องว่าง/ไม่ใช่ชื่อจริง)
      if (d && typeof d.name === 'string') {
        const name = d.name.trim()
        const looksLikeToken = /^[A-Za-z0-9_-]{12,}$/.test(name)
        if (name && !looksLikeToken) {
          const r = await searchPlace(name).catch(() => [])
          if (r.length) return { lat: r[0].lat, lng: r[0].lng, name: r[0].name.split(',')[0], approx: true }
        }
      }
    } catch {
      /* noop */
    }
  }
  return null
}
