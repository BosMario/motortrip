import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import BottomSheet, { type SheetSnap } from './components/BottomSheet'
import SearchBox from './components/SearchBox'
import WaypointList from './components/WaypointList'
import TripSummary from './components/TripSummary'
import SavedTrips from './components/SavedTrips'
import PoiList from './components/PoiList'
import SavedPlaces from './components/SavedPlaces'
import GroupPanel from './components/GroupPanel'
import WeatherPanel from './components/WeatherPanel'
import { fetchTripWeather, type WeatherPoint } from './lib/weather'
import { useGroup, loadProfile } from './hooks/useGroup'
import type { Poi, PoiKind, Rider, RouteData, SavedPlace, Trip, Waypoint } from './types'
import { fetchRoute } from './lib/osrm'
import { fetchPois } from './lib/overpass'
import { KIND_META } from './lib/poiMeta'
import { reverseGeocode, type SearchResult } from './lib/nominatim'
import { toPng } from 'html-to-image'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  deleteTrip as delTrip,
  deletePlace,
  loadPlaces,
  loadTrips,
  placeKey,
  togglePlace,
  upsertTrip,
} from './lib/storage'
import { decodeTripFromUrl, encodeTripToUrl, shareUrl } from './lib/share'
import { formatDistance, formatDuration, haversine, uid } from './lib/format'
import { useDebounced } from './hooks/useDebounced'

type Tab = 'plan' | 'summary' | 'saved' | 'group'

