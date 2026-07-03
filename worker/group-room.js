/**
 * GroupRoom — Durable Object หนึ่งตัวต่อหนึ่ง "ห้องกลุ่มทริป"
 * ใช้ WebSocket Hibernation API (ประหยัด ไม่กิน duration ตอนไม่มีข้อความ)
 * เก็บข้อมูลไรเดอร์ไว้ใน attachment ของแต่ละ socket → รอด hibernation
 *
 * โปรโตคอลข้อความ (JSON):
 *   client -> server:
 *     { type:'join', name, color, emoji }
 *     { type:'pos', lat, lng, heading?, speed?, ts }
 *     { type:'leave' }
 *   server -> client:
 *     { type:'snapshot', you, riders:[...] }      // ส่งให้คนที่เพิ่งเข้า
 *     { type:'join', rider }                        // มีคนใหม่เข้า
 *     { type:'pos', id, lat, lng, heading, speed, ts, name, color, emoji }
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

      // snapshot ของไรเดอร์คนอื่นที่มีตำแหน่งแล้ว
      const riders = []
      for (const other of this.state.getWebSockets()) {
        if (other === ws) continue
        const a = other.deserializeAttachment()
        if (a && a.id) riders.push(a)
      }
      ws.send(JSON.stringify({ type: 'snapshot', you: att.id, riders }))
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
