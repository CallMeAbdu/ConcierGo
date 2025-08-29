import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { getRecommendations } from "./api";
import type { PlaceItem } from "./api";

const DEFAULT_CENTER = { lat: 45.5019, lng: -73.5674 }; // Montréal

export default function App() {
  // Data / map state
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [selected, setSelected] = useState<PlaceItem | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Filters
  const [interests, setInterests] = useState<string[]>(["coffee"]);
  const [radiusKm, setRadiusKm] = useState(3);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");

  // UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [setLocationMode, setSetLocationMode] = useState(false);
  const [showCenterInfo, setShowCenterInfo] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY as string,
  });

  async function refresh() {
    setLoading(true);
    try {
      const data = await getRecommendations({
        lat: center.lat,
        lng: center.lng,
        interests,
        radius_km: radiusKm,
      });
      const sorted = [...data].sort((a, b) => {
        if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
        return (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity);
      });
      setPlaces(sorted.slice(0, limit));
      setSelected(null);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch recommendations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh();
  }, []);

  useEffect(() => {
    if (!mapRef.current || places.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => p.location && bounds.extend(p.location));
    bounds.extend(center);
    mapRef.current.fitBounds(bounds);
    if (places.length === 1) mapRef.current.setZoom(15);
  }, [places, center]);

  function useMyLocation() {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapRef.current?.setZoom(14);
      },
      (err) => alert("Location error: " + err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function focusPlace(p: PlaceItem) {
    setSelected(p);
    const map = mapRef.current;
    if (map && p.location) {
      map.panTo(p.location);
      const z = map.getZoom() ?? 14;
      if (z < 13) map.setZoom(14);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[2000px] items-center gap-3 px-4 py-3">
          <span className="rounded-lg bg-black px-2 py-1 text-sm font-semibold text-white">ConcierGo</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={useMyLocation}
              className="rounded-lg border px-3 py-2 hover:bg-gray-50"
              title="Use my location"
            >
              Use my location
            </button>
            <button
              onClick={() => setSetLocationMode((v) => !v)}
              className={`rounded-lg border px-3 py-2 hover:bg-gray-50 ${setLocationMode ? "bg-blue-50 border-blue-400" : ""}`}
              title="Click map to set location"
            >
              {setLocationMode ? "Click map to set…" : "Set location"}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading…" : "Search"}
            </button>
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="mx-auto mt-4 grid w-full max-w-[2000px] grid-cols-1 gap-6 px-4 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Map column wrapper is relative so the filter menu can cover it exactly */}
        <div className="relative rounded-xl border bg-white overflow-hidden">
          {/* Floating Hamburger/X button that belongs to the map/filter area */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Filters"
            title="Filters"
            className={[
              "absolute left-3 top-3 z-20 rounded-lg border bg-white/90 px-3 py-2 backdrop-blur",
              "transition-transform duration-200 hover:bg-white",
              menuOpen ? "scale-[0.96]" : "scale-100",
            ].join(" ")}
          >
            <div className="relative h-4 w-5">
              <span className={`absolute left-0 top-0 h-[2px] w-5 bg-gray-800 transition-all duration-300 ${menuOpen ? "translate-y-[6px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 bg-gray-800 transition-all duration-300 ${menuOpen ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"}`} />
              <span className={`absolute left-0 bottom-0 h-[2px] w-5 bg-gray-800 transition-all duration-300 ${menuOpen ? "-translate-y-[6px] -rotate-45" : ""}`} />
            </div>
          </button>

          {/* Google Map */}
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "80vh" }}
              center={center}
              onLoad={(map) => { mapRef.current = map; }}
              onClick={(e) => {
                if (!setLocationMode) return;
                const lat = e.latLng?.lat();
                const lng = e.latLng?.lng();
                if (lat && lng) {
                  setCenter({ lat, lng });
                  mapRef.current?.setZoom(14);
                }
                setSetLocationMode(false);
              }}
              onDragStart={() => setSelected(null)}
              options={{
                mapTypeControl: false,       // removes "Map/Satellite" (top-left)
                streetViewControl: false,    // removes yellow Pegman (bottom-right)
                fullscreenControl: false,    // removes fullscreen (top-right)
                rotateControl: false,       // disables 45° rotate (bottom-right)
                cameraControl: false,         // removes the "Map" button (top-left)
                gestureHandling: "greedy", // makes map easier to use on mobile
                // Optional extras:
                // zoomControl: true,        // keep or set false to hide zoom buttons
                // keyboardShortcuts: false,
                // clickableIcons: false,    // disables place icons tooltips
                // disableDefaultUI: false,  // set true to hide ALL controls at once
              }}
            >
              {/* Center marker styled blue */}
              <Marker
                position={center}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#4285F4",
                  fillOpacity: 1,
                  strokeColor: "white",
                  strokeWeight: 2,
                }}
                onClick={() => setShowCenterInfo(true)}
              />

              {/* InfoWindow for center */}
              {showCenterInfo && (
                <InfoWindow position={center} onCloseClick={() => setShowCenterInfo(false)}>
                  <div style={{ fontWeight: 600, color: "#111" }}>My Location</div>
                </InfoWindow>
              )}

              {/* Result markers */}
              {places.map((p) => (
                <Marker key={p.id} position={p.location} onClick={() => setSelected(p)} />
              ))}

              {/* InfoWindow */}
              {selected && (
                <InfoWindow position={selected.location} onCloseClick={() => setSelected(null)}>
                  <div style={{ maxWidth: 260, color: "#111", lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 600 }}>{selected.name}</div>
                    {selected.vicinity && <div>{selected.vicinity}</div>}
                    <div>
                      {selected.rating ? `⭐ ${selected.rating} (${selected.user_ratings_total ?? 0})` : "No rating"}
                    </div>
                    {typeof selected.distance_m === "number" && (
                      <div>{(selected.distance_m / 1000).toFixed(2)} km away</div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="p-4">Loading Google Maps…</div>
          )}

          {/* FULL-MAP Filter Menu (covers the map area only) */}
            <div
              role="dialog"
              aria-hidden={!menuOpen}
              className={[
                "absolute inset-0 z-10 bg-white/98 backdrop-blur-sm",
                "ttransition-transform duration-600 ease-[cubic-bezier(0.25,1.5,0.5,1)]",
                menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[0.98]",
                "origin-top-left"
              ].join(" ")}
            >

            {/* Keep the same hamburger/X button visible and aligned inside the panel */}
            <div className="absolute left-3 top-3">
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close filters"
                className="rounded-lg border bg-white/90 px-3 py-2 backdrop-blur hover:bg-white transition"
              >
                <div className="relative h-4 w-5">
                  <span className="absolute left-0 top-0 h-[2px] w-5 bg-gray-800 translate-y-[6px] rotate-45 transition-all duration-300" />
                  <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 bg-gray-800 opacity-0 scale-x-0 transition-all duration-300" />
                  <span className="absolute left-0 bottom-0 h-[2px] w-5 bg-gray-800 -translate-y-[6px] -rotate-45 transition-all duration-300" />
                </div>
              </button>
            </div>

            {/* Filter content, centered with padding */}
            <div className="h-full w-full overflow-y-auto px-5 py-5 md:px-6">
              <div className="mx-auto max-w-md">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Filters</h3>
  
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Interests</label>
                    <select
                      multiple
                      value={interests}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
                        setInterests(vals);
                      }}
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
                      title="Hold Ctrl/Cmd to select multiple"
                    >
                      <option value="coffee">coffee</option>
                      <option value="parks">parks</option>
                      <option value="museums">museums</option>
                      <option value="restaurants">restaurants</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm">Radius (km)</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="w-24 rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm">Results</label>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
                    >
                      {[5, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>Top {n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm">Sort</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "distance" | "rating")}
                      className="rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
                    >
                      <option value="distance">Distance</option>
                      <option value="rating">Rating</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => { setMenuOpen(false); refresh(); }}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                    >
                      Apply & Search
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* END full-map filter panel */}
        </div>

        {/* Results column stays visible */}
        <aside className="h-[80vh] overflow-y-auto rounded-xl border bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Results</h2>
            <span className="text-sm opacity-70">{places.length} places</span>
          </div>

          <ol className="space-y-2">
            {places.map((p) => {
              const isActive = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => focusPlace(p)}
                    className={[
                      "w-full text-left rounded-xl border px-3 py-3 shadow-sm transition",
                      "hover:shadow-md focus:outline-none focus:ring focus:ring-blue-200",
                      isActive ? "border-blue-500 ring-1 ring-blue-200 bg-blue-50" : "bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold">{p.name}</h3>
                        </div>
                        <div className="text-sm opacity-80">{p.vicinity ?? "nearby"}</div>
                        <div className="mt-1 text-sm">
                          {p.rating ? <>⭐ {p.rating}</> : "No rating"}
                          {p.user_ratings_total ? <> ({p.user_ratings_total})</> : null}
                          {typeof p.distance_m === "number" && (
                            <span className="ml-2 opacity-70">{(p.distance_m / 1000).toFixed(2)} km</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