/** อ่านรหัสห้องกลุ่มจาก URL (#g=CODE) ตอนเปิดแอป */
function readGroupCode(): string {
  const m = location.hash.match(/[#&]g=([A-Za-z0-9_-]{4,12})/)
  return m ? m[1].toUpperCase() : ''
}

/** จุดเริ่มต้นเริ่มต้นของทุกทริปใหม่ — โรงแรมสีหราช อุตรดิตถ์ */
const DEFAULT_START: Omit<Waypoint, 'id'> = {
  name: 'โรงแรมสีหราช อุตรดิตถ์',
  lat: 17.61512,
  lng: 100.0908,
}
const makeDefaultStart = (): Waypoint => ({ ...DEFAULT_START, id: uid() })

const ALL_KINDS: PoiKind[] = ['fuel', 'cafe', 'restaurant']

export default function App() {
  const [name, setName] = useState('ทริปใหม่')
  const [date, setDate] = useState('')
  const [currentId, setCurrentId] = useState(() => uid())
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => [makeDefaultStart()])

  const [route, setRoute] = useState<RouteData | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')

  const [pois, setPois] = useState<Poi[]>([])
  const [poiLoading, setPoiLoading] = useState(false)
  const [poiError, setPoiError] = useState('')
  const [kinds, setKinds] = useState<Set<PoiKind>>(() => new Set(ALL_KINDS))

  const [addingPoint, setAddingPoint] = useState(false)
  const [roundTrip, setRoundTrip] = useState(false)
  const [locating, setLocating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [weather, setWeather] = useState<WeatherPoint[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState('')
  const [weatherUsedToday, setWeatherUsedToday] = useState(false)
  const weatherCtrl = useRef<AbortController | null>(null)
  const weatherKey = useRef('')
  const summaryRef = useRef<HTMLDivElement>(null)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // เช็คเวอร์ชันใหม่ตอนเปิด + ทุก 1 นาที (กันค้างแคช)
      if (reg) setInterval(() => reg.update().catch(() => {}), 60_000)
    },
  })
  const [savedTrips, setSavedTrips] = useState<Trip[]>([])
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null)
  const [tab, setTab] = useState<Tab>(() => (readGroupCode() ? 'group' : 'plan'))
  const [snap, setSnap] = useState<SheetSnap>('half')
  const [toast, setToast] = useState('')

  const group = useGroup()
  const [groupInitialCode] = useState(readGroupCode)
  const [profile] = useState(loadProfile)
  const [followId, setFollowId] = useState<string | null>(null)
  const lastMsgTs = useRef(0)
  const lastSosTs = useRef(0)

  const savedKeys = useMemo(() => new Set(savedPlaces.map((p) => placeKey(p))), [savedPlaces])

  // กรอง POI ที่แสดงตามหมวดที่เลือก (สลับ chip แล้วซ่อน/โชว์ทันทีไม่ต้องค้นใหม่)
  const visiblePois = useMemo(() => pois.filter((p) => kinds.has(p.kind)), [pois, kinds])

  const toggleKind = (k: PoiKind) =>
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next.size === 0 ? new Set(ALL_KINDS) : next // กันเลือกว่างทั้งหมด
    })

  const routeCtrl = useRef<AbortController | null>(null)
  const poiCtrl = useRef<AbortController | null>(null)

  // ไป-กลับ: ต่อจุดเริ่มไว้ท้ายสุดสำหรับคำนวณเส้นทาง (ไม่กระทบรายการจุดแวะที่แสดง)
  const routeWaypoints = useMemo(
    () =>
      roundTrip && waypoints.length >= 2
        ? [...waypoints, { ...waypoints[0], id: waypoints[0].id + '#ret' }]
        : waypoints,
    [roundTrip, waypoints]
  )
  const debouncedWps = useDebounced(routeWaypoints, 600)

  const notify = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }, [])

  // มีเวอร์ชันใหม่ → อัปเดต+รีโหลดอัตโนมัติ (ไม่ต้องล้างแคชเอง)
  useEffect(() => {
    if (needRefresh) {
      notify('กำลังอัปเดตเป็นเวอร์ชันใหม่…')
      updateServiceWorker(true)
    }
  }, [needRefresh, notify, updateServiceWorker])

  // โหลดทริปที่บันทึก + ตรวจ URL แชร์ตอนเปิดแอป
  useEffect(() => {
    setSavedTrips(loadTrips())
    setSavedPlaces(loadPlaces())
    const shared = decodeTripFromUrl()
    if (shared) {
      setName(shared.name)
      setDate(shared.date)
      setWaypoints(shared.waypoints)
      setCurrentId(shared.id)
      history.replaceState(null, '', location.pathname) // เคลียร์ hash
      notify('เปิดทริปที่แชร์มาแล้ว')
    }
  }, [notify])

  // คำนวณเส้นทางเมื่อ waypoints เปลี่ยน (debounce กัน OSRM rate limit)
  useEffect(() => {
    if (debouncedWps.length < 2) {
      setRoute(null)
      setRouteError('')
      return
    }
    routeCtrl.current?.abort()
    const ac = new AbortController()
    routeCtrl.current = ac
    setRouteLoading(true)
    setRouteError('')
    fetchRoute(debouncedWps, ac.signal)
      .then(setRoute)
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setRouteError(e.message || 'คำนวณเส้นทางไม่สำเร็จ')
          setRoute(null)
        }
      })
      .finally(() => setRouteLoading(false))
    return () => ac.abort()
  }, [debouncedWps])

  // จุดพักทุก ~100 กม. ตามแนวเส้นทาง
  const restPoints = useMemo<[number, number][]>(() => {
    if (!route || route.coordinates.length < 2) return []
    const pts: [number, number][] = []
    let acc = 0
    const STEP = 100_000
    let nextMark = STEP
    for (let i = 1; i < route.coordinates.length; i++) {
      const [la1, ln1] = route.coordinates[i - 1]
      const [la2, ln2] = route.coordinates[i]
      acc += haversine({ lat: la1, lng: ln1 }, { lat: la2, lng: ln2 })
      while (acc >= nextMark) {
        pts.push(route.coordinates[i])
        nextMark += STEP
      }
    }
    return pts
  }, [route])

  const addWaypoint = (w: Omit<Waypoint, 'id'>) => {
    setWaypoints((prev) => [...prev, { ...w, id: uid() }])
    if (snap === 'peek') setSnap('half')
  }

  const onPickSearch = (r: SearchResult) => {
    const short = r.name.split(',')[0]
    addWaypoint({ name: short, lat: r.lat, lng: r.lng })
    notify(`เพิ่ม “${short}” แล้ว`)
  }

  const onMapClick = (lat: number, lng: number) => {
    const label = window.prompt('ตั้งชื่อจุดที่ปัก (custom POI):', `จุดแวะ ${waypoints.length + 1}`)
    if (label === null) return
    addWaypoint({ name: label.trim() || `จุดแวะ ${waypoints.length + 1}`, lat, lng, custom: true })
    setAddingPoint(false)
    notify('ปักหมุดเรียบร้อย')
  }

  const removeWaypoint = (id: string) => setWaypoints((prev) => prev.filter((w) => w.id !== id))

  const reorderWaypoints = (from: number, to: number) =>
    setWaypoints((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) return notify('อุปกรณ์ไม่รองรับระบุตำแหน่ง')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        const nm = await reverseGeocode(lat, lng).catch(() => 'ตำแหน่งของฉัน')
        setWaypoints((prev) => {
          const wp: Waypoint = { id: uid(), name: `📍 ${nm}`, lat, lng }
          return prev.length ? [wp, ...prev.slice(1)] : [wp] // แทนจุดเริ่ม
        })
        setLocating(false)
        notify('ตั้งจุดเริ่มเป็นตำแหน่งปัจจุบันแล้ว')
      },
      (e) => {
        setLocating(false)
        notify(e.code === e.PERMISSION_DENIED ? 'ไม่ได้รับอนุญาตเข้าถึงตำแหน่ง' : 'หาตำแหน่งไม่ได้')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const fetchWeather = async () => {
    if (waypoints.length === 0) return notify('เพิ่มจุดแวะก่อนนะ')
    weatherCtrl.current?.abort()
    const ac = new AbortController()
    weatherCtrl.current = ac
    setWeatherLoading(true)
    setWeatherError('')
    try {
      const { points, usedToday } = await fetchTripWeather(
        waypoints.map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
        date,
        ac.signal
      )
      setWeather(points)
      setWeatherUsedToday(usedToday)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setWeatherError('ดึงพยากรณ์อากาศไม่สำเร็จ ลองใหม่')
    } finally {
      setWeatherLoading(false)
    }
  }

  // โหลดพยากรณ์อัตโนมัติเมื่อเปิดแท็บสรุป / เปลี่ยนวัน-จุดแวะ (ไม่ต้องกดหาเอง)
  useEffect(() => {
    if (tab !== 'summary' || waypoints.length === 0) return
    const key = date + '|' + waypoints.map((w) => `${w.lat},${w.lng}`).join(';')
    if (key === weatherKey.current) return
    weatherKey.current = key
    fetchWeather()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date, waypoints])

  const exportSummary = async () => {
    if (!summaryRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(summaryRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0a0a0c' })
      const file = new File([await (await fetch(dataUrl)).blob()], `moto-trip-${name || 'trip'}.png`, {
        type: 'image/png',
      })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => {})
        notify('เปิดหน้าต่างแชร์รูปแล้ว 📸')
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = file.name
        a.click()
        notify('บันทึกรูปสรุปทริปแล้ว 📸')
      }
    } catch {
      notify('สร้างรูปไม่สำเร็จ ลองใหม่')
    } finally {
      setExporting(false)
    }
  }

  const addPoiAsWaypoint = (poi: Poi) => {
    addWaypoint({ name: poi.name, lat: poi.lat, lng: poi.lng, custom: true })
    notify(`เพิ่ม “${poi.name}” เป็นจุดแวะ`)
  }

  const toggleSavePlace = (poi: Poi) => {
    const wasSaved = savedKeys.has(placeKey(poi))
    setSavedPlaces(togglePlace({ ...poi, savedAt: Date.now() }))
    notify(wasSaved ? 'เอาออกจากที่บันทึกแล้ว' : `บันทึก “${poi.name}” ❤️`)
  }

  const focusPoi = (poi: Poi) => {
    setFocus({ lat: poi.lat, lng: poi.lng, nonce: Date.now() })
    if (snap === 'full') setSnap('half')
  }

  const focusRider = (r: Rider) => {
    if (r.lat == null || r.lng == null) return
    setFocus({ lat: r.lat, lng: r.lng, nonce: Date.now() })
    if (snap === 'full') setSnap('half')
  }

  // ---- ต่อยอดกลุ่มทริป ----
  const shareMyRoute = () => {
    if (waypoints.length < 2) return notify('ต้องมีอย่างน้อย 2 จุด')
    group.shareRoute({
      name: name || 'เส้นทางกลุ่ม',
      waypoints: waypoints.map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
    })
    notify('แชร์เส้นทางให้กลุ่มแล้ว 📤')
  }

  const useSharedRoute = () => {
    const r = group.sharedRoute
    if (!r) return
    setWaypoints(r.waypoints.map((w) => ({ ...w, id: uid() })))
    setTab('plan')
    notify(`ใช้เส้นทาง “${r.name}” แล้ว`)
  }

  const toggleFollow = (id: string) => setFollowId((prev) => (prev === id ? null : id))

  // แผนที่ตามคันที่เลือก (recenter ทุกครั้งที่ตำแหน่งอัปเดต)
  useEffect(() => {
    if (!followId) return
    const r = group.positioned.find((x) => x.id === followId)
    if (r && r.lat != null && r.lng != null) setFocus({ lat: r.lat, lng: r.lng, nonce: r.ts || Date.now() })
  }, [followId, group.positioned])

  // toast ข้อความด่วนจากเพื่อน
  useEffect(() => {
    const m = group.messages[group.messages.length - 1]
    if (!m || m.ts === lastMsgTs.current) return
    lastMsgTs.current = m.ts
    if (m.id !== group.myId) notify(`${m.emoji} ${m.name}: ${m.text}`)
  }, [group.messages, group.myId, notify])

  // แจ้งเตือน SOS
  useEffect(() => {
    const s = group.sos
    if (!s || s.ts === lastSosTs.current) return
    lastSosTs.current = s.ts
    if (s.id === group.myId) return notify('ส่งสัญญาณ SOS แล้ว 🆘')
    notify(`🆘 ${s.name} ขอความช่วยเหลือ!`)
    if (s.lat != null && s.lng != null) setFocus({ lat: s.lat, lng: s.lng, nonce: s.ts })
    setTab('group')
  }, [group.sos, group.myId, notify])

  const removePlace = (key: string) => setSavedPlaces(deletePlace(key))

  const searchPois = async () => {
    const coords = route?.coordinates?.length
      ? route.coordinates
      : waypoints.map((w) => [w.lat, w.lng] as [number, number])
    if (coords.length === 0) {
      notify('เพิ่มจุดแวะก่อนนะ')
      return
    }
    poiCtrl.current?.abort()
    const ac = new AbortController()
    poiCtrl.current = ac
    setPoiLoading(true)
    setPoiError('')
    try {
      const found = await fetchPois(coords, Array.from(kinds), 3000, ac.signal)
      setPois(found)
      notify(found.length ? `พบ ${found.length} จุดตามเส้นทาง` : 'ไม่พบจุดในรัศมี 3 กม.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setPoiError('ดึงข้อมูลร้านไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setPoiLoading(false)
    }
  }

  const currentTrip = (): Trip => ({
    id: currentId,
    name,
    date,
    waypoints,
    updatedAt: Date.now(),
  })

  const saveTrip = () => {
    if (waypoints.length === 0) {
      notify('ยังไม่มีจุดแวะให้บันทึก')
      return
    }
    setSavedTrips(upsertTrip(currentTrip()))
    notify('บันทึกทริปแล้ว ✓')
  }

  const loadTrip = (t: Trip) => {
    setName(t.name)
    setDate(t.date)
    setWaypoints(t.waypoints)
    setCurrentId(t.id)
    setPois([])
    setTab('plan')
    notify(`เปิดทริป “${t.name}”`)
  }

  const removeTrip = (id: string) => {
    if (!window.confirm('ลบทริปนี้?')) return
    setSavedTrips(delTrip(id))
  }

  const newTrip = () => {
    setName('ทริปใหม่')
    setDate('')
    setWaypoints([makeDefaultStart()])
    setPois([])
    setRoute(null)
    setCurrentId(uid())
    setTab('plan')
  }

  const onShare = async () => {
    if (waypoints.length === 0) {
      notify('เพิ่มจุดแวะก่อนแชร์นะ')
      return
    }
    const url = encodeTripToUrl(currentTrip())
    const res = await shareUrl(url, `ทริป: ${name}`)
    notify(res === 'copied' ? 'คัดลอกลิงก์แล้ว 📋' : 'เปิดหน้าต่างแชร์แล้ว')
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* แผนที่เต็มจอ */}
      <div className="absolute inset-0">
        <MapView
          waypoints={waypoints}
          routeCoords={route?.coordinates ?? []}
          restPoints={restPoints}
          pois={visiblePois}
          riders={group.positioned}
          myId={group.myId}
          addingPoint={addingPoint}
          focus={focus}
          onMapClick={onMapClick}
          onRemoveWaypoint={removeWaypoint}
          onAddPoi={addPoiAsWaypoint}
        />
      </div>

      {/* แถบบนสุด: ชื่อแอป + ปุ่มปักหมุด/ทริปใหม่ */}
      <div className="absolute top-0 inset-x-0 pt-safe z-[1100] pointer-events-none">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pointer-events-none">
          <div className="pointer-events-auto rounded-full pl-2.5 pr-4 py-2 flex items-center gap-2 border border-white/10 bg-black/55 backdrop-blur-xl shadow-card">
            <span className="w-6 h-6 rounded-full grid place-items-center text-[13px]" style={{ background: 'linear-gradient(135deg,#ff7a45,#ff2d55)' }}>🏍️</span>
            <span className="font-bold text-sm tracking-tight">MOTO<span className="text-brand">TRIP</span></span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => setAddingPoint((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-xl border transition active:scale-95 ${
                addingPoint
                  ? 'text-white border-transparent shadow-glow'
                  : 'text-white/90 border-white/10 bg-black/55'
              }`}
              style={addingPoint ? { background: 'linear-gradient(135deg,#ff7a45,#ff2d55)' } : undefined}
            >
              {addingPoint ? '📍 แตะแผนที่…' : '📍 ปักหมุด'}
            </button>
            <button
              onClick={newTrip}
              className="rounded-full w-10 h-10 grid place-items-center text-lg border border-white/10 bg-black/55 backdrop-blur-xl text-white/90 active:scale-95 transition"
              aria-label="ทริปใหม่"
            >
              ＋
            </button>
          </div>
        </div>
        {addingPoint && (
          <p className="mx-3 mt-2 text-xs text-white rounded-lg px-3 py-1.5 pointer-events-auto inline-block shadow-glow" style={{ background: 'linear-gradient(135deg,#ff7a45,#ff2d55)' }}>
            แตะตำแหน่งบนแผนที่เพื่อปักหมุดจุดแวะเอง
          </p>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div className="absolute top-safe left-1/2 -translate-x-1/2 mt-16 z-[1300] pointer-events-none">
          <div className="border border-white/10 bg-black/80 backdrop-blur-xl text-white text-sm px-4 py-2 rounded-full shadow-card">{toast}</div>
        </div>
      )}

      {/* Bottom sheet */}
      <BottomSheet
        snap={snap}
        onSnapChange={setSnap}
        header={
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
            {(
              [
                ['plan', 'วางแผน'],
                ['summary', 'สรุป'],
                ['saved', 'บันทึก'],
                ['group', group.roomCode ? `กลุ่ม·${group.riders.length}` : 'กลุ่ม'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  if (snap === 'peek') setSnap('half')
                }}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold tracking-tight transition ${
                  tab === t ? 'bg-white/[0.08] text-white shadow-inner ring-1 ring-white/10' : 'text-dim'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'plan' && (
          <div className="flex flex-col gap-3 pt-1">
            <SearchBox onPick={onPickSearch} />

            <button
              onClick={useCurrentLocation}
              disabled={locating}
              className="btn btn-ghost w-full py-2.5 text-sm disabled:opacity-50"
            >
              {locating ? 'กำลังหาตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบันเป็นจุดเริ่ม'}
            </button>

            {/* สถานะเส้นทาง — การ์ดสถิติ */}
            <div className="card px-4 py-3">
              {routeLoading ? (
                <span className="text-dim animate-pulse text-sm">กำลังคำนวณเส้นทาง…</span>
              ) : route ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label">ระยะทางรวม</div>
                    <div className="text-2xl font-bold tracking-tight mt-0.5">{formatDistance(route.distance)}</div>
                  </div>
                  <div>
                    <div className="label">เวลา (เผื่อพัก)</div>
                    <div className="text-2xl font-bold tracking-tight mt-0.5">{formatDuration(route.duration, true)}</div>
                  </div>
                </div>
              ) : (
                <span className="text-dim text-sm">เพิ่ม ≥ 2 จุดเพื่อคำนวณเส้นทาง</span>
              )}
            </div>
            {routeError && (
              <p className="text-xs text-[#ff6a5f] bg-[#ff3b30]/10 border border-[#ff3b30]/25 rounded-lg px-3 py-2">
                ⚠️ {routeError}
              </p>
            )}

            {/* ไป-กลับ */}
            <button
              onClick={() => setRoundTrip((v) => !v)}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm border transition ${
                roundTrip ? 'chip-on' : 'card-2 text-dim'
              }`}
            >
              <span>🔁 ทริปไป-กลับ (วนกลับจุดเริ่ม)</span>
              <span
                className={`w-9 h-5 rounded-full relative transition ${roundTrip ? 'bg-white/30' : 'bg-white/10'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${roundTrip ? 'left-[18px]' : 'left-0.5'}`}
                />
              </span>
            </button>

            <WaypointList waypoints={waypoints} route={route} onRemove={removeWaypoint} onReorder={reorderWaypoints} />

            {/* ค้นหาจุดแวะตามเส้นทาง */}
            <div className="border-t border-white/[0.07] pt-3">
              {/* เลือกหมวดที่จะค้นหา */}
              <div className="flex gap-1.5 mb-2">
                {ALL_KINDS.map((k) => {
                  const on = kinds.has(k)
                  const meta = KIND_META[k]
                  return (
                    <button
                      key={k}
                      onClick={() => toggleKind(k)}
                      className={`chip flex-1 py-2 ${on ? 'chip-on' : ''}`}
                    >
                      {meta.emoji} {meta.label}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={searchPois}
                disabled={poiLoading}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {poiLoading ? 'กำลังค้นหา…' : '🔎 ค้นหาจุดแวะตามเส้นทาง'}
              </button>
              {poiError && <p className="text-xs text-[#ff6a5f] mt-2">⚠️ {poiError}</p>}
              {visiblePois.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <span className="text-xs text-dim">
                      ⛽ {visiblePois.filter((p) => p.kind === 'fuel').length} · ☕{' '}
                      {visiblePois.filter((p) => p.kind === 'cafe').length} · 🍜{' '}
                      {visiblePois.filter((p) => p.kind === 'restaurant').length} · เรียงตามนิยม
                    </span>
                    <button onClick={() => setPois([])} className="text-xs text-[#ff6a5f]">
                      ล้างผลลัพธ์
                    </button>
                  </div>
                  <p className="text-[11px] text-dim mb-2 leading-snug">
                    * อันดับประเมินจากความครบถ้วนของข้อมูล OSM (ไม่มีคะแนนรีวิว) — แตะรูปเพื่อดูบนแผนที่ · กดหมวดด้านบนเพื่อกรอง
                  </p>
                  <PoiList
                    pois={visiblePois}
                    savedKeys={savedKeys}
                    onToggleSave={toggleSavePlace}
                    onAddWaypoint={addPoiAsWaypoint}
                    onFocus={focusPoi}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'summary' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <label className="label flex flex-col gap-1.5">
                ชื่อทริป
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field px-3 py-2.5 text-sm normal-case tracking-normal"
                />
              </label>
              <label className="label flex flex-col gap-1.5">
                วันเริ่มทริป
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="field px-3 py-2.5 text-sm normal-case tracking-normal"
                />
              </label>
            </div>

            <WeatherPanel
              points={weather}
              loading={weatherLoading}
              error={weatherError}
              usedToday={weatherUsedToday}
              hasWaypoints={waypoints.length > 0}
              onFetch={fetchWeather}
            />

            <TripSummary ref={summaryRef} name={name} date={date} waypoints={waypoints} route={route} />

            <button onClick={exportSummary} disabled={exporting} className="btn btn-white py-3 disabled:opacity-50">
              {exporting ? 'กำลังสร้างรูป…' : '📸 บันทึก/แชร์รูปสรุปทริป'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={saveTrip} className="btn btn-primary py-3">
                💾 บันทึกทริป
              </button>
              <button onClick={onShare} className="btn btn-ghost py-3">
                🔗 แชร์ทริป
              </button>
            </div>
          </div>
        )}

        {tab === 'saved' && (
          <div className="pt-1 flex flex-col gap-5">
            <section>
              <h3 className="label mb-2 px-1">🗺️ ทริปที่บันทึก</h3>
              <SavedTrips trips={savedTrips} currentId={currentId} onLoad={loadTrip} onDelete={removeTrip} />
            </section>
            <section>
              <h3 className="label mb-2 px-1">❤️ ร้านที่บันทึก ({savedPlaces.length})</h3>
              <SavedPlaces places={savedPlaces} onAddWaypoint={addPoiAsWaypoint} onRemove={removePlace} />
            </section>
          </div>
        )}

        {tab === 'group' && (
          <GroupPanel
            roomCode={group.roomCode}
            connected={group.connected}
            riders={group.riders}
            myId={group.myId}
            sharing={group.sharing}
            myPos={group.myPos}
            error={group.error}
            wakeActive={group.wakeActive}
            wakeSupported={group.wakeSupported}
            defaultProfile={profile}
            initialCode={groupInitialCode}
            waypointCount={waypoints.length}
            sharedRoute={group.sharedRoute}
            messages={group.messages}
            followId={followId}
            onJoin={(code, prof) => {
              group.join(code, prof)
              notify(`เข้าห้อง ${code} แล้ว`)
            }}
            onLeave={() => {
              setFollowId(null)
              group.leave()
            }}
            onToggleShare={group.setSharing}
            onFocusRider={focusRider}
            onNotify={notify}
            onShareRoute={shareMyRoute}
            onUseRoute={useSharedRoute}
            onSendMessage={group.sendMessage}
            onSOS={group.sendSOS}
            onToggleFollow={toggleFollow}
          />
        )}
      </BottomSheet>
    </div>
  )
}
