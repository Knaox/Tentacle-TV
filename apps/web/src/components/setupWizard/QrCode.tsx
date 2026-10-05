import { memo, useMemo } from "react";
import { encode } from "uqr";

/**
 * Un QR code en SVG, dessiné module par module à partir de la matrice d'`uqr`
 * (aucun HTML injecté). Noir sur blanc quel que soit le thème : c'est ce que
 * lisent les appareils photo.
 */
export const QrCode = memo(function QrCode({ value, label, size = 176 }: { value: string; label: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) => row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }));
    return { path: d, count: qr.size };
  }, [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${count} ${count}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-lg bg-white">
      <path d={path} fill="#000" />
    </svg>
  );
});
