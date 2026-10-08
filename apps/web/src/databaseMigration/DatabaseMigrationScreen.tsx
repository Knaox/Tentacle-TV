import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DB_MIGRATION_COPY, DB_MIGRATION_REASON_KEYS, dbMigrationEta, dbMigrationRetryClock, type DatabaseMigrationView,
} from "@tentacle-tv/shared";
import { TentacleLogo } from "../components/ui/TentacleLogo";

/**
 * L'écran d'attente de la migration de la base (serveur 1.25), web et bureau :
 * plein écran, AU-DESSUS de tout (voile hors ligne compris), sans un bouton —
 * il se met à jour et s'efface seul. Ni erreur, ni « hors ligne » : le serveur
 * répond, il change de base. La vue vient de `useDatabaseMigrationGate`.
 */
export function DatabaseMigrationScreen({ view }: { view: DatabaseMigrationView }) {
  const { t } = useTranslation("errors");
  const rootRef = useRef<HTMLDivElement>(null);
  // Le focus quitte la page d'en dessous : le clavier n'y agit plus.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="db-migration-title"
      // Fond plein écran : même voile que l'écran hors ligne, un cran au-dessus.
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-surface-modal px-6 outline-none backdrop-blur-md"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <TentacleLogo size="lg" />
        {view.kind === "migrating" ? <Migrating view={view} t={t} /> : <Failed view={view} t={t} />}
      </div>
    </div>
  );
}

type T = (key: string, options?: Record<string, unknown>) => string;

function Migrating({ view, t }: { view: Extract<DatabaseMigrationView, { kind: "migrating" }>; t: T }) {
  const eta = dbMigrationEta(view.etaSeconds);
  return (
    <>
      <h2 id="db-migration-title" className="mt-8 text-2xl font-bold text-content-primary">
        {t(DB_MIGRATION_COPY.title)}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-content-tertiary">{t(DB_MIGRATION_COPY.body)}</p>
      <ProgressBar percent={view.percent} label={t(DB_MIGRATION_COPY.title)} />
      <div className="mt-3 flex w-full justify-between text-xs tabular-nums text-content-tertiary">
        <span className="font-semibold text-content-secondary">{view.percent} %</span>
        {view.total > 0 && <span>{t(DB_MIGRATION_COPY.tables, { done: view.done, total: view.total })}</span>}
      </div>
      <p className="mt-4 text-sm text-content-secondary">{t(eta.key, { minutes: eta.minutes })}</p>
      <p className="mt-8 text-xs leading-relaxed text-content-tertiary">{t(DB_MIGRATION_COPY.footer)}</p>
    </>
  );
}

function Failed({ view, t }: { view: Extract<DatabaseMigrationView, { kind: "failed" }>; t: T }) {
  return (
    <>
      <h2 id="db-migration-title" className="mt-8 text-2xl font-bold text-content-primary">
        {t(DB_MIGRATION_COPY.failedTitle)}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-content-secondary">{t(DB_MIGRATION_COPY.failedBody)}</p>
      <p className="mt-4 text-sm leading-relaxed text-content-tertiary">{t(DB_MIGRATION_REASON_KEYS[view.reason])}</p>
      {/* Sans nouvel essai automatique (`retryInSeconds: null`), rien n'en est dit. */}
      {view.retryInSeconds !== null && (
        <p className="mt-6 text-sm font-semibold text-content-secondary" aria-live="polite">
          {view.retryInSeconds > 0
            ? t(DB_MIGRATION_COPY.retryIn, { time: dbMigrationRetryClock(view.retryInSeconds) })
            : t(DB_MIGRATION_COPY.retryNow)}
        </p>
      )}
      <p className="mt-8 text-xs leading-relaxed text-content-tertiary">{t(DB_MIGRATION_COPY.rollback)}</p>
    </>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-fill-soft"
    >
      {/* N'anime que `transform` (règle du coût GPU). */}
      <div
        className="h-full origin-left rounded-full bg-brand transition-transform duration-700 ease-out"
        style={{ transform: `scaleX(${Math.max(0.02, percent / 100)})` }}
      />
    </div>
  );
}
