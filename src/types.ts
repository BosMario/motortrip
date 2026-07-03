export interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  /** true = จุดที่ผู้ใช้ปักเอง (custom POI) */
  custom?: boolean
  note?: string
  /** true = ค้างคืนที่จุดนี้ → จุดถัดไปเป็นวันใหม่ */
  overnight?: boolean
}

export type PoiKind = 'cafe' | 'restaurant' | 'fuel' | 'charging'

export interface Poi {
  id: string
  kind: PoiKind
  name: string
  lat: number
  lng: number
  /** รายละเอียดจากแท็ก OSM (มีบ้างไม่มีบ้าง) */
  cuisine?: string
  openingHours?: string
  website?: string
  phone?: string
  /** URL รูปจากแท็ก image (ถ้ามี) */
  image?: string
  address?: string
  brand?: string
  /** true = มี wikidata/wikipedia (เป็นที่รู้จัก) */
  notable?: boolean
  /** คะแนนประเมิน "ความนิยม" จากความครบถ้วนของข้อมูล OSM (proxy) */
  popularity: number
  /** ระยะห่างจากแนวเส้นทาง (เมตร) โดยประมาณ */
  distFromRoute?: number
}

/** สถานที่ที่บันทึกไว้ (favorites) */
export interface SavedPlace extends Poi {
  savedAt: number
}

/** เส้นทางที่แอดมินแชร์เข้าห้องกลุ่ม (สมาชิก render โดยไม่ต้องเรียก OSRM เอง) */
export interface SharedRoute {
  name: string
  waypoints: { name: string; lat: number; lng: number }[]
  /** เส้น polyline ที่แอดมินคำนวณไว้แล้ว [lat,lng][] */
  geometry?: [number, number][]
  distance?: number
  duration?: number
}

export type GroupRole = 'admin' | 'member'

/** ข้อความด่วนในกลุ่ม */
export interface GroupMessage {
  id: string
  name: string
  color: string
  emoji: string
  text: string
  ts: number
}

/** การแจ้งเตือน SOS */
export interface SosAlert {
  id: string
  name: string
  color: string
  lat?: number | null
  lng?: number | null
  ts: number
}

export interface RouteStep {
  distance: number // เมตร
  duration: number // วินาที
}

export interface RouteData {
  /** พิกัดเส้นทาง [lat, lng] สำหรับวาด polyline */
  coordinates: [number, number][]
  distance: number // เมตรรวม
  duration: number // วินาทีรวม
  /** ระยะทางแต่ละช่วง (leg) ระหว่าง waypoint */
  legs: RouteStep[]
}

export interface Trip {
  id: string
  name: string
  /** วันที่เริ่มทริป (YYYY-MM-DD) */
  date: string
  waypoints: Waypoint[]
  updatedAt: number
  /** ระยะทาง/เวลาที่คำนวณไว้ตอนบันทึก (ไว้ทำสถิติ) */
  distanceM?: number
  durationS?: number
}

/** โปรไฟล์ไรเดอร์ในกลุ่มทริป */
export interface RiderProfile {
  name: string
  color: string
  emoji: string
}

/** ไรเดอร์หนึ่งคนในห้องกลุ่ม (สถานะ realtime) */
export interface Rider extends RiderProfile {
  id: string
  lat?: number | null
  lng?: number | null
  heading?: number | null
  speed?: number | null
  /** เวลาที่อัปเดตตำแหน่งล่าสุด (ms) */
  ts?: number
}

/** payload สำหรับ encode ลง URL (คีย์สั้นเพื่อประหยัดความยาว) */
export interface SharePayload {
  n: string // name
  d: string // date
  w: [string, number, number, 0 | 1, string?][] // [name, lat, lng, custom, note?]
}
