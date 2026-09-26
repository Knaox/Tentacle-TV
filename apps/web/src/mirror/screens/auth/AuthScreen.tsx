import type { ReactNode } from "react";
import { TentacleSvg } from "../../../components/ui/TentacleSvg";
import { FadeIn } from "../misc/shared/FadeIn";
import { GlassCard } from "../misc/shared/GlassCard";
import "../../mirror.css";
import "../misc/shared/screens.css";

/**
 * Le cadre des écrans d'authentification de l'app, HORS coquille : fond
 * `SubtleBackground ambient` (s0 → s0Tint + orbe violet de 320), colonne
 * centrée à 24 des bords, zones sûres gérées ici ; logo (`logoSize`, 0 = sans)
 * puis la `GlassCard` de 400 au plus, padding 28.
 */
export function AuthScreen({ logoSize, logoGap, children }: {
  logoSize: number;
  logoGap: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, var(--surface-0) 0%, var(--surface-0-tint) 100%)",
        padding: "calc(max(env(safe-area-inset-top, 0px), 24px) + 16px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 320,
          background:
            "linear-gradient(180deg, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)",
        }}
      />
      {logoSize > 0 && (
        <FadeIn translateY={12} className="relative flex justify-center" style={{ marginBottom: logoGap }}>
          <TentacleSvg size={logoSize} />
        </FadeIn>
      )}
      <FadeIn delay={logoSize > 0 ? 80 : 0} className="relative w-full" style={{ maxWidth: 400 }}>
        <GlassCard padding={28}>{children}</GlassCard>
      </FadeIn>
    </div>
  );
}
