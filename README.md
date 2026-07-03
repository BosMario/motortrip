# 🏍️ Moto Trip Planner

PWA วางแผนทริปมอเตอร์ไซค์ — เพิ่มจุดแวะ คำนวณเส้นทาง/ระยะทาง/เวลา หาร้านกาแฟ–อาหารตามเส้นทาง บันทึกและแชร์ทริปได้ทันที **ฟรี ไม่ต้องมี backend ไม่ต้องมี API key**

ออกแบบมาสำหรับใช้บน **iPhone ผ่าน Safari แบบ PWA** (Add to Home Screen) — mobile-first, รองรับ safe-area (Dynamic Island / home indicator), dark mode ตามระบบ

---

## ฟีเจอร์ (MVP)

- 🗺️ **แผนที่ OpenStreetMap** (ฟรี ไม่ต้องมีคีย์) ผ่าน Leaflet
- 🔍 **ค้นหาสถานที่** ด้วย Nominatim แล้วเพิ่มเป็นจุดแวะ
- 📍 **ปักหมุดเอง (custom POI)** โดยแตะบนแผนที่ + ตั้งชื่อ
- 🧭 **คำนวณเส้นทางอัตโนมัติ** ด้วย OSRM — ระยะทางรวม/แต่ละช่วง + เวลา (เผื่อ buffer 20% สำหรับพัก)
- 🛑 **จุดพักทุก ~100 กม.** ไฮไลต์บนแผนที่
- ☕🍜 **ค้นหาร้านกาแฟ/อาหารตามเส้นทาง** (รัศมี 3 กม.) ด้วย Overpass API — คาเฟ่=ส้ม, ร้านอาหาร=เขียว, กดเพิ่มเป็นจุดแวะ หรือเปิดใน Google Maps ได้
- 💾 **บันทึก/โหลดทริป** ผ่าน localStorage
- 🔗 **แชร์ทริปเป็นลิงก์** (encode ลง URL hash, ไม่ต้องมี backend) + รองรับ Web Share API (share sheet ของ iOS)
- 📸 **การ์ดสรุปทริป** สำหรับแคปหน้าจอส่งเข้ากลุ่ม LINE
- 👥 **กลุ่มทริป realtime** — สร้าง/เข้าห้องด้วยรหัส แชร์ตำแหน่งสดระหว่างเพื่อน ~10 คัน เห็นแต่ละคันบนแผนที่แบบเรียลไทม์ (ผ่าน Cloudflare Durable Objects + WebSocket) พร้อม Wake Lock กันจอดับระหว่างขับ

## Tech Stack

Vite + React 18 + TypeScript · Tailwind CSS · Leaflet + react-leaflet · OSRM / Overpass / Nominatim (public API) · localStorage
**Realtime:** Cloudflare Workers + Durable Objects (WebSocket hibernation)

## รันในเครื่อง (Dev)

```bash
npm install
npm run dev
```

เปิด http://localhost:5173 — หรือเข้าจากมือถือในวง Wi-Fi เดียวกันผ่าน Network URL ที่ Vite แสดง

**ถ้าจะทดสอบฟีเจอร์กลุ่มทริป (realtime)** ให้รัน backend ควบคู่ในอีก terminal:

```bash
npm run worker:dev     # = wrangler dev (Durable Object จำลองในเครื่องผ่าน Miniflare, port 8787)
```

ไฟล์ `.env.local` ตั้ง `VITE_GROUP_WS=ws://localhost:8787` ให้แล้วสำหรับ dev — แอปจะต่อ WebSocket ไปที่ Worker ในเครื่อง

## Build

```bash
npm run build      # ผลลัพธ์อยู่ในโฟลเดอร์ dist/
npm run preview    # ลองรันไฟล์ที่ build แล้ว
```

## Deploy → Cloudflare Pages

**วิธีที่ 1 — Wrangler CLI**

```bash
npm run build
npx wrangler pages deploy dist        # หรือ: npm run deploy
```

**วิธีที่ 2 — Dashboard**

1. `npm run build`
2. ไปที่ Cloudflare Dashboard → Workers & Pages → Create → Pages → Upload assets
3. ลากโฟลเดอร์ `dist` ขึ้นไป (หรือเชื่อม Git repo แล้วตั้ง Build command = `npm run build`, Output = `dist`)

