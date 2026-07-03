import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Poi, Rider, Waypoint } from '../types'
import { waypointIcon, poiIcon, riderIcon } from '../lib/markers'
import { googleMapsLink } from '../lib/share'

interface Props {
  waypoints: Waypoint[]
  routeCoords: [number, number][]
  restPoints: [number, number][]
  pois: Poi[]
  riders: Rider[]
  myId: string | null
  addingPoint: boolean
  focus: { lat: number; lng: number; nonce: number } | null
  onMapClick: (lat: number, lng: number) => void
  onRemoveWaypoint: (id: string) => void
  onAddPoi: (poi: Poi) => void
}

const THAI_CENTER: [number, number] = [13.7563, 100.5018] // กรุงเทพฯ

function ClickHandler({ onClick, active }: { onClick: (lat: number, lng: number) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active) onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FitBounds({ waypoints, routeCoords }: { waypoints: Waypoint[]; routeCoords: [number, number][] }) {
  const map = useMap()
  const key = useMemo(
    () => waypoints.map((w) => `${w.lat},${w.lng}`).join('|') + '#' + routeCoords.length,
    [waypoints, routeCoords.length]
  )
  useEffect(() => {
    const pts: [number, number][] = routeCoords.length
      ? routeCoords
      : waypoints.map((w) => [w.lat, w.lng])
    if (pts.length === 1) {
      map.setView(pts[0], 13, { animate: true })
    } else if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function FocusController({ focus }: { focus: Props['focus'] }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(15, map.getZoom()), { duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])
  return null
}

export default function MapView({
  waypoints,
  routeCoords,
  restPoints,
  pois,
  riders,
  myId,
  addingPoint,
  focus,
  onMapClick,
  onRemoveWaypoint,
  onAddPoi,
}: Props) {
  return (
    <MapContainer
      center={THAI_CENTER}
      zoom={11}
      zoomControl={false}
      className="h-full w-full"
      style={{ cursor: addingPoint ? 'crosshair' : '' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <ClickHandler onClick={onMapClick} active={addingPoint} />
      <FitBounds waypoints={waypoints} routeCoords={routeCoords} />
      <FocusController focus={focus} />

      {routeCoords.length > 1 && (
        <>
          <Polyline positions={routeCoords} pathOptions={{ color: '#000000', weight: 9, opacity: 0.45 }} />
          <Polyline positions={routeCoords} pathOptions={{ color: '#ff5a1f', weight: 4.5, opacity: 1 }} />
        </>
      )}

      {/* จุดพักทุก ~100 กม. */}
      {restPoints.map((p, i) => (
        <CircleMarker
          key={`rest-${i}`}
          center={p}
          radius={8}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
        >
          <Popup>🛑 จุดพักที่ ~{(i + 1) * 100} กม.<br />แนะนำพักยืดเส้น/เติมน้ำมัน</Popup>
        </CircleMarker>
      ))}

      {/* POI ร้านกาแฟ/อาหาร */}
      {pois.map((poi) => (
        <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={poiIcon(poi.kind)}>
          <Popup>
            <div className="min-w-[160px]">
              <div className="font-semibold mb-1">
                {poi.kind === 'cafe' ? '☕ ' : '🍜 '}
                {poi.name}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onAddPoi(poi)}
                  className="text-white bg-brand rounded px-2 py-1 text-xs font-medium"
                >
                  + เพิ่มเป็นจุดแวะ
                </button>
                <a
                  href={googleMapsLink(poi.lat, poi.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center text-blue-400 border border-blue-400/60 rounded px-2 py-1 text-xs font-medium"
                >
                  เปิดใน Google Maps
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* ไรเดอร์สดในกลุ่ม */}
      {riders.map((r) =>
        r.lat != null && r.lng != null ? (
          <Marker key={`rider-${r.id}`} position={[r.lat, r.lng]} icon={riderIcon(r, r.id === myId)} zIndexOffset={1000}>
            <Popup>
              <div className="min-w-[150px]">
                <div className="font-semibold mb-1">
                  {r.emoji} {r.name || 'ไรเดอร์'} {r.id === myId ? '(ฉัน)' : ''}
                </div>
                {r.speed != null && r.speed >= 0 && (
                  <div className="text-xs text-dim">ความเร็ว ~{Math.round(r.speed * 3.6)} กม./ชม.</div>
                )}
                <a
                  href={googleMapsLink(r.lat, r.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 text-xs"
                >
                  เปิดตำแหน่งใน Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ) : null
      )}

      {/* waypoints */}
      {waypoints.map((w, i) => (
        <Marker key={w.id} position={[w.lat, w.lng]} icon={waypointIcon(i, w.custom)}>
          <Popup>
            <div className="min-w-[150px]">
              <div className="font-semibold mb-1">
                {i + 1}. {w.name}
              </div>
              {w.custom && <div className="text-xs text-purple-300 mb-1">📍 จุดที่ปักเอง</div>}
              <div className="flex gap-1">
                <a
                  href={googleMapsLink(w.lat, w.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center text-blue-400 border border-blue-400/60 rounded px-2 py-1 text-xs"
                >
                  แผนที่
                </a>
                <button
                  onClick={() => onRemoveWaypoint(w.id)}
                  className="flex-1 text-[#ff6a5f] border border-[#ff3b30]/40 rounded px-2 py-1 text-xs"
                >
                  ลบจุด
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
