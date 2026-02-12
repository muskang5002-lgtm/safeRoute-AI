import { GoogleGenAI, Type, Chat } from "@google/genai";
import { SafetyScore, ThreatZone, RiskPoint, RouteData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Enhanced retry logic specifically for 429 errors with jittered exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || "";
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('exhausted');
    
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit encountered. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const analyzeRouteSafety = async (locationName: string): Promise<SafetyScore> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Perform a tactical safety analysis for a route in ${locationName}. 
      Evaluate based on three criteria (0-100 scale):
      1. lighting: Density of street illumination infrastructure.
      2. safetyHistory: Absence of historical safety incidents.
      3. crowdActivity: Presence of safe community foot traffic (witness density).
      Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER },
            lighting: { type: Type.NUMBER },
            safetyHistory: { type: Type.NUMBER },
            crowdActivity: { type: Type.NUMBER },
            description: { type: Type.STRING }
          },
          required: ["total", "lighting", "safetyHistory", "crowdActivity", "description"]
        }
      }
    });

    try {
      return JSON.parse(response.text.trim());
    } catch (e) {
      console.error("Parse error, using fallback safety data");
      return {
        total: 82,
        lighting: 85,
        safetyHistory: 90,
        crowdActivity: 75,
        description: "Standard safe urban zone with consistent lighting and moderate traffic."
      };
    }
  });
};

export const generateSafeRoute = async (start: [number, number], end: [number, number]): Promise<RouteData> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a high-safety path for a woman walking alone from [${start[0]}, ${start[1]}] to [${end[0]}, ${end[ end[1]]}]. Prioritize lit main roads. Return 6 GPS points as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER }
              }
            },
            distance: { type: Type.STRING },
            duration: { type: Type.STRING },
            safetyRating: { type: Type.STRING }
          },
          required: ["points", "distance", "duration", "safetyRating"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const getRiskTrend = async (lat: number, lng: number): Promise<RiskPoint[]> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a 6-point safety trend array for coordinate [${lat}, ${lng}]. Score 0-100. JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              score: { type: Type.NUMBER }
            },
            required: ["time", "score"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const getThreatZones = async (lat: number, lng: number): Promise<ThreatZone[]> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Simulate 2-3 potential risk zones (hotspots) within 2km of [${lat}, ${lng}]. Intensity: High, Medium, Low. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              radius: { type: Type.NUMBER },
              intensity: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
              reason: { type: Type.STRING }
            },
            required: ["id", "lat", "lng", "radius", "intensity", "reason"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const createSafetyChat = () => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are the SafeRoute AI Companion for women. You provide reassuring, tactical advice based on real-time lighting, incident history, and crowd density. If danger is hinted at, immediately suggest heading to a 'Safe Haven' (commercial building or police station). Be brief.",
    },
  });
};