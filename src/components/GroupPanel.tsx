import { useEffect, useMemo, useState } from 'react'
import type { GroupMessage, Rider, RiderProfile, SharedRoute } from '../types'
import { formatDistance, haversine } from '../lib/format'
import { makeRoomCode } from '../lib/group'
import { shareUrl } from '../lib/share'

const EMOJIS = ['🏍️', '🛵', '🏁', '🔥', '⚡', '🦅', '🐆', '🐺', '🌟', '🎯']
const COLORS = ['#ea580c', '#2563eb', '#16a34a', '#db2777', '#9333ea', '#0d9488', '#d97706', '#dc2626']

/** ข้อความด่วนสำเร็จรูป (มือไม่ต้องพิมพ์ตอนขับ) */
const QUICK_MSGS: { text: string; emoji: string }[] = [
  { emoji: '🛢️', text: 'แวะปั๊ม' },
  { emoji: '☕', text: 'แวะพัก' },
  { emoji: '🖐️', text: 'รอด้วย' },
  { emoji: '🏍️', text: 'ไปต่อ' },
  { emoji: '👍', text: 'โอเค' },
  { emoji: '🍜', text: 'หิวข้าว' },
  { emoji: '⚠️', text: 'ระวังทาง' },
  { emoji: '🚻', text: 'เข้าห้องน้ำ' },
]

interface Props {
  roomCode: string | null
  connected: boolean
  riders: Rider[]
  myId: string | null
  sharing: boolean
  myPos: { lat: number; lng: number } | null
  error: string
  wakeActive: boolean
  wakeSupported: boolean
  defaultProfile: RiderProfile
  initialCode: string
  // ต่อยอดกลุ่ม
  waypointCount: number
  sharedRoute: SharedRoute | null
  messages: GroupMessage[]
  followId: string | null
  isAdmin: boolean
  inRoom: boolean
  onJoin: (code: string, profile: RiderProfile, isCreate: boolean) => void
  onLeave: () => void
  onToggleShare: (on: boolean) => void
  onFocusRider: (r: Rider) => void
  onNotify: (msg: string) => void
  onShareRoute: () => void
  onSendMessage: (text: string, emoji: string) => void
  onSOS: () => void
  onToggleFollow: (id: string) => void
}

