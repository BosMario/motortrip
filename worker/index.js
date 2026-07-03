import { GroupRoom } from './group-room.js'

export { GroupRoom }

/** ดึงพิกัดจากลิงก์/ข้อความ Google Maps (เรียงตามความแม่นยำ) */
function extractCoords(s) {
  if (!s) return null
  let m
  m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
  if (m) return [+m[1], +m[2]]
  m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (m) return [+m[1], +m[2]]
  m = s.match(/[?&](?:q|query|destination|ll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  if (m) return [+m[1], +m[2]]
  return null
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
      if (!coords) {
        try {
          const r = await fetch(target, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } })
          coords = extractCoords(r.url) || extractCoords(await r.text())
        } catch {
          /* noop */
        }
      }
      return new Response(JSON.stringify(coords ? { lat: coords[0], lng: coords[1] } : { error: 'not found' }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      })
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
