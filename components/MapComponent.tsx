
import React, { useEffect, useRef } from 'react';
import { ThreatZone } from '../types';

interface MapComponentProps {
  center: [number, number];
  destination?: [number, number] | null;
  routePoints?: [number, number][];
  zoom?: number;
  threatZones?: ThreatZone[];
  showThreats?: boolean;
  safetyScore?: number;
  isDistress?: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  center, 
  destination, 
  routePoints = [],
  zoom = 14, 
  threatZones = [], 
  showThreats = true,
  safetyScore = 85,
  isDistress = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const threatLayersRef = useRef<any[]>([]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    if (!leafletMap.current && mapRef.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(center, zoom);
      
      L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap.current);
    }

    if (leafletMap.current) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(center);
      } else {
        const userIcon = L.divIcon({
          className: 'custom-user-icon',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-12 h-12 ${isDistress ? 'bg-red-500/40 animate-ping' : 'bg-pink-500/30 animate-pulse'} rounded-full"></div>
              <div class="w-6 h-6 ${isDistress ? 'bg-red-600' : 'bg-pink-500'} border-4 border-white rounded-full shadow-[0_0_15px_#ff007f]"></div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });
        userMarkerRef.current = L.marker(center, { icon: userIcon }).addTo(leafletMap.current);
      }
    }

    if (leafletMap.current) {
      if (routeLayerRef.current) leafletMap.current.removeLayer(routeLayerRef.current);
      
      const routeColor = isDistress ? '#ef4444' : '#ff007f';
      const points = routePoints.length > 0 ? routePoints : (destination ? [center, destination] : []);

      if (points.length > 0) {
        routeLayerRef.current = L.polyline(points, {
          color: routeColor,
          weight: 7,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: isDistress ? '1, 10' : ''
        }).addTo(leafletMap.current);
      }
    }

    if (leafletMap.current) {
      threatLayersRef.current.forEach(layer => leafletMap.current.removeLayer(layer));
      threatLayersRef.current = [];

      if (showThreats) {
        threatZones.forEach(zone => {
          const color = zone.intensity === 'High' ? '#ef4444' : (zone.intensity === 'Medium' ? '#f59e0b' : '#3b82f6');
          const circle = L.circle([zone.lat, zone.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
            radius: zone.radius,
            weight: 2,
            dashArray: '5, 10'
          }).addTo(leafletMap.current);
          threatLayersRef.current.push(circle);
        });
      }
    }
  }, [center, destination, routePoints, threatZones, showThreats, safetyScore, isDistress]);

  return (
    <div ref={mapRef} className="h-full w-full bg-slate-900 overflow-hidden" />
  );
};

export default MapComponent;
