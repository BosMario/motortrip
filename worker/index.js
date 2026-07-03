import { GroupRoom } from './group-room.js'

export { GroupRoom }

/**
 * ดึงพิกัดจากลิงก์/HTML ของ Google Maps
 * เก็บพิกัดทุกตัวที่เจอ แล้วเลือก "คู่ที่ซ้ำบ่อยที่สุด" (พิกัดสถานที่จริงจะซ้ำหลายครั้ง
 * ส่วนพิกัด default map/ที่ปนมาจะเจอครั้งเดียว)
 */
function extractCoords(s) {
  if (!s) return null
  const cand = []
  const push = (lat, lng) => {
    const a = +lat
    const b = +lng
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) cand.push(`${a.toFixed(6)},${b.toFixed(6)}`)
  }
  let re, m
  // เฉพาะ pattern "หมุดสถานที่จริง" — ไม่ใช้ center=/viewport (หลอกด้วย default map)
  re = /(?:!|%21)3d(-?\d{1,3}\.\d+)(?:!|%21)4d(-?\d{1,3}\.\d+)/g // !3dLAT!4dLNG
  while ((m = re.exec(s))) push(m[1], m[2])
  re = /(?:!|%21)2d(-?\d{1,3}\.\d{4,})(?:!|%21)3d(-?\d{1,3}\.\d{4,})/g // !2dLNG!3dLAT
  while ((m = re.exec(s))) push(m[2], m[1])
  re = /\[\d{2,}\.\d+,(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/g // [range,LNG,LAT]
  while ((m = re.exec(s))) push(m[2], m[1])
  re = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/g
  while ((m = re.exec(s))) push(m[1], m[2])
  re = /[?&](?:q|query|destination|ll|sll)=(-?\d{1,3}\.\d+)(?:,|%2[Cc])(-?\d{1,3}\.\d+)/g
  while ((m = re.exec(s))) push(m[1], m[2])

  if (!cand.length) return null
  const count = {}
  let best = cand[0]
  let bestN = 0
  for (const c of cand) {
    count[c] = (count[c] || 0) + 1
    if (count[c] > bestN) {
      bestN = count[c]
      best = c
    }
  }
  return best.split(',').map(Number)
}

/**
 * Worker เส้นทางเดียว: ยกระดับ WebSocket ไปยัง Durable Object ตามรหัสห้อง
 *   GET /api/room/:code/ws   (Upgrade: websocket)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // health check
    if (url.pathname === '/api/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } })
    }

    const m = url.pathname.match(/^\/api\/room\/([A-Za-z0-9_-]{4,12})\/ws$/)
    if (m) {
      const code = m[1].toUpperCase()
      const id = env.GROUP_ROOM.idFromName(code)
      const stub = env.GROUP_ROOM.get(id)
      return stub.fetch(request)
    }

    const CORS = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type',
    }

    // ---- Resolve ลิงก์ Google Maps → พิกัด (client resolve ลิงก์ย่อเองไม่ได้เพราะ CORS) ----
    if (url.pathname === '/api/resolve') {
      const target = url.searchParams.get('url') || ''
      // จำกัดเฉพาะโดเมน Google/goo.gl กัน SSRF
      if (!/^https?:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl)\//i.test(target)) {
        return new Response(JSON.stringify({ error: 'bad url' }), { status: 400, headers: { ...CORS, 'content-type': 'application/json' } })
      }
      let coords = extractCoords(target)
      let finalUrl = ''
      let snippet = ''
      if (!coords) {
        try {
          const r = await fetch(target, {
            redirect: 'follow',
            headers: {
              'user-agent':
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
              'accept-language': 'th-TH,th;q=0.9,en;q=0.8',
              cookie: 'CONSENT=YES+cb',
            },
          })
          finalUrl = r.url
          coords = extractCoords(r.url)
          if (!coords) {
            const text = await r.text()
            snippet = text.slice(0, 400)
            coords = extractCoords(text)
          }
        } catch {
          /* noop */
        }
      }
      // fallback: ดึงชื่อ/ที่อยู่จาก ?q= ในลิงก์ปลายทาง (ให้ client เอาไปค้น Nominatim ต่อ)
      let placeName = ''
      try {
        placeName = new URL(finalUrl).searchParams.get('q') || ''
      } catch {
        /* noop */
      }
      const body = coords
        ? { lat: coords[0], lng: coords[1] }
        : placeName
          ? { name: placeName }
          : { error: 'not found' }
      if (url.searchParams.get('debug')) body.debug = { finalUrl, snippet }
      return new Response(JSON.stringify(body), { headers: { ...CORS, 'content-type': 'application/json' } })
    }

    // ---- Sync ทริปข้ามเครื่อง (KV) ----
    const sm = url.pathname.match(/^\/api\/sync\/([A-Za-z0-9_-]{6,20})$/)
    if (sm) {
      const key = 'sync:' + sm[1].toUpperCase()
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
      if (request.method === 'GET') {
        const val = await env.SYNC.get(key)
        return new Response(val || 'null', { headers: { ...CORS, 'content-type': 'application/json' } })
      }
      if (request.method === 'PUT') {
        const body = await request.text()
        if (body.length > 1_000_000) return new Response('too large', { status: 413, headers: CORS })
        await env.SYNC.put(key, body, { expirationTtl: 60 * 60 * 24 * 365 }) // เก็บ 1 ปี
        return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'content-type': 'application/json' } })
      }
      return new Response('method not allowed', { status: 405, headers: CORS })
    }

    return new Response('Not found', { status: 404 })
  },
}
