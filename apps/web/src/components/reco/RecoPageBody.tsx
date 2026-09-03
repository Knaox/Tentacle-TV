import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { RecoPage } from "@tentacle-tv/api-client";
import { RecoBillboardSlot } from "./hero/RecoBillboardSlot";
import type { RecoHeroSelection } from "./hero/recoHeroSlides";
import { LikedActorsPanel } from "./LikedActorsPanel";
import { RecoFiltersMenu } from "./RecoFiltersMenu";
import { RecoRowSkeleton } from "./RecoRowSkeleton";
import { RecoRowSlot } from "./RecoRowSlot";
import { RecoStatusBanner } from "./RecoStatusBanner";

/** Les rangées servies dans TOUS les états du moteur (contrat backend). */
const GLOBAL_ROW_KEYS = new Set(["trending", "serverPulse", "bestOfLibrary"]);

interface RecoPageBodyProps {
  page: RecoPage;
  filterKey: string;
  /** Données d'un AUTRE filtre encore affichées pendant l'échange : atténuées,
   *  jamais remplacées par du blanc. */
  stale: boolean;
  hero: RecoHeroSelection;
  onOpenColdStart: () => void;
}

/**
 * Le corps de la page Recommandations, rendu D'UN COUP depuis la page servie :
 * héros, filtres, bandeau d'état, rangées (clés stables — une rangée conservée
 * ne se remonte pas, une nouvelle entre par son propre observateur), acteurs.
 * Les rangées vides ont été omises par le serveur ; sous filtre, une page sans
 * rangée dit une seule chose, une seule fois.
 */
export const RecoPageBody = memo(function RecoPageBody({
  page,
  filterKey,
  stale,
  hero,
  onOpenColdStart,
}: RecoPageBodyProps) {
  const { t } = useTranslation("reco");
  const hasPersonalizedRows = page.rows.some((r) => !GLOBAL_ROW_KEYS.has(r.key));
  const canPersonalize = page.personalized !== false && page.tmdbConfigured !== false;
  const filtered = filterKey !== "all";

  return (
    <div className="min-h-screen pb-20">
      {/* Le héros suit le filtre. Tant que la reco n'a rien à montrer
          (générique, froid, en construction), un en-tête compact tient sa
          place — jamais de carrousel « Sélectionné pour vous » nourri de
          contenu générique. */}
      <RecoBillboardSlot
        hero={hero}
        fallback={
          <div className="row-gutter pb-2 pt-8">
            <h1 className="text-2xl font-bold text-content-primary">{t("pageTitle")}</h1>
          </div>
        }
      />

      <RecoFiltersMenu />

      <RecoStatusBanner page={page} hasPersonalizedRows={hasPersonalizedRows} onOpenColdStart={onOpenColdStart} />

      {/* Opacité seule (règle GPU) : l'échange de filtre atténue, ne blanchit pas. */}
      <div style={{ opacity: stale ? 0.6 : 1, transition: "opacity 200ms ease" }}>
        {page.generating && page.rows.length === 0 ? (
          <>
            <RecoRowSkeleton />
            <RecoRowSkeleton />
            <RecoRowSkeleton />
          </>
        ) : filtered && page.rows.length === 0 ? (
          <p className="row-gutter mb-10 text-sm text-content-tertiary">{t("filterEmpty")}</p>
        ) : (
          page.rows.map((row, i) => (
            <RecoRowSlot
              key={row.key}
              row={row}
              animDelay={Math.min(i, 4) * 60}
              excludeKeys={row.key === "forYou" ? hero.excludeKeys : undefined}
            />
          ))
        )}
      </div>

      {/* Ajuster ses acteurs se fait ICI, au contact des rangées — pas dans
          les réglages. Visible aussi pendant l'exploration : aimer deux ou
          trois acteurs nourrit le profil qui se construit. Masqué quand la
          personnalisation est indisponible (perso coupée, pas de clé TMDB :
          la recherche de personnes serait une impasse). */}
      {canPersonalize && <LikedActorsPanel />}
    </div>
  );
});
