import { useState } from 'react'

interface Slide {
  icon: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: '🏍️',
    title: 'ยินดีต้อนรับสู่ SAKTECHTRIP',
    body: 'วางแผนทริปมอเตอร์ไซค์ครบจบในแอปเดียว — เส้นทาง จุดแวะ ร้าน อากาศ และขี่เป็นกลุ่มแบบเรียลไทม์ ฟรีทั้งหมด',
  },
  {
    icon: '🗺️',
    title: 'วางแผนง่าย ๆ',
    body: 'แท็บ “แผนที่” — ค้นหาปลายทาง หรือแตะ “ปักหมุด” บนแผนที่ → ได้เส้นทาง ระยะทาง และเวลาอัตโนมัติ · แท็บ “จุดแวะ” จัดลำดับ/แบ่งวันได้',
  },
  {
    icon: '⛽',
    title: 'ครบเครื่องระหว่างทาง',
    body: 'แท็บ “ร้าน” หาปั๊ม / คาเฟ่ / ร้านอาหาร / จุดชาร์จ EV ตามเส้นทาง · แท็บ “สรุป” เช็คอากาศ ความชัน และงบน้ำมันก่อนออกเดินทาง',
  },
  {
    icon: '👥',
    title: 'ขี่เป็นกลุ่ม',
    body: 'แท็บ “กลุ่ม” — สร้างห้องแล้วชวนเพื่อน เห็นตำแหน่งทุกคันสด ๆ, รู้ว่าใครนำ/ตามหลัง, เช็คอินจุดนัด และปุ่ม SOS ฉุกเฉิน',
  },
]

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  return (
    <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm card p-5 flex flex-col gap-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="label">
            👋 วิธีใช้ ({i + 1}/{SLIDES.length})
          </span>
          <button onClick={onClose} className="text-xs text-dim active:scale-95">
            ข้าม
          </button>
        </div>

        <div className="text-center py-5">
          <div
            className="w-20 h-20 mx-auto rounded-2xl grid place-items-center text-4xl mb-4"
            style={{ background: 'radial-gradient(120% 120% at 30% 20%, #2a2a2f, #141416)' }}
          >
            {s.icon}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{s.title}</h2>
          <p className="text-sm text-dim mt-2 leading-relaxed">{s.body}</p>
        </div>

        <div className="flex justify-center gap-1.5">
          {SLIDES.map((_, j) => (
            <span key={j} className={`h-2 rounded-full transition-all ${j === i ? 'w-5 bg-brand' : 'w-2 bg-white/20'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="btn btn-ghost py-3 px-5">
              ย้อน
            </button>
          )}
          <button onClick={() => (last ? onClose() : setI(i + 1))} className="btn btn-primary py-3 flex-1">
            {last ? '🏍️ เริ่มใช้งานเลย' : 'ถัดไป →'}
          </button>
        </div>
      </div>
    </div>
  )
}
