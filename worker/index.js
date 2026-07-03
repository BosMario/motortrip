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

    return new Response('Not found', { status: 404 })
  },
}
