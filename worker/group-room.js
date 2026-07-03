/**
 * GroupRoom — Durable Object หนึ่งตัวต่อหนึ่ง "ห้องกลุ่มทริป"
 * ใช้ WebSocket Hibernation API (ประหยัด ไม่กิน duration ตอนไม่มีข้อความ)
 * เก็บข้อมูลไรเดอร์ไว้ใน attachment ของแต่ละ socket → รอด hibernation
 *
 * โปรโตคอลข้อความ (JSON):
 *   client -> server:
 *     { type:'join', name, color, emoji }
 *     { type:'pos', lat, lng, heading?, speed?, ts }
 *     { type:'route', route:{ name, waypoints:[{name,lat,lng},...] } }  // แชร์เส้นทางเข้าห้อง
 *     { type:'msg', text, emoji }                                        // ข้อความด่วน
 *     { type:'sos' }                                                     // ขอความช่วยเหลือ
 *     { type:'leave' }
 *   server -> client:
 *     { type:'snapshot', you, riders:[...], route }   // ส่งให้คนที่เพิ่งเข้า (รวมเส้นทางที่แชร์ไว้)
 *     { type:'join', rider }                          // มีคนใหม่เข้า
 *     { type:'pos', id, lat, lng, heading, speed, ts, name, color, emoji }
 *     { type:'route', route, setBy }                  // มีคนแชร์เส้นทาง
 *     { type:'msg', id, name, color, emoji, text, ts }
 *     { type:'sos', id, name, color, lat, lng, ts }
 *     { type:'leave', id }
 */
export class GroupRoom {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // รับ socket เข้าสู่ hibernation manager
    this.state.acceptWebSocket(server)

    // กำหนด id + attachment เริ่มต้น
    const id = crypto.randomUUID().slice(0, 8)
    server.serializeAttachment({ id, name: '', color: '#ea580c', emoji: '🏍️', lat: null, lng: null, ts: 0 })

    return new Response(null, { status: 101, webSocket: client })
  }

  broadcast(obj, except) {
    const msg = JSON.stringify(obj)
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue
      try {
        ws.send(msg)
      } catch {
        // ปล่อยผ่าน socket ที่ปิดไปแล้ว
      }
    }
  }

  async webSocketMessage(ws, message) {
    let data
    try {
      data = JSON.parse(message)
    } catch {
      return
    }
    const att = ws.deserializeAttachment() || {}

    if (data.type === 'join') {
      att.name = String(data.name || 'ไรเดอร์').slice(0, 24)
      att.color = typeof data.color === 'string' ? data.color.slice(0, 16) : '#ea580c'
      att.emoji = typeof data.emoji === 'string' ? data.emoji.slice(0, 8) : '🏍️'
      ws.serializeAttachment(att)

      // snapshot ของไรเดอร์คนอื่นที่มีตำแหน่งแล้ว + เส้นทางที่แชร์ไว้ในห้อง
      const riders = []
      for (const other of this.state.getWebSockets()) {
        if (other === ws) continue
        const a = other.deserializeAttachment()
        if (a && a.id) riders.push(a)
      }
      const route = await this.state.storage.get('route')
      ws.send(JSON.stringify({ type: 'snapshot', you: att.id, riders, route: route || null }))
      this.broadcast({ type: 'join', rider: att }, ws)
      return
    }

    if (data.type === 'pos') {
      att.lat = Number(data.lat)
      att.lng = Number(data.lng)
      att.heading = data.heading == null ? null : Number(data.heading)
      att.speed = data.speed == null ? null : Number(data.speed)
      att.ts = Number(data.ts) || Date.now()
      ws.serializeAttachment(att)
      this.broadcast(
        {
          type: 'pos',
          id: att.id,
          lat: att.lat,
          lng: att.lng,
          heading: att.heading,
          speed: att.speed,
          ts: att.ts,
          name: att.name,
          color: att.color,
          emoji: att.emoji,
        },
        ws
      )
      return
    }

    if (data.type === 'route') {
      // จำกัดขนาด: ชื่อ + จุดแวะ (กันข้อมูลใหญ่เกิน)
      const r = data.route || {}
      const route = {
        name: String(r.name || 'เส้นทางกลุ่ม').slice(0, 60),
        waypoints: Array.isArray(r.waypoints)
          ? r.waypoints.slice(0, 30).map((w) => ({
              name: String(w.name || '').slice(0, 80),
              lat: Number(w.lat),
              lng: Number(w.lng),
            }))
          : [],
      }
      await this.state.storage.put('route', route)
      this.broadcast({ type: 'route', route, setBy: att.name }) // ส่งให้ทุกคนรวมคนแชร์
      return
    }

    if (data.type === 'msg') {
      const text = String(data.text || '').slice(0, 120)
      if (!text) return
      this.broadcast({
        type: 'msg',
        id: att.id,
        name: att.name,
        color: att.color,
        emoji: typeof data.emoji === 'string' ? data.emoji.slice(0, 8) : '',
        text,
        ts: Date.now(),
      })
      return
    }

    if (data.type === 'sos') {
      this.broadcast({
        type: 'sos',
        id: att.id,
        name: att.name,
        color: att.color,
        lat: att.lat,
        lng: att.lng,
        ts: Date.now(),
      })
      return
    }

    if (data.type === 'leave') {
      this.broadcast({ type: 'leave', id: att.id }, ws)
      try {
        ws.close(1000, 'left')
      } catch {
        /* noop */
      }
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment()
    if (att && att.id) this.broadcast({ type: 'leave', id: att.id }, ws)
  }

  async webSocketError(ws) {
    const att = ws.deserializeAttachment && ws.deserializeAttachment()
    if (att && att.id) this.broadcast({ type: 'leave', id: att.id }, ws)
  }
}
