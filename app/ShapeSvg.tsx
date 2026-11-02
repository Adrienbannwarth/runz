/** Dessin d'une forme #TRACEZ (chemin SVG pré-calculé), sans fond de carte. */
export default function ShapeSvg({ path, size = 64, color = 'var(--strava)', bg = '#f6f6f4', stroke = 2.4 }: { path: string | null; size?: number | string; color?: string; bg?: string; stroke?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Forme tracée" style={{ background: bg, borderRadius: 8, display: 'block' }}>
      {path ? <path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        : <text x="50" y="54" textAnchor="middle" fontSize="9" fill="#999">pas de tracé</text>}
    </svg>
  );
}
