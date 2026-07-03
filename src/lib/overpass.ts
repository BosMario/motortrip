import type { Poi, PoiKind } from '../types'
import { haversine, uid } from './format'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

/** สุ่มจุดตามแนวเส้นทางเพื่อลดจำนวนพิกัดที่ยิงเข้า Overpass */
function sampleRoute(coords: [number, number][], everyMeters = 4000): [number, number][] {
  if (coords.length <= 2) return coords
  const out: [number, number][] = [coords[0]]
  let acc = 0
  for (let i = 1; i < coords.length; i++) {
    const [la1, ln1] = coords[i - 1]
    const [la2, ln2] = coords[i]
    const d = Math.hypot((la2 - la1) * 111000, (ln2 - ln1) * 100000)
    acc += d
    if (acc >= everyMeters) {
      out.push(coords[i])
      acc = 0
    }
  }
  out.push(coords[coords.length - 1])
  if (out.length > 40) {
    const step = Math.ceil(out.length / 40)
    return out.filter((_, i) => i % step === 0)
  }
  return out
}

type Tags = Record<string, string>

/**
 * ประเมิน "ความนิยม" จากความครบถ้วน/ความน่าเชื่อถือของข้อมูล OSM
 * (OSM ไม่มีคะแนนรีวิว — นี่คือ proxy: ร้านที่ข้อมูลครบ/อยู่ใน wikidata/เป็นเชน
 *  มักเป็นร้านที่คนรู้จักและมีตัวตนจริงมากกว่า)
 */
function scorePopularity(t: Tags): number {
  let s = 0
  if (t.wikidata || t.wikipedia) s += 6
  if (t.brand || t['brand:wikidata']) s += 4
  if (t.website || t['contact:website']) s += 3
  if (t.opening_hours) s += 2
  if (t.phone || t['contact:phone']) s += 1
  if (t.cuisine) s += 1
  if (t.image) s += 1
  if (t.stars) s += Number(t.stars) || 0
  if (t.name) s += 1
  // โบนัสเล็กน้อยตามจำนวนแท็กทั้งหมด (ข้อมูลยิ่งเยอะ = ยิ่งมีคนดูแล)
  s += Math.min(3, Math.floor(Object.keys(t).length / 5))
  return s
}

const CUISINE_TH: Record<string, string> = {
  thai: 'อาหารไทย',
  coffee_shop: 'ร้านกาแฟ',
  cafe: 'คาเฟ่',
  noodle: 'ก๋วยเตี๋ยว',
  japanese: 'อาหารญี่ปุ่น',
  chinese: 'อาหารจีน',
  korean: 'อาหารเกาหลี',
  italian: 'อาหารอิตาเลียน',
  pizza: 'พิซซ่า',
  burger: 'เบอร์เกอร์',
  seafood: 'อาหารทะเล',
  ice_cream: 'ไอศกรีม',
  bakery: 'เบเกอรี่',
  dessert: 'ของหวาน',
  regional: 'อาหารพื้นเมือง',
  bbq: 'ปิ้งย่าง',
  international: 'นานาชาติ',
}

function prettyCuisine(v?: string): string | undefined {
  if (!v) return undefined
  return v
    .split(';')
    .map((c) => CUISINE_TH[c.trim()] || c.trim().replace(/_/g, ' '))
    .join(', ')
}

/** ดึงจุดเด่นร้านจากแท็ก OSM → ข้อความไทยสั้น ๆ (สำหรับโชว์เป็นชิป) */
function buildFeatures(t: Tags): string[] {
  const f: string[] = []
  const yes = (v?: string) => v === 'yes'
  if (yes(t.outdoor_seating)) f.push('🌳 นั่งนอกได้')
  if (yes(t.air_conditioning)) f.push('❄️ แอร์')
  if (t.internet_access === 'wlan' || yes(t.internet_access)) f.push('📶 Wi-Fi')
  if (yes(t.takeaway) || t.takeaway === 'only') f.push('🥡 ซื้อกลับ')
  if (yes(t.delivery)) f.push('🛵 เดลิเวอรี')
  if (yes(t.drive_through)) f.push('🚗 ไดรฟ์ทรู')
  if (yes(t['diet:vegetarian']) || yes(t['diet:vegan'])) f.push('🥗 มังสวิรัติ')
  if (t.wheelchair === 'yes') f.push('♿ รองรับวีลแชร์')
  if (yes(t.parking) || t['amenity'] === 'fuel') f.push('🅿️ มีที่จอด')
  if (t.smoking === 'no') f.push('🚭 ปลอดบุหรี่')
  return f
}

