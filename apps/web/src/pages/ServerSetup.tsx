import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "../components/ui/Spinner";
import type { SetupWizardProps } from "../components/setupWizard/SetupWizard";

/**
 * L'assistant d'installation du serveur (web et bureau). `App.tsx` le monte
 * tant que l'installation n'est pas faite ; son code — écrans, QR code — n'est
 * chargé qu'à ce moment-là : un serveur installé n'en porte rien. Le client LG,
 * qui compile aussi `App.tsx`, ne compile pas ce module : il y est substitué par
 * l'écran « Indisponible » (`apps/tv-webos/config/substitutionTable.ts`).
 */
const SetupWizard = lazy(() => import("../components/setupWizard/SetupWizard"));

export function ServerSetup(props: SetupWizardProps) {
  const { t } = useTranslation("setupWizard");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-surface-0">
          <Spinner size="lg" label={t("loading")} />
        </div>
      }
    >
      <SetupWizard {...props} />
    </Suspense>
  );
}
