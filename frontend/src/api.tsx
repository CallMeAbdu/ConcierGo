const BASE = import.meta.env.VITE_API_BASE as string;

export type PlaceItem = {
    id: string;
    name: string;
    location: { lat: number; lng: number };
    rating?: number;
    user_ratings_total?: number;
    distance_m?: number;
    vicinity?: string;
    types?: string[];
    opening_hours?: {
      open_now?: boolean;
      weekday_text?: string[]; 
    };
    business_status?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  };
  

export async function getRecommendations(params: {
  lat: number; lng: number; interests: string[]; radius_km?: number;
}): Promise<PlaceItem[]> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    interests: params.interests.join(","),
    radius_km: String(params.radius_km ?? 3),
  });
  const r = await fetch(`${BASE}/api/recommendations?${q.toString()}`);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}
