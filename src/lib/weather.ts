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