function buildAddress(t: Tags): string | undefined {
  const parts = [
    t['addr:housenumber'],
    t['addr:street'],
    t['addr:subdistrict'] || t['addr:suburb'],
    t['addr:district'] || t['addr:city'],
    t['addr:province'] || t['addr:state'],
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

/** map ชนิด POI -> amenity ของ OSM */
const AMENITY: Record<PoiKind, string> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  fuel: 'fuel',
  charging: 'charging_station',
}

/**
 * ค้นหา POI (cafe/restaurant/fuel) ในรัศมี radius (เมตร) จากแนวเส้นทาง
 * เลือกได้ว่าจะหาหมวดไหนบ้างผ่าน kinds — คืนผลเรียงจาก "นิยมที่สุด" (popularity proxy) ก่อน
 */
export async function fetchPois(
  coords: [number, number][],
  kinds: PoiKind[] = ['cafe', 'restaurant', 'fuel'],
  radius = 3000,
  signal?: AbortSignal
): Promise<Poi[]> {
  if (!coords.length || kinds.length === 0) return []
  const samples = sampleRoute(coords)
  const around = `around:${radius},` + samples.map(([la, ln]) => `${la},${ln}`).join(',')

  const selectors = kinds.map((k) => `node["amenity"="${AMENITY[k]}"](${around});`).join('\n      ')
  const query = `
    [out:json][timeout:25];
    (
      ${selectors}
    );
    out body 200;
  `.trim()

  const res = await fetch(OVERPASS, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  })
  if (!res.ok) throw new Error(`Overpass ตอบกลับผิดพลาด (${res.status})`)
  const data = (await res.json()) as {
    elements: Array<{ lat: number; lon: number; tags?: Tags }>
  }

  const seen = new Set<string>()
  const pois: Poi[] = []
  for (const el of data.elements || []) {
    if (el.lat == null || el.lon == null) continue
    const t = el.tags || {}
    const kind: PoiKind =
      t.amenity === 'cafe'
        ? 'cafe'
        : t.amenity === 'fuel'
          ? 'fuel'
          : t.amenity === 'charging_station'
            ? 'charging'
            : 'restaurant'
    const fallbackName =
      kind === 'cafe'
        ? 'คาเฟ่ (ไม่ระบุชื่อ)'
        : kind === 'fuel'
          ? 'ปั๊มน้ำมัน (ไม่ระบุชื่อ)'
          : kind === 'charging'
            ? 'สถานีชาร์จ EV (ไม่ระบุชื่อ)'
            : 'ร้านอาหาร (ไม่ระบุชื่อ)'
    // ปั๊มมักมีแบรนด์ชัด (ปตท./เชลล์/บางจาก) — ใช้ brand เป็นชื่อสำรอง
    const name = t.name || t['name:th'] || t['name:en'] || t.brand || fallbackName
    const key = `${name}|${el.lat.toFixed(4)}|${el.lon.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)

    // ระยะห่างจากแนวเส้นทางโดยประมาณ (นับจากจุด sample ที่ใกล้สุด)
    let dist = Infinity
    for (const [la, ln] of samples) {
      const d = haversine({ lat: el.lat, lng: el.lon }, { lat: la, lng: ln })
      if (d < dist) dist = d
    }

    pois.push({
      id: uid(),
      kind,
      name,
      lat: el.lat,
      lng: el.lon,
      cuisine: prettyCuisine(t.cuisine),
      openingHours: t.opening_hours,
      website: t.website || t['contact:website'],
      phone: t.phone || t['contact:phone'],
      image: t.image && /^https?:\/\//.test(t.image) ? t.image : undefined,
      commons: t.wikimedia_commons,
      wikidata: t.wikidata,
      features: buildFeatures(t),
      address: buildAddress(t),
      brand: t.brand,
      notable: !!(t.wikidata || t.wikipedia),
      popularity: scorePopularity(t),
      distFromRoute: isFinite(dist) ? dist : undefined,
    })
  }

  // เรียงตามความนิยม (มาก→น้อย) ถ้าเท่ากันเอาที่ใกล้เส้นทางก่อน
  pois.sort((a, b) => b.popularity - a.popularity || (a.distFromRoute ?? 0) - (b.distFromRoute ?? 0))
  return pois
}
