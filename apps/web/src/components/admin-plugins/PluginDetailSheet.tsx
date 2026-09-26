import { useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { useIsMobile } from "../../hooks/useIsMobile";
import { StatusPill } from "../admin/kit";
import { ActionError } from "./ActionError";
import { CatalogEntryAction } from "./CatalogEntryAction";
import { ChangelogView } from "./ChangelogView";
import { useCategoryLabel } from "./MarketplaceToolbar";
import { PluginIcon } from "./PluginIcon";
import { navIconName, repoLink } from "./pluginCatalog";
import { usePluginAdmin } from "./PluginAdminContext";
import type { InstalledPlugin, MarketplacePlugin } from "./types";

interface PluginDetailSheetProps {
  /** L'entrée ouverte ; `undefined` ferme le volet. */
  entry: MarketplacePlugin | undefined;
  installed: InstalledPlugin | undefined;
  update: string | null;
  onClose: () => void;
}

const DESKTOP_WIDTH = 480;
const MOBILE_HEIGHT_RATIO = 0.9;

/**
 * La fiche d'un plugin du catalogue, en volet : tout ce qu'une carte résume —
 * la description entière, les notes de la version publiée (dans la langue de
 * l'administrateur), le dépôt, les plateformes — et le même geste que la carte.
 *
 * Le volet garde la dernière entrée pendant sa sortie animée, sinon il se
 * viderait avant d'avoir glissé hors de l'écran.
 */
export function PluginDetailSheet({ entry, installed, update, onClose }: PluginDetailSheetProps) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const last = useRef(entry);
  if (entry) last.current = entry;
  const shown = entry ?? last.current;
  const size = isMobile ? Math.round(window.innerHeight * MOBILE_HEIGHT_RATIO) : DESKTOP_WIDTH;

  return (
    <Sheet open={entry !== undefined} onClose={onClose} placement={isMobile ? "bottom" : "right"} size={size} labelledBy={titleId}>
      {shown && <DetailBody entry={shown} installed={installed} update={update} titleId={titleId} onClose={onClose} />}
    </Sheet>
  );
}

function DetailBody({ entry, installed, update, titleId, onClose }: {
  entry: MarketplacePlugin;
  installed: InstalledPlugin | undefined;
  update: string | null;
  titleId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(["adminPlugins", "common"]);
  const categoryLabel = useCategoryLabel();
  const { actions } = usePluginAdmin();
  const state = actions.states.get(entry.pluginId);
  const repo = repoLink(entry.repo);
  const released = formatLongDate(entry.releaseDate, i18n.language);

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div className="flex items-start gap-4">
        <PluginIcon name={entry.name} image={entry.icon} lucide={installed ? navIconName(installed) : null} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold leading-snug text-content-primary">{entry.name}</h2>
          {entry.author && <p className="mt-0.5 text-sm text-content-tertiary">{t("byAuthor", { author: entry.author })}</p>}
        </div>
        {/* Le focus arrive ici à l'ouverture : Échap et ce bouton ferment. */}
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label={t("common:close")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {entry.official ? (
          <StatusPill tone="brand" size="sm" dot={false}><ShieldCheck aria-hidden size={12} />{t("official")}</StatusPill>
        ) : (
          <StatusPill tone="warning" size="sm" title={t("thirdPartyHint")}>{t("thirdPartySource", { source: entry.sourceName })}</StatusPill>
        )}
        {entry.category && <StatusPill tone="neutral" size="sm" dot={false}>{categoryLabel(entry.category)}</StatusPill>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CatalogEntryAction entry={entry} installed={installed} update={update} />
        {repo && (
          <a
            href={repo.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line-subtle bg-fill-soft px-4 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:border-line-strong hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <ExternalLink aria-hidden className="h-4 w-4 text-content-secondary" />
            {t("sourceCode")}
          </a>
        )}
      </div>
      {state?.status === "error" && <ActionError action={state.kind} error={state.error} />}

      <p className="whitespace-pre-line text-sm leading-relaxed text-content-secondary">
        {entry.description || t("noDescription")}
      </p>

      {entry.changelog && (
        <section aria-labelledby={`${titleId}-notes`} className="space-y-3 rounded-xl border border-line-subtle bg-fill-faint p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`${titleId}-notes`} className="text-sm font-semibold text-content-primary">
              {t("whatsNewIn", { version: entry.version })}
            </h3>
            {released && <span className="text-xs text-content-tertiary">{released}</span>}
          </div>
          <ChangelogView text={entry.changelog} language={i18n.language} />
        </section>
      )}

      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
        <Fact label={t("factId")}><span className="font-mono text-[13px]">{entry.pluginId}</span></Fact>
        <Fact label={t("factVersion")}>
          <span className="tabular-nums">
            v{entry.version}
            {installed && installed.version !== entry.version && ` · ${t("installedVersion", { version: installed.version })}`}
          </span>
        </Fact>
        {released && !entry.changelog && <Fact label={t("factReleased")}>{released}</Fact>}
        <Fact label={t("factSource")}>{entry.sourceName}</Fact>
        {entry.platforms && entry.platforms.length > 0 && (
          <Fact label={t("factPlatforms")}>
            {entry.platforms.map((p) => t(`platforms.${p}`, { defaultValue: p })).join(" · ")}
          </Fact>
        )}
        {entry.tags && entry.tags.length > 0 && <Fact label={t("factTags")}>{entry.tags.map((tag) => `#${tag}`).join("  ")}</Fact>}
        {repo && <Fact label={t("factRepo")}><span className="break-all">{repo.label}</span></Fact>}
      </dl>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-content-tertiary">{label}</dt>
      <dd className="min-w-0 text-content-primary">{children}</dd>
    </>
  );
}

function formatLongDate(value: string | undefined, language: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language, { day: "numeric", month: "long", year: "numeric" });
}