ไฟล์ `public/_redirects` (SPA fallback) และ `public/_headers` (cache + manifest content-type) ถูกเตรียมไว้ให้แล้ว

### Deploy backend กลุ่มทริป (Cloudflare Worker + Durable Object)

ฟีเจอร์กลุ่มทริปต้อง deploy Worker แยกจาก Pages (ยังฟรีได้ — Durable Object ใช้ SQLite backend บน free plan):

```bash
npx wrangler login          # ครั้งแรกครั้งเดียว
npm run worker:deploy       # = wrangler deploy → ได้ URL เช่น https://moto-trip-group.<subdomain>.workers.dev
```

จากนั้นตั้ง env ตอน build frontend ให้ชี้ไป Worker (คัดจาก `.env.example`):

```bash
# .env  (หรือ .env.production)
VITE_GROUP_WS=wss://moto-trip-group.<subdomain>.workers.dev
```

แล้วค่อย `npm run build` + deploy Pages ตามด้านบน เพื่อให้แอปโปรดักชันต่อ WebSocket ไปห้องกลุ่มได้

> **หมายเหตุ iOS:** PWA บน iPhone ติดตามตำแหน่งได้เฉพาะตอนเปิดแอปค้างหน้าจอ (iOS suspend JS/GPS เมื่อแอปอยู่พื้นหลัง) — แอปใช้ **Screen Wake Lock** กันจอดับให้อัตโนมัติระหว่างแชร์ตำแหน่ง แนะนำตั้งมือถือบนแฮนด์และเปิดแอปทิ้งไว้

## ติดตั้งบน iPhone (Add to Home Screen)

1. เปิดเว็บที่ deploy แล้วใน **Safari**
2. กดปุ่มแชร์ → **Add to Home Screen**
3. เปิดจากไอคอนบนหน้าจอ — จะรันแบบเต็มจอ (standalone) เหมือนแอปจริง

## ข้อควรรู้เรื่อง Public API

แอปใช้เซิร์ฟเวอร์สาธารณะที่มี rate limit:

- **Nominatim** — จำกัด ~1 request/วินาที (แอปใส่ debounce 800ms ให้แล้ว)
- **OSRM demo server** — สำหรับทดลอง อาจช้า/ล่มเป็นครั้งคราว (มี loading + error message ภาษาไทย)
- **Overpass API** — คิวรีหนักอาจถูก throttle (แอป sample จุดตามเส้นทางเพื่อลดโหลด)

ทุก request มี `AbortController` + แสดงสถานะ/ข้อผิดพลาดเป็นภาษาไทย หากต้องใช้งานจริงจังแนะนำ self-host OSRM/Overpass หรือใช้ผู้ให้บริการที่มีคีย์

## โครงสร้างโปรเจกต์

```
public/
  manifest.json          PWA manifest
  icons/                 ไอคอน SVG + PNG (180/192/512)
  _headers, _redirects   config สำหรับ Cloudflare Pages
scripts/gen-icons.mjs    สร้างไอคอน PNG จากดีไซน์ (ไม่ต้องพึ่ง dependency)
worker/                  backend กลุ่มทริป realtime
  index.js               Worker: route WebSocket → Durable Object
  group-room.js          GroupRoom Durable Object (broadcast ตำแหน่ง)
wrangler.toml            config Worker + Durable Object
src/
  lib/                   osrm, overpass, nominatim, storage, share, format, markers, poiMeta, group
  hooks/                 useDebounced, useWakeLock, useGroup
  components/            MapView, BottomSheet, SearchBox, WaypointList, TripSummary,
                         SavedTrips, PoiList, SavedPlaces, GroupPanel
  App.tsx                รวมทุกอย่าง
```

## Phase 2 (ไอเดียต่อยอด)

- ย้าย localStorage → Cloudflare Workers + KV/D1 เพื่อ sync ข้ามเครื่อง
- Export เส้นทางเป็น **GPX** สำหรับ import เข้าแอปนำทางอื่น
- แสดงพยากรณ์อากาศรายจุด (Open-Meteo API)
- แชร์รูป/รีวิวร้านของแต่ละทริป

---

สร้างด้วย ❤️ สำหรับสายทริปมอเตอร์ไซค์
