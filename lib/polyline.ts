// Tracés « forme » (#TRACEZ) : décodage du polyline Strava et conversion en chemin SVG.
// Fonctions pures, sans fond de carte : on ne montre que la forme, jamais le lieu.

// Nomenclature : « #TRACEZ (nom de la forme) ». Tolère #TRACE, #TRACÉ, majuscules et espaces.
export const TRACE_TAG = /#\s*trac[eé]\s*z?(?![a-zà-ÿ])/i;
export const hasTraceTag = (name?: string | null) => !!name && TRACE_TAG.test(name);

/** Nom de la forme : le texte entre parenthèses (« #TRACEZ (Cœur) » → « Cœur »), sinon le reste du titre. */
export function shapeLabel(title?: string | null): string {
  if (!title) return '';
  const paren = title.match(/\(([^)]+)\)/);
  if (paren) return paren[1].trim().slice(0, 40);
  return title.replace(TRACE_TAG, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Décode un polyline encodé (algorithme Google, précision 1e-5) en [lat, lng][]. */
export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** Chemin SVG (viewBox 0 0 100 100, marge 14) qui dessine la forme en gardant ses proportions. */
export function polylineToPath(str?: string | null): string | null {
  if (!str) return null;
  const pts = decodePolyline(str);
  if (pts.length < 2) return null;
  const midLat = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xy = pts.map(([la, ln]) => [ln * k, -la]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1e-9, h = Math.max(...ys) - minY || 1e-9;
  const s = 72 / Math.max(w, h);
  const ox = 14 + (72 - w * s) / 2, oy = 14 + (72 - h * s) / 2;
  return xy.map(([x, y], j) => `${j ? 'L' : 'M'}${(ox + (x - minX) * s).toFixed(1)} ${(oy + (y - minY) * s).toFixed(1)}`).join('');
}
