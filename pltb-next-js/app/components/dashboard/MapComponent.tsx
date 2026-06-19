"use client"

import { useEffect, useRef, useState } from "react"
import type L from "leaflet"

interface MapComponentProps {
  lat: number | null
  lng: number | null
  locationName?: string
}

const DEFAULT_LAT = -2.5
const DEFAULT_LNG = 118
const DEFAULT_ZOOM = 5

export default function MapComponent({
  lat = null,
  lng = null,
  locationName = "",
}: MapComponentProps) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerRef   = useRef<L.Marker | null>(null)
  const circleRef   = useRef<L.Circle | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Init map once on mount (free roam, no coords needed)
  useEffect(() => {
    if (!mapRef.current) return

    let isMounted = true
    let cleanupDone = false

    const cleanup = () => {
      if (cleanupDone) return
      cleanupDone = true
      isMounted = false
      if (mapInstance.current) {
        try { mapInstance.current.remove() } catch { /* ignore */ }
        mapInstance.current = null
      }
    }

    const initLeaflet = async () => {
      try {
        const L = (await import("leaflet")).default
        if (!isMounted || !mapRef.current || mapInstance.current) return

        mapInstance.current = L.map(mapRef.current).setView(
          [DEFAULT_LAT, DEFAULT_LNG],
          DEFAULT_ZOOM
        )

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
            subdomains: "abcd",
          }
        ).addTo(mapInstance.current)

        const apiKey =
          process.env.NEXT_PUBLIC_API_TOMORROW ||
          "4UCcStAoPrQPyMuMExQfwgre5KenBlMR"

        L.tileLayer(
          `https://api.tomorrow.io/v4/map/tile/{z}/{x}/{y}/weather.png?apikey=${apiKey}&timestamp=${Date.now()}`,
          { attribution: "&copy; Tomorrow.io", maxZoom: 12 }
        ).addTo(mapInstance.current)

        setMapLoaded(true)
      } catch (err) {
        console.error("Leaflet init error:", err)
      }
    }

    initLeaflet()
    return cleanup
  }, [])

  // Update marker/circle + fly to location when coords change
  useEffect(() => {
    if (!mapInstance.current || lat === null || lng === null) return

    const updateMap = async () => {
      try {
        const L = (await import("leaflet")).default

        mapInstance.current!.flyTo([lat, lng], 9, { duration: 1.2 })

        if (markerRef.current) {
          try { mapInstance.current!.removeLayer(markerRef.current) } catch { /* ignore */ }
        }
        if (circleRef.current) {
          try { mapInstance.current!.removeLayer(circleRef.current) } catch { /* ignore */ }
        }

        const ventaraIcon = L.divIcon({
          className: "custom-marker",
          html: `<div style="background-color:#00a991;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L4 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg></div>`,
          iconSize: [28, 28],
        })

        markerRef.current = L.marker([lat, lng], { icon: ventaraIcon })
          .addTo(mapInstance.current!)
          .bindPopup(
            `<b>${locationName}</b><br>🌊 Pusat prakiraan energi angin 7 hari`
          )
          .openPopup()

        circleRef.current = L.circle([lat, lng], {
          color:       "#00a991",
          fillColor:   "#b8e8e0",
          fillOpacity: 0.25,
          radius:      16000,
          weight:      1.8,
        }).addTo(mapInstance.current!)
      } catch (err) {
        console.error("Map update error:", err)
      }
    }

    updateMap()
  }, [lat, lng, locationName])

  return (
    <div
      ref={mapRef}
      style={{
        height: 400,
        width: "100%",
        borderRadius: "1rem",
        zIndex: 1,
        border: "1px solid #e2e8f0",
        position: "relative",
      }}
    >
      {!mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              className="animate-spin"
              style={{
                width: 20,
                height: 20,
                border: "2px solid #e2e8f0",
                borderTopColor: "#00a991",
                borderRadius: "50%",
              }}
            />
            <span style={{ color: "#64748b", fontSize: "14px" }}>
              Memuat peta cuaca...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}