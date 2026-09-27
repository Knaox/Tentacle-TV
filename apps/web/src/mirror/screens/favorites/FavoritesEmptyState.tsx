import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, History, Layers } from "lucide-react";

const STEPS = [
  { Icon: Heart, key: "emptyStepLike" },
  { Icon: Layers, key: "emptyStepGroup" },
  { Icon: History, key: "emptyStepResume" },
] as const;

/**
 * Mes favoris vide (`favorites/FavoritesEmptyState` de l'app) : emblème cœur
 * 72 sur halo de marque (statique), titre 20 gras, texte 14 tertiaire, trois
 * étapes en lignes de 48 (la troisième parle de reprise et non de partage :
 * le lien des titres likés n'existe que sur le bureau), puis « Parcourir le catalogue » (pilule 48 pleine)
 * et « Voir les recommandations » (pilule fantôme).
 */
export const FavoritesEmptyState = memo(function FavoritesEmptyState() {
  const { t } = useTranslation("favorites");
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center px-6 pb-10 pt-10 text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <span
          aria-hidden
          className="absolute -inset-4 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(var(--brand-accent-rgb),0.4) 0%, rgba(var(--brand-rgb),0.2) 45%, transparent 70%)" }}
        />
        <span
          aria-hidden
          className="relative flex h-[72px] w-[72px] items-center justify-center rounded-3xl border"
          style={{ borderColor: "var(--brand-glow)", background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.28), rgba(var(--brand-accent-rgb),0.22))" }}
        >
          <Heart size={32} strokeWidth={1.8} className="text-brand-light" fill="currentColor" fillOpacity={0.25} />
        </span>
      </div>
      <p className="text-xl font-bold tracking-[-0.4px] text-content-primary">{t("emptyTitle")}</p>
      <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-content-tertiary">{t("emptyBody")}</p>

      <ol className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
        {STEPS.map(({ Icon, key }) => (
          <li key={key} className="flex min-h-[48px] items-center gap-3 rounded-2xl border px-3 text-left" style={{ borderColor: "var(--border-subtle)", background: "var(--fill-subtle)" }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-brand-light" style={{ background: "rgba(var(--brand-rgb), 0.14)" }}>
              <Icon size={16} aria-hidden />
            </span>
            <span className="text-sm text-content-secondary">{t(key)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate("/libraries")}
          className="min-h-[48px] rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-[15px] font-bold text-cta-primary-fg active:opacity-80"
        >
          {t("emptyBrowse")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/recommendations")}
          className="min-h-[48px] rounded-full border px-6 text-[15px] font-semibold text-content-secondary active:opacity-80"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {t("emptyForYou")}
        </button>
      </div>
    </div>
  );
});
