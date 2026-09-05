import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import {
  ratingKey,
  useColdStartTitles,
  useDeleteRating,
  useJellyfinClient,
  useMyRatings,
  useRateItem,
  useRecoWarmup,
} from "@tentacle-tv/api-client";
import type { ColdStartTitle, RatingIdentity } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";

/** Un « j'aime » de la grille vaut 8/10 : signal franc, qui laisse le 9 et le
 *  10 aux coups de cœur notés finement sur les fiches. */
const LIKE_SCORE = 8;
const PAGE_SIZE = 24;
const TARGET = 5;

function identityOf(title: ColdStartTitle): RatingIdentity {
  return { mediaType: title.mediaType === "tv" ? "series" : "movie", tmdbId: title.tmdbId };
}

/**
 * Démarrage à froid : sous cinq signaux, pas de recommandation personnalisée —
 * à la place, une sélection en UN clic de titres aimés (toute la carte est la
 * cible), représentative de la bibliothèque entière (le serveur répartit par
 * genre). La bascule vers les rangées est VOLONTAIRE : un bouton, jamais un
 * écran qui se dérobe en pleine sélection.
 */
export function ColdStart({ signalCount, onDone }: { signalCount: number; onDone: () => void }) {
  const { t } = useTranslation("reco");
  const { data, isPending } = useColdStartTitles(true);
  const { data: ratings } = useMyRatings();
  const rate = useRateItem();
  const remove = useDeleteRating();
  const warmup = useRecoWarmup();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const items = data?.items ?? [];
  const ratedKeys = new Set((ratings ?? []).map((r) => ratingKey(r)));
  const pickedHere = items.filter((i) => ratedKeys.has(ratingKey(identityOf(i)))).length;
  // Progression : signaux déjà au profil + choix de la grille (le profil,
  // recalculé derrière un debounce, ne les compte pas encore). Approximation
  // par excès si une note préexistante figure dans la grille — le serveur
  // revérifie de toute façon à la bascule.
  const progress = signalCount + pickedHere;
  const ready = progress >= TARGET;

  const toggle = (title: ColdStartTitle, selected: boolean) => {
    const identity = identityOf(title);
    if (selected) remove.mutate(identity);
    else rate.mutate({ ...identity, jellyfinItemId: title.jellyfinItemId, score: LIKE_SCORE });
  };

  // Bascule INSTANTANÉE : le serveur répond 202 et reconstruit en fond — on
  // n'attend rien, l'écran des rangées s'affiche tout de suite (squelettes +
  // bandeau d'affinage prennent le relais).
  const finish = () => {
    warmup.mutate();
    onDone();
  };

  return (
    <div className="row-gutter mt-8">
      {/* En-tête d'accueil : le seul écran que voit un compte neuf — il donne
          le ton de la page à venir (dégradé de marque, pas de verre coûteux). */}
      <div className="max-w-2xl">
        <p
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--brand)" }}
        >
          <Sparkles size={14} aria-hidden />
          {t("coldKicker")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-content-primary md:text-4xl">{t("coldTitle")}</h1>
        <p className="mt-3 text-content-secondary">{t("coldBody")}</p>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-2 w-44 overflow-hidden rounded-full bg-fill-soft" aria-hidden>
            <div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] transition-transform duration-300"
              style={{ transform: `scaleX(${Math.min(progress / TARGET, 1)})` }}
            />
          </div>
          <span className="text-sm font-semibold text-content-primary" aria-live="polite">
            {t("coldProgress", { count: Math.min(progress, TARGET) })}
          </span>
          <Link to="/" className="ml-auto text-sm text-content-tertiary transition-colors hover:text-content-secondary">
            {t("coldLater")}
          </Link>
        </div>
      </div>

      {isPending ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <Shimmer className="aspect-[2/3] w-full rounded-xl" />
              <Shimmer className="mt-2 h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.slice(0, visible).map((title) => (
            <ColdStartCard
              key={title.jellyfinItemId}
              title={title}
              selected={ratedKeys.has(ratingKey(identityOf(title)))}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {!isPending && visible < items.length && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-line-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            {t("coldMore")}
          </button>
        </div>
      )}

      {/* Bascule volontaire : la pilule suit le défilement dès que le compte y
          est — la grille ne se dérobe jamais toute seule. */}
      {ready && (
        <div className="sticky bottom-20 z-20 mt-10 flex justify-center md:bottom-6">
          <div className="flex items-center gap-4 rounded-full border border-line-subtle bg-surface-modal py-2.5 pl-5 pr-2.5 shadow-2xl">
            <span className="hidden text-sm text-content-secondary sm:inline">{t("coldReadyHint")}</span>
            <button
              type="button"
              onClick={finish}
              className="rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-5 py-2 text-sm font-semibold text-cta-brand-fg transition-transform hover:scale-[1.03] motion-reduce:!transform-none"
            >
              {t("coldCta")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColdStartCard({
  title,
  selected,
  onToggle,
}: {
  title: ColdStartTitle;
  selected: boolean;
  onToggle: (title: ColdStartTitle, selected: boolean) => void;
}) {
  const client = useJellyfinClient();

  return (
    <button
      type="button"
      onClick={() => onToggle(title, selected)}
      aria-pressed={selected}
      aria-label={title.year ? `${title.name} (${title.year})` : title.name}
      className="group block w-full cursor-pointer text-left focus:outline-none"
    >
      <div
        className={`relative overflow-hidden rounded-xl transition-transform duration-200 motion-reduce:!transform-none group-focus-visible:ring-2 group-focus-visible:ring-[var(--brand)] ${
          selected
            ? "scale-[0.97] ring-2 ring-[var(--brand)]"
            : "ring-1 ring-line-subtle group-hover:scale-[1.03]"
        }`}
      >
        <img
          src={client.getImageUrl(title.jellyfinItemId, "Primary", { height: 360, quality: 85 })}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-full object-cover"
          style={{ aspectRatio: "2 / 3" }}
        />
        {/* Voile + coche de sélection : opacité/transform seulement, pas de
            backdrop-filter ni d'ombre animée. */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-200 ${
            selected ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg shadow-lg transition-[transform,opacity] duration-200 motion-reduce:!transform-none ${
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
          aria-hidden
        >
          <Check size={15} strokeWidth={3} />
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-content-primary">{title.name}</p>
      <p className="text-xs text-content-tertiary">{title.year ?? ""}</p>
    </button>
  );
}
