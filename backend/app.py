import os, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from math import radians, sin, cos, asin, sqrt

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
PORT = int(os.getenv("FLASK_PORT", "5001"))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlmb = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(p1)*cos(p2)*sin(dlmb/2)**2
    return int(2*R*asin(sqrt(a)))

INTEREST_MAP = {"coffee": "cafe", "parks": "park", "museums": "museum", "restaurants": "restaurant"}

SEARCH_FIELDS = (
    "places.id,places.displayName,places.location,places.types,"
    "places.rating,places.userRatingCount,places.formattedAddress"
)
DETAIL_FIELDS = (
    "id,displayName,formattedAddress,internationalPhoneNumber,"
    "websiteUri,regularOpeningHours,location"
)

def places_headers(field_mask=None):
    h = {
        "X-Goog-Api-Key": API_KEY or "",
        "Content-Type": "application/json",
    }
    if field_mask:
        h["X-Goog-FieldMask"] = field_mask
    return h

@app.get("/api/recommendations")
def recommendations():
    if not API_KEY:
        return jsonify({"error": "GOOGLE_MAPS_API_KEY missing"}), 500
    try:
        lat = float(request.args["lat"]); lng = float(request.args["lng"])
    except Exception:
        return jsonify({"error": "lat and lng are required numbers"}), 400

    interests = [s.strip().lower() for s in request.args.get("interests", "").split(",") if s.strip()] or ["restaurants"]
    radius_m = int(float(request.args.get("radius_km", "3")) * 1000)

    results_by_id = {}
    for interest in interests:
        included_type = INTEREST_MAP.get(interest)
        body = {
            "maxResultCount": 20,
            "rankPreference": "DISTANCE",
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": radius_m
                }
            }
        }
        if included_type:
            body["includedTypes"] = [included_type]

        url = "https://places.googleapis.com/v1/places:searchNearby"
        r = requests.post(url, headers=places_headers(SEARCH_FIELDS), json=body, timeout=10)

        # --- verbose logging on error ---
        if r.status_code != 200:
            print("\n[Places search error]")
            print("Status:", r.status_code)
            print("Response:", r.text[:1000])  # print first 1000 chars
            return jsonify({"error": "Places search error", "status": r.status_code, "body": r.text}), 502

        data = r.json()
        for p in data.get("places", []):
            pid = p.get("id")
            if not pid or pid in results_by_id: 
                continue
            loc = p.get("location") or {}
            plat, plng = loc.get("latitude"), loc.get("longitude")
            dist = haversine(lat, lng, plat, plng) if (plat is not None and plng is not None) else None
            results_by_id[pid] = {
                "id": pid,
                "name": (p.get("displayName") or {}).get("text"),
                "types": p.get("types", []),
                "rating": p.get("rating"),
                "user_ratings_total": p.get("userRatingCount"),
                "location": {"lat": plat, "lng": plng},
                "distance_m": dist,
                "vicinity": p.get("formattedAddress"),
            }

    items = list(results_by_id.values())
    def score(x):
        r = x.get("rating") or 0; n = x.get("user_ratings_total") or 0; d = x.get("distance_m") or 1_000_000
        return (r * min(n, 200) / 200) - (d / 5000.0)
    items.sort(key=score, reverse=True)
    return jsonify(items[:50])

@app.get("/api/place/<place_id>")
def place_details(place_id):
    if not API_KEY:
        return jsonify({"error": "GOOGLE_MAPS_API_KEY missing"}), 500
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    r = requests.get(url, headers=places_headers(), params={"fields": DETAIL_FIELDS}, timeout=10)
    if r.status_code != 200:
        print("\n[Places details error]")
        print("Status:", r.status_code)
        print("Response:", r.text[:1000])
        return jsonify({"error": "Places details error", "status": r.status_code, "body": r.text}), 502
    d = r.json()
    loc = (d.get("location") or {})
    return jsonify({
        "id": d.get("id"),
        "name": (d.get("displayName") or {}).get("text"),
        "address": d.get("formattedAddress"),
        "phone": d.get("internationalPhoneNumber"),
        "website": d.get("websiteUri"),
        "location": {"lat": loc.get("latitude"), "lng": loc.get("longitude")},
        "opening_hours": (d.get("regularOpeningHours") or {}).get("weekdayDescriptions"),
    })

if __name__ == "__main__":
    # quick visibility that the key loaded (masked)
    print("Loaded key?", ("*" * (len(API_KEY) - 6) + API_KEY[-6:]) if API_KEY else "None")
    app.run(debug=True, port=PORT)