export default function GroupPanel({
  roomCode,
  connected,
  riders,
  myId,
  sharing,
  myPos,
  error,
  wakeActive,
  wakeSupported,
  defaultProfile,
  initialCode,
  waypointCount,
  sharedRoute,
  messages,
  followId,
  isAdmin,
  onJoin,
  onLeave,
  onToggleShare,
  onFocusRider,
  onNotify,
  onShareRoute,
  onSendMessage,
  onSOS,
  onToggleFollow,
}: Props) {
  const [name, setName] = useState(defaultProfile.name)
  const [emoji, setEmoji] = useState(defaultProfile.emoji)
  const [color, setColor] = useState(defaultProfile.color)
  const [code, setCode] = useState(initialCode)
  const [, forceTick] = useState(0)
  const [msgCooldown, setMsgCooldown] = useState(false)

  // อัปเดต "เห็นล่าสุด" ทุก 3 วิ
  useEffect(() => {
    if (!roomCode) return
    const t = setInterval(() => forceTick((n) => n + 1), 3000)
    return () => clearInterval(t)
  }, [roomCode])

  const join = (c: string, isCreate = false) => {
    const clean = c.trim().toUpperCase()
    if (clean.length < 4) return onNotify('ใส่รหัสห้องอย่างน้อย 4 ตัว')
    onJoin(clean, { name: name.trim() || 'ไรเดอร์', emoji, color }, isCreate)
  }

  const shareLink = () => {
    if (!roomCode) return
    const url = `${location.origin}${location.pathname}#g=${roomCode}`
    shareUrl(url, `เข้าร่วมกลุ่มทริป (รหัส ${roomCode})`).then((r) =>
      onNotify(r === 'copied' ? 'คัดลอกลิงก์ห้องแล้ว 📋' : 'เปิดหน้าต่างแชร์แล้ว')
    )
  }

  // จัดเรียง roster: ฉันขึ้นก่อน แล้วตามชื่อ
  const roster = useMemo(() => {
    return [...riders].sort((a, b) => {
      if (a.id === myId) return -1
      if (b.id === myId) return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [riders, myId])

  // ---------- ยังไม่เข้าห้อง ----------
  if (!roomCode) {
    return (
      <div className="flex flex-col gap-4 pt-1">
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs rounded-xl p-3 leading-relaxed">
          👥 ตามหาเพื่อนร่วมทริปแบบเรียลไทม์ (รองรับ ~10 คัน)
          <br />
          ⚠️ บน iPhone ต้อง<b>เปิดแอปค้างไว้หน้าจอ</b>ระหว่างขับ (iOS ไม่ให้ติดตามตอนแอปอยู่พื้นหลัง) — แอปจะกันจอดับให้อัตโนมัติ
        </div>

        <div>
          <label className="label">ชื่อที่เพื่อนเห็น</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น พี่หนึ่ง / บิ๊กไบค์แดง"
            maxLength={24}
            className="field w-full mt-1.5 px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="label">ไอคอน</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-lg text-lg border transition active:scale-95 ${
                  emoji === e ? 'border-brand bg-brand/15' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">สีประจำตัว</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-white/70 ring-offset-ink-900' : ''}`}
                aria-label={`สี ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="รหัสห้อง (เช่น K7P2QX)"
              maxLength={12}
              className="field flex-1 px-3 py-2.5 text-sm tracking-widest font-mono uppercase"
            />
            <button onClick={() => join(code, false)} className="btn btn-ghost px-4 text-sm whitespace-nowrap">
              เข้าห้อง
            </button>
          </div>
          <button onClick={() => join(makeRoomCode(Date.now()), true)} className="btn btn-primary w-full py-3 text-sm">
            ✨ สร้างห้องใหม่ (คุณเป็นแอดมิน 👑)
          </button>
          <p className="text-[11px] text-dim text-center leading-relaxed">
            👑 <b>แอดมิน</b> (คนสร้างห้อง) วางแผนได้ · 👀 <b>สมาชิก</b> (เข้าผ่านลิงก์) ดูแผนอย่างเดียว
          </p>
        </div>
      </div>
    )
  }

  // ---------- อยู่ในห้อง ----------
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="card flex items-center justify-between px-3 py-2.5">
        <div>
          <div className="label">รหัสห้อง</div>
          <div className="text-lg font-bold font-mono tracking-widest">{roomCode}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] px-2 py-1 rounded-full font-medium border ${
              connected
                ? 'bg-green-500/15 text-green-300 border-green-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {connected ? '🟢 เชื่อมต่อ' : '🔄 กำลังต่อใหม่'}
          </span>
          <button onClick={shareLink} className="btn btn-primary text-sm px-3 py-1.5">
            🔗 ชวน
          </button>
        </div>
      </div>

      {/* ปุ่มแชร์ตำแหน่ง */}
      <button
        onClick={() => onToggleShare(!sharing)}
        className={`btn w-full py-3.5 text-base flex items-center justify-center gap-2 ${sharing ? 'btn-danger' : 'btn-primary'}`}
      >
        {sharing ? '⏹ หยุดแชร์ตำแหน่งฉัน' : '📍 เริ่มแชร์ตำแหน่งฉัน'}
      </button>
      {sharing && (
        <p className="text-[11px] text-dim text-center -mt-1">
          {wakeActive
            ? '🔆 กันจอดับอยู่ — วางมือถือให้เห็นจอ อย่าล็อก'
            : wakeSupported
              ? 'กำลังเปิดกันจอดับ…'
              : 'เบราว์เซอร์ไม่รองรับกันจอดับ — อย่าล็อกจอ'}
        </p>
      )}
      {error && <p className="text-xs text-[#ff6a5f] bg-[#ff3b30]/10 border border-[#ff3b30]/25 rounded-lg px-3 py-2">⚠️ {error}</p>}

      {/* ป้ายบทบาท */}
      <div
        className={`rounded-xl px-3 py-2 text-sm font-medium border ${
          isAdmin ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-white/[0.04] border-white/10 text-white/90'
        }`}
      >
        {isAdmin ? '👑 คุณเป็นแอดมิน — วางแผนทริปให้ทีมได้' : '👀 โหมดดู — ทำตามแผนที่แอดมินวางไว้'}
      </div>

      {/* เส้นทางกลุ่ม */}
      <div className="card p-3 flex flex-col gap-2">
        <div className="label">เส้นทางกลุ่ม</div>
        {sharedRoute ? (
          <div className="text-sm">
            🗺️ <b>{sharedRoute.name}</b> · {sharedRoute.waypoints.length} จุดแวะ
          </div>
        ) : (
          <div className="text-xs text-dim">
            {isAdmin ? 'วางแผนในแท็บ “แผนที่/จุดแวะ” แล้วระบบจะ sync ให้ทีมอัตโนมัติ' : 'รอแอดมินวางแผน…'}
          </div>
        )}
        {isAdmin && (
          <button
            onClick={onShareRoute}
            disabled={waypointCount < 2}
            className="btn btn-ghost w-full py-2 text-xs disabled:opacity-40"
          >
            📤 อัปเดตแผนให้ทีมทันที{waypointCount >= 2 ? '' : ' (ต้องมี ≥2 จุด)'}
          </button>
        )}
      </div>

      {/* ข้อความด่วน */}
      <div className="card p-3 flex flex-col gap-2">
        <div className="label">ส่งข้อความด่วน</div>
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_MSGS.map((m) => (
            <button
              key={m.text}
              disabled={msgCooldown}
              onClick={() => {
                onSendMessage(m.text, m.emoji)
                setMsgCooldown(true)
                setTimeout(() => setMsgCooldown(false), 1300) // กันกดรัว
              }}
              className="btn btn-ghost text-[11px] py-2 leading-tight flex flex-col items-center gap-0.5 disabled:opacity-40"
            >
              <span className="text-base leading-none">{m.emoji}</span>
              {m.text}
            </button>
          ))}
        </div>
        {messages.length > 0 && (
          <ul className="flex flex-col gap-1 mt-1 max-h-28 overflow-y-auto no-scrollbar">
            {messages.slice(-6).map((m, i) => (
              <li key={`${m.ts}-${i}`} className="text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="font-medium truncate" style={{ maxWidth: '35%' }}>
                  {m.name}
                </span>
                <span className="text-dim truncate">
                  {m.emoji} {m.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* SOS */}
      <button
        onClick={() => {
          if (window.confirm('ส่งสัญญาณ SOS + ตำแหน่งฉันให้ทุกคนในห้อง?')) onSOS()
        }}
        className="btn w-full py-2.5 text-sm font-bold border border-[#ff3b30]/40 text-[#ff6a5f] bg-[#ff3b30]/10"
      >
        🆘 ขอความช่วยเหลือ (SOS)
      </button>

      {/* รายชื่อไรเดอร์ */}
      <div>
        <div className="label mb-2 px-1">ไรเดอร์ในห้อง ({roster.length})</div>
        {roster.length === 0 ? (
          <p className="text-sm text-dim text-center py-4">ยังไม่มีใครในห้อง — กด “🔗 ชวน” ส่งลิงก์ให้เพื่อน</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((r) => {
              const me = r.id === myId
              const positioned = r.lat != null && r.lng != null
              const ago = r.ts ? Math.round((Date.now() - r.ts) / 1000) : null
              const stale = ago != null && ago > 20
              const dist =
                !me && positioned && myPos ? haversine(myPos, { lat: r.lat!, lng: r.lng! }) : null
              return (
                <li key={r.id} className="card-2 flex items-center gap-3 p-2.5">
                  <button
                    onClick={() => positioned && onFocusRider(r)}
                    disabled={!positioned}
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-base border-2 border-white/80 shadow disabled:opacity-40"
                    style={{ background: r.color }}
                  >
                    {r.emoji}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {r.name || 'ไรเดอร์'} {me && <span className="text-brand">(ฉัน)</span>}
                    </div>
                    <div className="text-xs text-dim">
                      {!positioned
                        ? 'ยังไม่แชร์ตำแหน่ง'
                        : stale
                          ? `⚠️ เงียบไป ${ago} วิ`
                          : me
                            ? sharing
                              ? 'กำลังแชร์'
                              : 'ยังไม่ได้แชร์'
                            : `เห็นล่าสุด ${ago ?? 0} วิที่แล้ว`}
                      {dist != null && (
                        <span className={dist > 2000 ? 'text-[#ff6a5f] font-medium' : ''}>
                          {' · '}
                          {dist > 2000 ? '⚠️ ห่าง ' : 'ห่าง '}
                          {formatDistance(dist)}
                        </span>
                      )}
                      {r.speed != null && r.speed > 0.5 && ` · ${Math.round(r.speed * 3.6)} กม./ชม.`}
                    </div>
                  </div>
                  {!me && positioned && (
                    <button
                      onClick={() => onToggleFollow(r.id)}
                      className={`w-8 h-8 shrink-0 rounded-lg text-sm transition active:scale-95 ${
                        followId === r.id ? 'chip-on' : 'btn-ghost'
                      }`}
                      aria-label="ตามคันนี้"
                      title="ตามคันนี้บนแผนที่"
                    >
                      🎯
                    </button>
                  )}
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      positioned && !stale ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-white/20'
                    }`}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button onClick={onLeave} className="btn btn-danger w-full py-2.5 text-sm mt-1">
        ออกจากห้อง
      </button>
    </div>
  )
}
