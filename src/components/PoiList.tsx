import { useEffect, useState } from 'react'
import type { Poi } from '../types'
import { formatDistance } from '../lib/format'
import { googleMapsLink, googlePlaceLink } from '../lib/share'
import { placeKey } from '../lib/storage'
import { KIND_META } from '../lib/poiMeta'
import { instantPhoto, resolvePhoto } from '../lib/poiPhoto'

interface Props {
  pois: Poi[]
  savedKeys: Set<string>
  onToggleSave: (poi: Poi) => void
  onAddWaypoint: (poi: Poi) => void
  onFocus: (poi: Poi) => void
}

function Thumb({ poi }: { poi: Poi }) {
  const [src, setSrc] = useState<string | null>(() => instantPhoto(poi))
  const [broken, setBroken] = useState(false)
  const meta = KIND_META[poi.kind]

  // ถ้าไม่มีรูปทันที แต่มี wikidata → ลองดึงรูปฟรีจาก Wikimedia
  useEffect(() => {
    if (src || !poi.wikidata) return
    const ac = new AbortController()
    resolvePhoto(poi, ac.signal).then((u) => u && setSrc(u))
    return () => ac.abort()
  }, [poi, src])

  if (src && !broken) {
    return (
      <div className="relative w-16 h-16 shrink-0">
        <img
          src={src}
          alt={poi.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="w-16 h-16 rounded-xl object-cover bg-slate-200 dark:bg-slate-700"
        />
        <span className="absolute bottom-0.5 right-0.5 text-[10px]">{meta.emoji}</span>
      </div>
    )
  }
  return (
    <div className={`w-16 h-16 rounded-xl shrink-0 flex items-center justify-center text-2xl ${meta.gradient}`}>
      {meta.emoji}
    </div>
  )
}

export default function PoiList({ pois, savedKeys, onToggleSave, onAddWaypoint, onFocus }: Props) {
  if (pois.length === 0) return null
  return (
    <ul className="flex flex-col gap-2.5">
      {pois.map((poi, i) => {
        const saved = savedKeys.has(placeKey(poi))
        const meta = KIND_META[poi.kind]
        return (
          <li key={poi.id} className="card p-3 flex flex-col gap-2.5">
            <div className="flex gap-3">
              <button onClick={() => onFocus(poi)} className="shrink-0" aria-label="ดูบนแผนที่">
                <Thumb poi={poi} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[11px] font-bold text-dim">#{i + 1}</span>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.badge}`}>
                    {meta.emoji} {meta.label}
                  </span>
                  {poi.notable && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-medium">
                      ⭐ เป็นที่รู้จัก
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm truncate mt-0.5">{poi.name}</div>
                {poi.cuisine && <div className="text-xs text-dim truncate">🍽️ {poi.cuisine}</div>}
                {poi.openingHours && <div className="text-xs text-dim truncate">🕒 {poi.openingHours}</div>}
                {poi.address && <div className="text-xs text-dim truncate">📮 {poi.address}</div>}
                <div className="text-xs text-dim mt-0.5">
                  {poi.distFromRoute != null && <>📍 ห่างเส้นทาง ~{formatDistance(poi.distFromRoute)}</>}
                </div>
              </div>

              <button
                onClick={() => onToggleSave(poi)}
                className={`shrink-0 w-9 h-9 rounded-full text-lg flex items-center justify-center border transition active:scale-95 ${
                  saved ? 'bg-[#ff3b30]/15 border-[#ff3b30]/30' : 'bg-white/[0.06] border-white/10'
                }`}
                aria-label={saved ? 'ยกเลิกบันทึก' : 'บันทึกร้าน'}
              >
                {saved ? '❤️' : '🤍'}
              </button>
            </div>

            {poi.features && poi.features.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {poi.features.map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80">
                    {f}
                  </span>
                ))}
              </div>
            )}

            {poi.phone && (
              <a href={`tel:${poi.phone.replace(/[^\d+]/g, '')}`} className="text-xs text-brand font-medium">
                📞 โทร {poi.phone}
              </a>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onAddWaypoint(poi)}
                className="btn btn-primary text-xs py-2"
              >
                + จุดแวะ
              </button>
              {/* ปั๊มไม่มีรูป/เมนู → โชว์นำทางแทน */}
              <a
                href={poi.kind === 'fuel' ? googleMapsLink(poi.lat, poi.lng) : googlePlaceLink(poi.name, poi.lat, poi.lng)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost text-xs py-2 text-center"
              >
                {poi.kind === 'fuel' ? '🗺️ นำทาง' : '📷 รูป/เมนู'}
              </a>
              {poi.website ? (
                <a
                  href={poi.website}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost text-xs py-2 text-center"
                >
                  🌐 เว็บร้าน
                </a>
              ) : (
                <a
                  href={poi.kind === 'fuel' ? googlePlaceLink(poi.name, poi.lat, poi.lng) : googleMapsLink(poi.lat, poi.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost text-xs py-2 text-center"
                >
                  {poi.kind === 'fuel' ? '📷 ดูใน Google' : '🗺️ นำทาง'}
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
