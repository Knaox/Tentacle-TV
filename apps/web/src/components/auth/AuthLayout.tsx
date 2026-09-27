import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@tentacle-tv/ui";
import { TentacleLogo } from "../ui/TentacleLogo";
import { TentacleSvg } from "../ui/TentacleSvg";
import { LanguageToggle } from "./LanguageToggle";

interface AuthLayoutProps {
  /** Titre de la carte — le seul `h1` de l'écran. */
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sous la carte : liens secondaires (créer un compte, changer de serveur…). */
  footer?: ReactNode;
  /** Au-dessus du titre, dans la carte : l'avis de session expirée, un stepper. */
  header?: ReactNode;
  /** `wide` pour l'assistant d'installation, dont les grilles veulent de la place. */
  width?: "default" | "wide";
}

/**
 * Le cadre commun des écrans d'avant connexion (connexion, inscription, mot de
 * passe oublié, choix du serveur, installation). Deux colonnes à partir de
 * `lg` : la marque à gauche, la carte à droite ; une seule colonne en dessous,
 * le logo au-dessus de la carte.
 *
 * Coût GPU : le fond est FIXE — deux dégradés radiaux peints une fois, aucune
 * animation infinie. Le flou de la `GlassCard` ne se recalcule donc jamais
 * (rien ne bouge derrière elle). L'entrée est une animation BORNÉE, en
 * `transform`/`opacity` seuls, neutralisée par `motion-reduce.css`.
 */
export function AuthLayout({ title, subtitle, children, footer, header, width = "default" }: AuthLayoutProps) {
  const { t } = useTranslation("auth");
  const cardWidth = width === "wide" ? "max-w-lg" : "max-w-[26rem]";

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-surface-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 12% 0%, rgba(var(--brand-rgb), 0.22) 0%, rgba(var(--brand-rgb), 0.05) 45%, transparent 72%)," +
            "radial-gradient(60% 55% at 100% 100%, rgba(var(--brand-accent-rgb), 0.14) 0%, transparent 70%)",
        }}
      />

      {/* Barre haute : la langue, seule, à droite — la gauche reste libre pour
          les feux de fenêtre de macOS dans la coquille de bureau. */}
      <div className="flex justify-end px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <LanguageToggle />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center gap-16 px-4 pb-10 pt-4 sm:px-6 lg:justify-between lg:px-12">
        <section aria-hidden className="hidden max-w-md flex-1 animate-fade-slide-up lg:block">
          <HeroMark />
          <p className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-content-primary">
            {t("tentacle")}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-content-secondary">{t("brandTagline")}</p>
          <div
            className="mt-8 h-1 w-24 rounded-full"
            style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
          />
        </section>

        <div className={`w-full ${cardWidth} animate-fade-slide-up`}>
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <TentacleLogo size="lg" variant="glow" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-content-tertiary">
              {t("tentacle")}
            </p>
          </div>

          <GlassCard className="p-6 sm:p-8">
            {header}
            <h1 className="text-2xl font-extrabold tracking-tight text-content-primary">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-content-tertiary">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </GlassCard>

          {footer && <div className="mt-5 space-y-2 text-center">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/**
 * La mascotte du panneau de marque, plus grande que le plus grand
 * `TentacleLogo` : le dessin est celui de `brand/`, seul le halo est posé ici.
 * Halo et ombre sont FIXES — peints une fois.
 */
function HeroMark() {
  return (
    <span
      className="inline-flex h-40 w-40 items-center justify-center rounded-full"
      style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.38) 0%, rgba(var(--brand-rgb), 0) 70%)" }}
    >
      <TentacleSvg size={136} style={{ filter: "drop-shadow(0 6px 28px rgba(var(--brand-rgb), 0.5))" }} />
    </span>
  );
}
