interface ProprietesJauge {
  count: number;
  index: number;
  durationMs: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onPause: () => void;
  onResume: () => void;
}

/**
 * Les indicateurs de la bannière, en lecture seule.
 *
 * Sur le web, chaque pastille est un bouton : on clique celle qu'on veut. Sur
 * un téléviseur, ce sont cinq cibles de quatre pixels de haut posées sur le
 * trajet du D-pad, entre la bannière et la première rangée — il faudrait les
 * traverser une par une pour descendre, et viser une pastille n'apporte rien
 * qu'un appui sur gauche ou droite ne fasse déjà.
 *
 * Elles restent affichées : elles disent combien de mises en avant existent et
 * où l'on en est, ce qui est toute leur utilité ici. Elles ne sont simplement
 * plus des boutons.
 *
 * Les flèches de défilement disparaissent de même — elles n'étaient montées
 * qu'au survol, qui n'existe pas sur une dalle.
 *
 * Le remplissage de la pastille active est une transition de largeur et non
 * une animation continue : rien ne tourne en boucle tant que la bannière ne
 * change pas.
 */
export function HeroIndicators({ count, index, durationMs }: ProprietesJauge) {
  if (count <= 1) return null;

  return (
    <div
      className="absolute bottom-6 right-6 z-10 flex items-center gap-2 md:bottom-10 md:right-10"
      aria-hidden
    >
      {Array.from({ length: count }, (_, position) => (
        <span
          key={position}
          className="block h-1 overflow-hidden rounded-full transition-all duration-500"
          style={{
            width: position === index ? 44 : 14,
            background:
              position === index
                ? "linear-gradient(90deg, var(--brand), var(--brand-accent))"
                : "var(--on-media-muted)",
            boxShadow:
              position === index ? "0 0 14px rgba(var(--brand-rgb), 0.6)" : undefined,
            transitionDuration: position === index ? `${durationMs}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
