/* ==========================================================================
   SĀLFA — maps.

   Leaflet with OpenStreetMap tiles: no API key, no billing, no account. It is
   a UMD bundle rather than an ES module, so it is injected as a <script> and
   read off `window.L` — and only when a map is actually about to be shown.
   ========================================================================== */

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";

/** Kuwait City — a sensible opening view for a Kuwaiti gahwa log. */
export const DEFAULT_CENTER = [29.3759, 47.9774];
export const DEFAULT_ZOOM = 11;

let leafletPromise = null;

/** Loads Leaflet once and resolves with `L`. */
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.append(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet loaded but window.L is missing")));
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.append(script);
  });

  return leafletPromise;
}

/** A base map with OSM tiles and the attribution the tile policy requires. */
export function createBaseMap(L, el, { center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, interactive = true } = {}) {
  const map = L.map(el, {
    center,
    zoom,
    zoomControl: interactive,
    dragging: interactive,
    scrollWheelZoom: false, // never hijack the page scroll
    attributionControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  return map;
}

/** A sand dot rather than Leaflet's blue pin, so the map stays on-brand. */
export function salfaMarker(L, { favourite = false } = {}) {
  return L.divIcon({
    className: "",
    html: `<span class="mapdot${favourite ? " mapdot--fav" : ""}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Frames the map around the given points, with a sane fallback for one or none. */
export function fitToPoints(map, points) {
  if (!points.length) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return;
  }
  if (points.length === 1) {
    map.setView(points[0], 14);
    return;
  }
  map.fitBounds(points, { padding: [42, 42], maxZoom: 15 });
}
