import { GroupRoom } from './group-room.js'

export { GroupRoom }

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

    // ---- Sync ทริปข้ามเครื่อง (KV) ----
    const CORS = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type',
    }
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
