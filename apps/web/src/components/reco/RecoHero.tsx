import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSendRecoFeedback } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { useInViewport } from "../../hooks/useInViewport";
import { useRecoNavigation } from "../../lib/recoNavigation";
import { RecoReasonText } from "./RecoReasonText";
import { recoHaloSourceUrl, recoPosterUrl } from "./recoImages";

interface RecoHeroProps {
  /** La recommandation principale du moment (tête de la rangée « Pour vous »). */
  item: RecoRowItem | undefined;
}

/**
 * Bandeau héros de la page Recommandations : une carte large et son HALO —
 * l'affiche elle-même, en source minuscule (~4 Ko), floutée puis agrandie.
 * Même philosophie que HeroAmbilight (coût runtime déjà mesuré et borné sur
 * l'accueil) plutôt qu'une couleur dominante calculée côté backend : zéro
 * dépendance d'imagerie native, et le rendu est identique à l'œil.
 *
 * Le halo « respire » par la keyframe `reco-breathe` (opacité + échelle
 * uniquement), coupée hors écran par le démontage (`useInViewport`) et par
 * `prefers-reduced-motion` (motion-reduce:animate-none).
 */
export function RecoHero({ item }: RecoHeroProps) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const { open, canOpen } = useRecoNavigation();
  const feedback = useSendRecoFeedback();
  const { ref, visible } = useInViewport<HTMLDivElement>("100px");

  if (!item) return null;

  const posterUrl = recoPosterUrl(item, (id) =>
    client.getImageUrl(id, "Primary", { height: 600, quality: 90 })
  );
  const haloUrl = recoHaloSourceUrl(item, (id) =>
    client.getImageUrl(id, "Primary", { width: 128, quality: 70 })
  );
  const openable = canOpen(item);

  return (
    <div ref={ref} className="row-gutter relative mb-12 mt-6">
      {/* Halo : monté seulement à l'écran — un backdrop caché n'est pas gratuit,
          un halo non plus. Rendu réduit puis agrandi (transform). */}
      {visible && haloUrl && (
        <div aria-hidden className="pointer-events-none absolute -inset-8 overflow-visible">
          <img
            src={haloUrl}
            alt=""
            draggable={false}
            className="motion-reduce:animate-none h-full w-full rounded-[48px] object-cover opacity-80"
            style={{
              filter: "blur(56px) saturate(180%)",
              transform: "scale(1.15)",
              animation: "reco-breathe 7s ease-in-out infinite",
            }}
          />
        </div>
      )}

      <div
        className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-line-subtle bg-surface-1 p-6 md:flex-row md:items-center md:gap-8 md:p-8"
        style={{ boxShadow: "var(--elev-2)" }}
      >
        {posterUrl && (
          <img
            src={posterUrl}
            alt={item.title}
            draggable={false}
            className="w-40 shrink-0 self-center rounded-xl md:w-52"
            style={{ boxShadow: "var(--elev-3)", aspectRatio: "2 / 3", objectFit: "cover" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-accent)]">
            {t("heroKicker")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-content-primary md:text-4xl">{item.title}</h2>
          <p className="mt-1 text-sm text-content-tertiary">
            {item.year ?? ""}
            {item.voteAverage != null && ` · ${item.voteAverage.toFixed(1)}/10`}
          </p>
          <div className="mt-3 text-base">
            <RecoReasonText reasons={item.reasons} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {openable && (
              <button
                type="button"
                onClick={() => open(item)}
                className="rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 py-2.5 font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
                style={{ boxShadow: "var(--elev-2)" }}
              >
                {item.jellyfinItemId ? t("heroOpenDetail") : t("heroOpenVigie")}
              </button>
            )}
            {!item.jellyfinItemId && (
              <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-secondary">
                {t("onDemandBadge")}
              </span>
            )}
            <button
              type="button"
              onClick={() => feedback.mutate({ itemKey: item.key, action: "dismissed" })}
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
            >
              {t("dismissAction")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
