"use client";

import { useEffect, useRef } from "react";
import { lookupAirport, lookupCity, CITY_COORDS } from "@/lib/data/coordinates";
import type { TripPreferences, GeneratedItinerary } from "@/types/trip";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  type: "airport" | "city" | "hotel";
  sublabel?: string;
}

interface Props {
  preferences: TripPreferences;
  itinerary: GeneratedItinerary;
}

export function ItineraryMap({ preferences, itinerary }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  // Build points from preferences
  const points: MapPoint[] = [];

  const arrivalCode = preferences.destination?.arrivalAirport;
  if (arrivalCode) {
    const coords = lookupAirport(arrivalCode);
    if (coords) points.push({ ...coords, label: `${arrivalCode} Airport`, type: "airport", sublabel: "Arrival airport" });
  }

  // Scan the user's typed destination text for known city/region names
  const freeText = (preferences.destination?.freeText ?? preferences.destination?.displayName ?? "").toLowerCase();
  const matchedKeys = Object.keys(CITY_COORDS).filter((key) => freeText.includes(key));
  if (matchedKeys.length > 0) {
    matchedKeys.forEach((key) => {
      const label = key.replace(/\b\w/g, (c) => c.toUpperCase());
      points.push({ ...CITY_COORDS[key], label, type: "city" });
    });
  } else {
    // Fallback to routing-derived cities
    const cities = preferences.destination?.cities?.filter(Boolean) ?? [];
    cities.forEach((city) => {
      const coords = lookupCity(city);
      if (coords) points.push({ ...coords, label: city, type: "city" });
    });
  }

  const firstCityKey = matchedKeys[0] ?? preferences.destination?.cities?.[0] ?? "";
  if (preferences.selectedHotel) {
    const cityCoords = CITY_COORDS[firstCityKey.toLowerCase()] ?? lookupCity(firstCityKey);
    if (cityCoords) {
      points.push({
        lat: cityCoords.lat + 0.018,
        lng: cityCoords.lng + 0.018,
        label: preferences.selectedHotel.name,
        type: "hotel",
        sublabel: preferences.selectedHotel.location,
      });
    }
  }

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      const Leaflet = L.default ?? L;

      // Destroy previous instance if any
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }

      // Create map
      const map = Leaflet.map(mapRef.current!, { scrollWheelZoom: false });
      mapInstanceRef.current = map;

      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Custom CSS markers (avoids Leaflet default icon webpack issue)
      function makeIcon(emoji: string, bg: string) {
        return Leaflet.divIcon({
          className: "",
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${bg};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:15px">${emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -22],
        });
      }

      const icons = {
        airport: makeIcon("✈️", "#6366f1"),
        city:    makeIcon("📍", "#10b981"),
        hotel:   makeIcon("🏨", "#f59e0b"),
      };

      // Add markers
      points.forEach((p) => {
        const marker = Leaflet.marker([p.lat, p.lng], { icon: icons[p.type] }).addTo(map);
        marker.bindPopup(`<b style="font-size:12px">${p.label}</b>${p.sublabel ? `<br><span style="font-size:11px;color:#64748b">${p.sublabel}</span>` : ""}`);
      });

      // Dashed route line (airport → cities, excluding hotel)
      const routePoints = points.filter((p) => p.type !== "hotel");
      if (routePoints.length > 1) {
        Leaflet.polyline(
          routePoints.map((p) => [p.lat, p.lng]),
          { color: "#6366f1", weight: 2, dashArray: "6 5", opacity: 0.65 }
        ).addTo(map);
      }

      // Fit bounds
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 9);
      } else {
        const bounds = Leaflet.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.destination?.arrivalAirport, preferences.destination?.cities?.join(","), preferences.selectedHotel?.id]);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center h-40 text-sm text-slate-400">
        Map unavailable — select an arrival airport in the Airlines step to enable this.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-600">Route Map</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>✈️ Airport</span>
          <span>📍 City</span>
          <span>🏨 Hotel</span>
        </div>
      </div>
      <div ref={mapRef} style={{ height: 280 }} />
    </div>
  );
}
