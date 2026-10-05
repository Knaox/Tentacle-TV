import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "../components/ui/Spinner";
import type { SetupWizardProps } from "../components/setupWizard/SetupWizard";

/**
 * L'assistant d'installation du serveur (web et bureau). `App.tsx` le monte
 * tant que l'installation n'est pas faite ; son code — écrans, QR code — n'est
 * chargé qu'à ce moment-là : un serveur installé, et le client LG qui compile
 * `App.tsx`, n'en portent rien.
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
