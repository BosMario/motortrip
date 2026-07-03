import { haversine } from './format'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

export interface WeatherPoint {
  name: string
  available: boolean
  emoji: string
  label: string
  tempMax?: number
  tempMin?: number
  rainProb?: number // % โอกาสฝน
  windMax?: number // กม./ชม.
  date?: string
}

/** WMO weather code -> [emoji, ข้อความไทย] */
function wmo(code: number): [string, string] {
  if (code === 0) return ['☀️', 'แจ่มใส']
  if (code === 1) return ['🌤️', 'มีเมฆบางส่วน']
  if (code === 2) return ['⛅', 'มีเมฆเป็นส่วน']
  if (code === 3) return ['☁️', 'เมฆมาก']
  if (code === 45 || code === 48) return ['🌫️', 'หมอก']
  if (code >= 51 && code <= 57) return ['🌦️', 'ฝนปรอย']
  if (code >= 61 && code <= 65) return ['🌧️', 'ฝนตก']
  if (code === 66 || code === 67) return ['🌧️', 'ฝนเย็นจัด']
  if (code >= 71 && code <= 77) return ['🌨️', 'หิมะ']
  if (code >= 80 && code <= 82) return ['🌦️', 'ฝนเป็นช่วง']
  if (code === 85 || code === 86) return ['🌨️', 'หิมะเป็นช่วง']
  if (code === 95) return ['⛈️', 'พายุฝนฟ้าคะนอง']
  if (code === 96 || code === 99) return ['⛈️', 'พายุฝน+ลูกเห็บ']
  return ['❓', 'ไม่ทราบ']
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toISOHour(d: Date): string {
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:00`
}

export interface RouteWeatherPoint {
  km: number
  time: string // HH:MM ที่คาดว่าจะถึง
  emoji: string
  label: string
  rainProb?: number
  temp?: number
}

/**
 * พยากรณ์อากาศ "ตามเส้นทาง + เวลา" — สุ่มจุดตามเส้น, คำนวณเวลาที่จะถึงแต่ละจุด (จากเวลาออก+ความเร็วเฉลี่ย)
 * แล้วดึงอากาศ "รายชั่วโมง" ของชั่วโมงนั้น ๆ (Open-Meteo ฟรี) → รู้ว่าฝนจะตกช่วง กม.ไหน เวลาไหน
 */
export async function fetchRouteWeather(
  coords: [number, number][],
  totalDistanceM: number,
  durationS: number,
  departHHMM: string,
  tripDate: string,
  signal?: AbortSignal
): Promise<RouteWeatherPoint[]> {
  if (coords.length < 2 || totalDistanceM <= 0) return []

  // ระยะสะสม
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] }))
  }
  const total = cum[cum.length - 1] || totalDistanceM

  // วันฐาน: วันทริป (ถ้าตั้ง & อยู่ในช่วง 16 วัน) ไม่งั้นวันนี้
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxAhead = new Date(today)
  maxAhead.setDate(today.getDate() + 15)
  const t = tripDate ? new Date(tripDate + 'T00:00:00') : null
  const base = t && !isNaN(+t) && t >= today && t <= maxAhead ? new Date(t) : new Date(today)
  const [dh, dm] = (departHHMM || '07:00').split(':').map(Number)
  const departMs = base.getTime() + ((dh || 0) * 60 + (dm || 0)) * 60000
  const durBuffered = durationS * 1.2

  // สุ่ม 6 จุดตามระยะ + เวลาที่จะถึง
  const N = 6
  const samples: { lat: number; lng: number; km: number; arrive: Date }[] = []
  for (let k = 0; k < N; k++) {
    const targetD = (k / (N - 1)) * total
    let i = 1
    while (i < cum.length && cum[i] < targetD) i++
    const c = coords[Math.min(i, coords.length - 1)]
    const arrive = new Date(departMs + (targetD / total) * durBuffered * 1000)
    samples.push({ lat: c[0], lng: c[1], km: targetD / 1000, arrive })
  }

  const startDate = toISODate(samples[0].arrive)
  const endDate = toISODate(samples[samples.length - 1].arrive)
  const params = new URLSearchParams({
    latitude: samples.map((s) => s.lat.toFixed(4)).join(','),
    longitude: samples.map((s) => s.lng.toFixed(4)).join(','),
    hourly: 'weathercode,precipitation_probability,temperature_2m',
    timezone: 'Asia/Bangkok',
    start_date: startDate,
    end_date: endDate,
  })

  const res = await fetch(`${OPEN_METEO}?${params}`, { signal })
  if (!res.ok) throw new Error(`ดึงพยากรณ์ตามเส้นทางไม่สำเร็จ (${res.status})`)
  const data = await res.json()
  const arr = Array.isArray(data) ? data : [data]

  return samples.map((s, i): RouteWeatherPoint => {
    const h = arr[i]?.hourly
    const hh = `${String(s.arrive.getHours()).padStart(2, '0')}:${String(s.arrive.getMinutes()).padStart(2, '0')}`
    if (!h || !h.time) return { km: s.km, time: hh, emoji: '❓', label: '—' }
    const idx = h.time.indexOf(toISOHour(s.arrive))
    const j = idx >= 0 ? idx : 0
    const [emoji, label] = wmo(h.weathercode?.[j] ?? 3)
    return {
      km: s.km,
      time: hh,
      emoji,
      label,
      rainProb: h.precipitation_probability?.[j] ?? undefined,
      temp: h.temperature_2m?.[j] ?? undefined,
    }
  })
}

export interface RideDay {
  date: string // ISO YYYY-MM-DD
  dow: string // ชื่อวัน ไทย
  emoji: string
  label: string
  tempMax?: number
  tempMin?: number
  rainProb?: number
  windMax?: number
  score: number // 0–100 ยิ่งสูงยิ่งเหมาะขับ
  rating: string
}

const THAI_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

/** ให้คะแนน "ความเหมาะสมในการขับ" จากอากาศรายวัน (ฝนคือปัจจัยหลัก) */
function rideScore(code: number, rainProb: number, windMax: number, tempMax: number): number {
  let s = 100
  s -= rainProb * 0.6 // ฝน 100% → -60
  if (code >= 95) s -= 30 // พายุฝนฟ้าคะนอง
  else if (code >= 80) s -= 12 // ฝนเป็นช่วง
  else if (code >= 61) s -= 15 // ฝนตก
  else if (code >= 51) s -= 6 // ฝนปรอย
  else if (code === 45 || code === 48) s -= 8 // หมอก
  else if (code === 0 || code === 1) s += 4 // แจ่มใส
  if (windMax > 30) s -= (windMax - 30) * 0.8 // ลมแรง
  if (tempMax > 38) s -= (tempMax - 38) * 2 // ร้อนจัด
  if (tempMax < 12) s -= (12 - tempMax) * 1.5 // หนาวจัด
  return Math.max(0, Math.min(100, Math.round(s)))
}

function rating(score: number): string {
  if (score >= 80) return 'ดีเยี่ยม'
  if (score >= 62) return 'ดี'
  if (score >= 42) return 'พอได้'
  return 'ควรเลี่ยง'
}

/** พยากรณ์ 7 วันข้างหน้า ณ จุดเริ่มทริป + ให้คะแนนว่าวันไหนเหมาะขับที่สุด (ฟรี) */
export async function fetchRideDays(lat: number, lng: number, signal?: AbortSignal): Promise<RideDay[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max',
    timezone: 'Asia/Bangkok',
    forecast_days: '7',
  })
  const res = await fetch(`${OPEN_METEO}?${params}`, { signal })
  if (!res.ok) throw new Error(`ดึงพยากรณ์ 7 วันไม่สำเร็จ (${res.status})`)
  const data = await res.json()
  const d = data.daily
  if (!d || !d.time?.length) return []
  return d.time.map((date: string, i: number): RideDay => {
    const code = d.weathercode?.[i] ?? 3
    const rainProb = d.precipitation_probability_max?.[i] ?? 0
    const windMax = d.windspeed_10m_max?.[i] ?? 0
    const tempMax = d.temperature_2m_max?.[i] ?? 30
    const [emoji, label] = wmo(code)
    const score = rideScore(code, rainProb, windMax, tempMax)
    return {
      date,
      dow: THAI_DOW[new Date(date + 'T00:00:00').getDay()],
      emoji,
      label,
      tempMax,
      tempMin: d.temperature_2m_min?.[i],
      rainProb,
      windMax,
      score,
      rating: rating(score),
    }
  })
}

/**
 * พยากรณ์อากาศรายจุดตามเส้นทาง (Open-Meteo — ฟรี ไม่ต้องมี key)
 * ยิงหลายจุดในคำขอเดียวด้วยพิกัดคั่น comma
 * @returns { points, usedToday } — usedToday = true ถ้าวันทริปอยู่นอกช่วงพยากรณ์ (16 วัน) เลยใช้วันนี้แทน
 */
export async function fetchTripWeather(
  points: { name: string; lat: number; lng: number }[],
  date: string,
  signal?: AbortSignal
): Promise<{ points: WeatherPoint[]; usedToday: boolean }> {
  if (!points.length) return { points: [], usedToday: false }

  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lng.toFixed(4)).join(','),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max',
    timezone: 'Asia/Bangkok',
  })

  // เลือกวัน: ถ้าวันทริปอยู่ในช่วง [วันนี้, +15 วัน] ใช้วันนั้น ไม่งั้นใช้วันนี้
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxAhead = new Date(today)
  maxAhead.setDate(today.getDate() + 15)
  const target = date ? new Date(date + 'T00:00:00') : null
  let usedToday = false
  if (target && !isNaN(+target) && target >= today && target <= maxAhead) {
    params.set('start_date', date)
    params.set('end_date', date)
  } else {
    params.set('start_date', toISODate(today))
    params.set('end_date', toISODate(today))
    if (target) usedToday = true // ใส่วันแล้วแต่อยู่นอกช่วงพยากรณ์ → ใช้วันนี้แทน
  }

  const res = await fetch(`${OPEN_METEO}?${params}`, { signal })
  if (!res.ok) throw new Error(`ดึงพยากรณ์อากาศไม่สำเร็จ (${res.status})`)
  const data = await res.json()
  const arr = Array.isArray(data) ? data : [data]

  const result = points.map((p, i): WeatherPoint => {
    const d = arr[i]?.daily
    if (!d || !d.time?.length) return { name: p.name, available: false, emoji: '❓', label: 'ไม่มีข้อมูล' }
    const [emoji, label] = wmo(d.weathercode[0])
    return {
      name: p.name,
      available: true,
      emoji,
      label,
      tempMax: d.temperature_2m_max?.[0],
      tempMin: d.temperature_2m_min?.[0],
      rainProb: d.precipitation_probability_max?.[0] ?? undefined,
      windMax: d.windspeed_10m_max?.[0],
      date: d.time[0],
    }
  })
  return { points: result, usedToday }
}
