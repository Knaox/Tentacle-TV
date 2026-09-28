import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../auth/LanguageToggle";

interface ShareShellProps {
  /** Visiteur connecté : l'app s'ouvre d'ici ; sinon, le choix de langue. */
  authed: boolean;
  children: ReactNode;
}

/**
 * Le cadre de la liste partagée : le fond de marque des écrans d'entrée
 * (deux dégradés radiaux FIXES, peints une fois, rien d'animé) et une barre
 * haute à droite — la gauche reste libre pour les feux de fenêtre de macOS,
 * comme sur la connexion.
 */
export function ShareShell({ authed, children }: ShareShellProps) {
  const { t } = useTranslation("share");
  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden bg-surface-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]"
        style={{
          background:
            "radial-gradient(70% 60% at 10% 0%, rgba(var(--brand-rgb), 0.22) 0%, rgba(var(--brand-rgb), 0.05) 45%, transparent 72%)," +
            "radial-gradient(50% 50% at 100% 10%, rgba(var(--brand-accent-rgb), 0.12) 0%, transparent 70%)",
        }}
      />
      <div className="flex items-center justify-end gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6 md:px-12">
        {authed ? (
          <Link
            to="/"
            className="flex h-10 items-center rounded-full border border-line-subtle bg-fill-subtle px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {t("openApp")}
          </Link>
        ) : (
          <LanguageToggle />
        )}
      </div>
      {children}
    </div>
  );
}
