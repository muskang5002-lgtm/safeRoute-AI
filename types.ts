
export interface SafetyScore {
  total: number;
  lighting: number;
  safetyHistory: number; // Incident-free score 0-100
  crowdActivity: number; // witness density 0-100
  description: string;
}

export interface RiskPoint {
  time: string;
  score: number;
}

export interface UserStatus {
  name: string;
  avatar: string;
  status: 'Traveling' | 'Reached' | 'Idle' | 'Distress';
  battery: number;
  lastUpdate: string;
  currentLocationName: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  type: 'Police' | 'Ambulance' | 'Fire' | 'Personal';
}

export enum SafetyStatus {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION',
  DANGER = 'DANGER'
}

export interface IncidentReport {
  id: string;
  type: 'Voice Trigger' | 'SOS Button' | 'Fall Detected' | 'Off-Route';
  timestamp: string;
  severity: 'Low' | 'Medium' | 'High';
  description: string;
}

export interface ThreatZone {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  intensity: 'High' | 'Medium' | 'Low';
  reason: string;
}

export interface RouteData {
  points: [number, number][];
  distance: string;
  duration: string;
  safetyRating: string;
}
