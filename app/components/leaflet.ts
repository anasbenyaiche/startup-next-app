// Leaflet, chargé depuis le CDN par la carte et par le choix d'un point de rendez-vous.

const LEAFLET_VERSION = "1.9.4";
// Clé CARTO Basemaps (gratuite, obligatoire depuis septembre 2026). Sans elle, le fond
// de carte CARTO affiche « API KEY REQUIRED » : on se rabat alors sur OpenStreetMap.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;

// Leaflet est chargé depuis le CDN : on ne type que ce qui est utilisé ici.
export interface LLayer {
  addTo(target: LMap | LLayerGroup): this;
}
export type LatLng = { lat: number; lng: number };
export interface LMap {
  setView(center: [number, number], zoom: number): LMap;
  on(event: "click", handler: (e: { latlng: LatLng }) => void): LMap;
  getContainer(): HTMLElement;
  fitBounds(bounds: [number, number][], options?: { maxZoom?: number; padding?: [number, number] }): LMap;
  getZoom(): number;
  getCenter(): LatLng;
  remove(): void;
}
export interface LLayerGroup extends LLayer {
  clearLayers(): void;
}
export type MarkerStyle = {
  radius: number;
  color: string;
  fillColor: string;
  fillOpacity: number;
  weight: number;
  dashArray?: string;
};
export interface LMarker extends LLayer {
  bindTooltip(text: string): LMarker;
  on(event: "click", handler: () => void): LMarker;
  remove(): void;
}
export type LIcon = object;
export interface LCircleMarker extends LLayer {
  bindTooltip(text: string): LCircleMarker;
  on(event: "click", handler: () => void): LCircleMarker;
  setStyle(style: Partial<MarkerStyle>): LCircleMarker;
  bringToFront(): void;
}
export interface LStatic {
  map(el: HTMLElement, options?: { preferCanvas?: boolean; worldCopyJump?: boolean }): LMap;
  tileLayer(url: string, options: { maxZoom: number; attribution: string }): LLayer;
  layerGroup(): LLayerGroup;
  circleMarker(latlng: [number, number], options: MarkerStyle): LCircleMarker;
  marker(latlng: [number, number], options: { icon: LIcon; keyboard?: boolean; zIndexOffset?: number }): LMarker;
  divIcon(options: { className: string; html: string; iconSize: [number, number] }): LIcon;
}

declare global {
  export interface Window {
    L?: LStatic;
  }
}

export function loadLeaflet(): Promise<LStatic> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet indisponible")));
    script.onerror = () => reject(new Error("Impossible de charger Leaflet"));
    document.body.appendChild(script);
  });
}

// Fond de carte : CARTO Positron (gris clair) si une clé est fournie, sinon les tuiles
// OpenStreetMap, sans clé, passées en gris par CSS pour que les points de couleur ressortent.
export function addBaseLayer(L: LStatic, map: LMap, el: HTMLElement, extraAttribution?: string) {
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const extra = extraAttribution ? `, ${extraAttribution}` : "";
  if (CARTO_KEY) {
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, {
      maxZoom: 18,
      attribution: `${osm}, &copy; <a href="https://carto.com/attributions">CARTO</a>${extra}`,
    }).addTo(map);
  } else {
    el.classList.add("tuiles-grises");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: `${osm}${extra}` }).addTo(map);
  }
}
