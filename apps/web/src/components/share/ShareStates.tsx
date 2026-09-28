import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Link2Off, ListVideo } from "lucide-react";

/**
 * Squelette à la forme de la page remplie : en-tête, carte d'accueil, grille.
 * Le miroitement est celui des cartes (`skeleton-shimmer`), sans spinner.
 */
export const ShareListSkeleton = memo(function ShareListSkeleton() {
  const { t } = useTranslation("share");
  return (
    <div role="status" aria-label={t("loading")} className="px-4 pb-16 sm:px-6 md:px-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full max-w-xl space-y-4">
          <div className="h-6 w-32 rounded-full bg-fill-subtle" />
          <div className="h-10 w-3/4 rounded-xl bg-fill-subtle" />
          <div className="h-4 w-1/2 rounded-full bg-fill-subtle" />
        </div>
        <div className="h-40 w-full rounded-2xl bg-fill-subtle lg:w-[22rem]" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-lg)] bg-fill-subtle">
              <div aria-hidden className="absolute inset-0 skeleton-shimmer" />
            </div>
            <div className="mt-2.5 h-3.5 w-3/4 rounded-full bg-fill-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Emblème de marque des états vides : un aplat au dégradé, un halo fixe. */
function Emblem({ icon }: { icon: "empty" | "error" }) {
  const Icon = icon === "empty" ? ListVideo : Link2Off;
  return (
    <div className="relative mb-6">
      <span
        aria-hidden
        className="absolute inset-0 -m-6 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb),0.4), transparent 70%)" }}
      />
      <span
        className="relative flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
      >
        <Icon size={34} aria-hidden />
      </span>
    </div>
  );
}

/** La liste existe mais ne contient rien : on le dit, sans promettre d'action. */
export const ShareListEmpty = memo(function ShareListEmpty({ ownerUsername }: { ownerUsername: string }) {
  const { t } = useTranslation("share");
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <Emblem icon="empty" />
      <h2 className="text-2xl font-bold tracking-tight text-content-primary">{t("emptyTitle")}</h2>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-content-tertiary">{t("emptyLead", { name: ownerUsername })}</p>
    </div>
  );
});

/**
 * Lien révoqué, mal copié ou serveur muet : le client ne distingue pas les
 * trois (le 404 et le 502 arrivent en même erreur). Un chemin de reprise
 * (réessayer) et une sortie qui ne suppose pas de session.
 */
export const ShareError = memo(function ShareError({
  onRetry, retrying, exitTo, exitLabel,
}: {
  onRetry: () => void;
  retrying: boolean;
  exitTo: string;
  exitLabel: string;
}) {
  const { t } = useTranslation("share");
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <Emblem icon="error" />
      <h1 className="text-2xl font-bold tracking-tight text-content-primary md:text-3xl">{t("errorTitle")}</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-content-tertiary">{t("errorLead")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
          className="flex h-11 cursor-pointer items-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-sm font-bold text-cta-primary-fg transition-transform duration-150 hover:scale-[1.03] disabled:opacity-50 motion-reduce:hover:scale-100"
        >
          {t("retry")}
        </button>
        <Link
          to={exitTo}
          className="flex h-11 items-center rounded-full border border-line-subtle bg-fill-subtle px-6 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          {exitLabel}
        </Link>
      </div>
    </div>
  );
});
