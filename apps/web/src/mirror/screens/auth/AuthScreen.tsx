import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { TentacleSvg } from "../../../components/ui/TentacleSvg";
import { LanguageToggle } from "../../../components/auth/LanguageToggle";
import { FadeIn } from "../misc/shared/FadeIn";
import { GlassCard } from "../misc/shared/GlassCard";
import "../../mirror.css";
import "../misc/shared/screens.css";

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  showLanguage?: boolean;
  logoSize?: number;
}

/**
 * `AuthScreenFrame` de l'app, HORS coquille : fond de marque FIXE (orbe violet
 * en haut, rose en bas), barre haute (retour, langue) sous l'encoche, logo et
 * mention « TENTACLE TV », puis la `GlassCard` de 420 au plus, padding 24 ;
 * titre à gauche, liens secondaires sous la carte.
 */
export function AuthScreen({ title, subtitle, children, footer, onBack, showLanguage = false, logoSize = 72 }: AuthScreenProps) {
  const { t } = useTranslation("auth");

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col overflow-x-hidden"
      style={{ background: "linear-gradient(180deg, var(--surface-0) 0%, var(--surface-0-tint) 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(var(--brand-rgb), 0.18) 0px, rgba(var(--brand-rgb), 0.04) 96px, transparent 224px)," +
            "linear-gradient(0deg, rgba(var(--brand-accent-rgb), 0.1) 0px, transparent 280px)",
        }}
      />

      <div
        className="relative flex items-center justify-between"
        style={{ minHeight: 52, padding: "calc(max(env(safe-area-inset-top, 0px), 12px) + 4px) 16px 0 8px" }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("backToSignIn")}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-content-primary active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <ChevronLeft aria-hidden size={26} />
          </button>
        ) : <span />}
        {showLanguage && <LanguageToggle />}
      </div>

      <main
        className="relative flex flex-1 flex-col items-center justify-center"
        style={{ padding: "8px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <FadeIn translateY={12} className="flex flex-col items-center" style={{ marginBottom: 20 }}>
          <TentacleSvg size={logoSize} />
          <span aria-hidden className="font-semibold text-content-tertiary" style={{ marginTop: 10, fontSize: 11, letterSpacing: 2.4 }}>
            {t("tentacle").toUpperCase()}
          </span>
        </FadeIn>
        <FadeIn delay={80} className="w-full" style={{ maxWidth: 420 }}>
          <GlassCard padding={24}>
            <h1 className="font-extrabold text-content-primary" style={{ fontSize: 26, letterSpacing: -0.6, lineHeight: 1.15 }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-content-tertiary" style={{ fontSize: 14, lineHeight: "20px", marginTop: 6 }}>{subtitle}</p>
            )}
            <div style={{ marginTop: 24 }}>{children}</div>
          </GlassCard>
          {footer && <div className="flex flex-col items-center" style={{ marginTop: 12 }}>{footer}</div>}
        </FadeIn>
      </main>
    </div>
  );
}
