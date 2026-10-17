import { Fragment, memo } from "react";
import { useTranslation } from "react-i18next";
import { RECO_GLOBAL_ROW_KEYS, forYouPageRows, type RecoPage } from "@tentacle-tv/api-client";
import { LikedActorsPanel } from "./LikedActorsPanel";
import { RecoFiltersMenu } from "./RecoFiltersMenu";
import { RecoRefineTeaser } from "./RecoRefineTeaser";
import { RecoRowSkeleton } from "./RecoRowSkeleton";
import { RecoRowSlot } from "./RecoRowSlot";
import { RecoStatusBanner } from "./RecoStatusBanner";
import { RecoSpotlight } from "./spotlight/RecoSpotlight";

interface RecoPageBodyProps {
  page: RecoPage;
  filterKey: string;
  /** Données d'un AUTRE filtre encore affichées pendant l'échange : atténuées,
   *  jamais remplacées par du blanc. */
  stale: boolean;
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
  onOpenColdStart,
}: RecoPageBodyProps) {
  const { t } = useTranslation("reco");
  // « Tendances actuelles » en tête : la rangée goûtée des tendances n'y est pas répétée.
  const rows = forYouPageRows(page.rows);
  const hasPersonalizedRows = rows.some((r) => !RECO_GLOBAL_ROW_KEYS.has(r.key));
  const canPersonalize = page.personalized !== false && page.tmdbConfigured !== false;
  const filtered = filterKey !== "all";
  // L'entrée vers « Affiner » se glisse après la deuxième rangée (ou la
  // dernière, s'il y en a moins) : assez haut pour être vue, assez bas pour
  // que les propositions passent d'abord. Pas sous perso coupée : un verdict
  // n'y changerait rien de visible.
  const teaserAfter = page.personalized !== false ? Math.min(1, rows.length - 1) : -1;

  return (
    <div className="min-h-screen pb-20">
      {/* LA une de ce soir (la tête de « Pour vous », ou le `featured` du
          serveur), qui suit le filtre. Tant que la reco n'a rien de personnel
          à montrer (générique, froid, en construction), un en-tête compact
          tient sa place — jamais une une nourrie de contenu générique. */}
      {page.rows.some((row) => row.key === "forYou") || page.featured ? (
        <RecoSpotlight page={page} />
      ) : (
        <div className="row-gutter pb-2 pt-8">
          <h1 className="text-2xl font-bold text-content-primary">{t("pageTitle")}</h1>
        </div>
      )}

      <RecoFiltersMenu />

      <RecoStatusBanner page={page} hasPersonalizedRows={hasPersonalizedRows} onOpenColdStart={onOpenColdStart} />

      {/* Opacité seule (règle GPU) : l'échange de filtre atténue, ne blanchit pas. */}
      <div style={{ opacity: stale ? 0.6 : 1, transition: "opacity 200ms ease" }}>
        {page.generating && rows.length === 0 ? (
          <>
            <RecoRowSkeleton />
            <RecoRowSkeleton />
            <RecoRowSkeleton />
          </>
        ) : filtered && rows.length === 0 ? (
          <p className="row-gutter mb-10 text-sm text-content-tertiary">{t("filterEmpty")}</p>
        ) : (
          rows.map((row, i) => (
            <Fragment key={row.key}>
              <RecoRowSlot row={row} />
              {i === teaserAfter && <RecoRefineTeaser />}
            </Fragment>
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
