/**
 * Labo du verre — la vue « composants » (`/dev/verre?vue=composants`).
 *
 * ⚠️ Ce fichier APPARTIENT à lg-composants : il y branche ses VRAIS composants
 * (plateau de survol sur une affiche détaillée, boutons ronds, action
 * principale, menu…) au-dessus des mêmes dessous que la vue des surfaces, pour
 * les juger en Electron natif avant de les propager. lg-tokens n'y touche pas.
 *
 * Paquets de développement seulement, comme tout le labo.
 */

export function LabComponents({ top }: { top: number }) {
  return (
    <div style={{ position: "fixed", top, left: 24, padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 13, zIndex: 40 }}>
      Vue « composants » : à brancher par lg-composants (labComponents.tsx).
    </div>
  );
}
