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
  /** `wide` pour l'assistant d'installation, dont les grilles veulent de la place ; `full` pour son accès à distance. */
  width?: "default" | "wide" | "full";
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
  const cardWidth = width === "full" ? "max-w-3xl" : width === "wide" ? "max-w-lg lg:max-w-xl" : "max-w-[26rem]";

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-surface-0">
      {/* Barre haute : la langue, seule, à droite — la gauche reste libre pour
          les feux de fenêtre de macOS dans la coquille de bureau. */}
      <div className="flex justify-end px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <LanguageToggle />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center gap-16 px-4 pb-10 pt-4 sm:px-6 lg:justify-between lg:px-12">
        {/* La marque COLLE à l'écran : sur une carte plus haute que la fenêtre
            (écrans de l'assistant), elle restait centrée sur toute la hauteur
            de la page — au milieu d'une zone qu'on fait défiler. Elle tient
            désormais la hauteur de la fenêtre, centrée dedans, et suit le
            défilement ; sur une carte courte, rien ne change. */}
        <section aria-hidden className="hidden max-w-md flex-1 lg:block">
          <div className="sticky top-0 flex h-full max-h-dvh flex-col justify-center animate-fade-slide-up">
            <HeroMark />
            <p className="mt-8 font-display text-display-2 text-content-primary">{t("tentacle")}</p>
            <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-content-secondary">{t("brandTagline")}</p>
          </div>
        </section>

        <div className={`w-full ${cardWidth} self-center animate-fade-slide-up`}>
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <TentacleLogo size="lg" />
            <p className="ui-eyebrow mt-3">
              {t("tentacle")}
            </p>
          </div>

          <GlassCard className="p-6 sm:p-8">
            {header}
            <h1 className="text-heading-1 text-content-primary">{title}</h1>
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
    <TentacleSvg size={136} />
  );
}
