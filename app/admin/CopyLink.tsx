'use client';
import { useState } from 'react';

/** Bouton compact qui copie un lien dans le presse-papiers. */
export default function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn small" title={url}
      onClick={async () => { try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 1500); } catch { window.prompt('Copie le lien :', url); } }}>
      {ok ? '✓ Copié' : 'Copier le lien'}
    </button>
  );
}
