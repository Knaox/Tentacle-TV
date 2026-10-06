import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Server } from "lucide-react";
import type { SetupSelection } from "@tentacle-tv/shared";
import { AuthLayout } from "../auth/AuthLayout";

interface WizardFrameProps {
  title: string;
  subtitle?: ReactNode;
  /** Position (1-indexée) et nombre d'écrans du parcours. */
  position: number;
  total: number;
  onBack?: () => void;
  /** Le Jellyfin choisi, rappelé sous la progression (écrans de son parcours). */
  server?: SetupSelection | null;
  /** La progression n'est pas encore connue (accueil, avant de savoir si le code sera demandé). */
  hideProgress?: boolean;
  /** `full` : une carte plus large, pour l'accès à distance et ses extraits. */
  width?: "wide" | "full";
  children: ReactNode;
}

/**
 * Le cadre de chaque écran de l'assistant : le même que la connexion, avec au
 * sommet de la carte le retour et la progression. La barre se remplit par
 * `scaleX` (transform seul : rien n'est repeint), neutralisée si l'on a
 * demandé moins de mouvement. Sous elle, le Jellyfin choisi et son état, en
 * toutes lettres : on sait toujours quel serveur on prépare.
 */
export function WizardFrame({ title, subtitle, position, total, onBack, server, hideProgress, width = "wide", children }: WizardFrameProps) {
  const { t } = useTranslation("setupWizard");
  return (
    <AuthLayout
      width={width}
      title={title}
      subtitle={subtitle}
      header={
        <div className="mb-6">
          <div className="flex min-h-11 items-center justify-between gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-content-secondary transition-colors hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t("back")}
              </button>
            ) : (
              <span />
            )}
            {hideProgress ? null : <span className="text-xs font-medium tabular-nums text-content-tertiary">{t("progress", { n: position, total })}</span>}
          </div>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={hideProgress ? undefined : position}
            aria-label={hideProgress ? undefined : t("progress", { n: position, total })}
            className="mt-2 h-1 overflow-hidden rounded-full bg-fill-soft"
          >
            <div
              className="h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${hideProgress ? 0 : position / total})`, background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
            />
          </div>
          {server ? <ChosenServer server={server} /> : null}
        </div>
      }
    >
      {children}
    </AuthLayout>
  );
}

/** « Jellyfin “Salon” · déjà configuré » : le serveur que l'on prépare, jamais dit par la couleur seule. */
function ChosenServer({ server }: { server: SetupSelection }) {
  const { t } = useTranslation("setupWizard");
  const name = server.serverName || t("jfUnnamed");
  return (
    <div
      role="note"
      aria-label={t("chosenLabel")}
      data-testid="setup-chosen-server"
      className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-line-subtle bg-fill-faint px-3 py-1.5 text-xs font-medium text-content-secondary"
    >
      <Server size={14} aria-hidden="true" className="shrink-0 text-content-tertiary" />
      <span className="break-words">
        {t("chosenServer", { name, state: t(`chosenState_${server.path}`) })}
        {server.inStack ? ` · ${t("chosenInStack")}` : ""}
      </span>
    </div>
  );
}
