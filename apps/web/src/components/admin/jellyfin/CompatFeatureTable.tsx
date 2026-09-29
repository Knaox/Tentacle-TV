import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleDashed, CircleMinus, CircleX, TriangleAlert } from "lucide-react";
import type { CompatFeatureView, FeatureState, JellyfinCompatReport } from "@tentacle-tv/shared";
import { localized } from "./compatPresentation";

/**
 * Le détail de la compatibilité (page Services) : chaque fonctionnalité de
 * Tentacle, telle que le référentiel la juge sur la version installée, telle
 * que les sondes la trouvent sur VOTRE serveur, et telle qu'elle sera sur la
 * dernière version publiée. Groupé par zone (connexion, lecture…).
 *
 * Un tableau sur grand écran, une pile de cartes sur téléphone : quatre
 * colonnes ne tiennent pas dans 375 px.
 */

type Cell = FeatureState | "n/a";

const CELL: Record<Cell, { key: string; tone: string; Icon: typeof CircleCheck }> = {
  ok: { key: "featureOk", tone: "text-status-success-fg", Icon: CircleCheck },
  partial: { key: "featurePartial", tone: "text-status-warning-fg", Icon: TriangleAlert },
  fail: { key: "featureFail", tone: "text-status-error-fg", Icon: CircleX },
  unsupported: { key: "featureUnsupported", tone: "text-status-warning-fg", Icon: TriangleAlert },
  untested: { key: "featureUntested", tone: "text-content-tertiary", Icon: CircleDashed },
  "n/a": { key: "featureNotApplicable", tone: "text-content-quaternary", Icon: CircleMinus },
};

interface Row {
  feature: CompatFeatureView;
  installed: CompatFeatureView | null;
  latest: CompatFeatureView | null;
}

function StateCell({ state }: { state: Cell }) {
  const { t } = useTranslation("adminJellyfin");
  const { key, tone, Icon } = CELL[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <Icon size={14} aria-hidden="true" className="flex-shrink-0" />
      {t(key)}
    </span>
  );
}

function ProbeCell({ feature }: { feature: CompatFeatureView | null }) {
  const { t } = useTranslation("adminJellyfin");
  const probe = feature?.probe;
  if (!probe) return <span className="text-xs text-content-quaternary">{t("probeNone")}</span>;
  if (probe.state === "present") return <StateCellText tone="text-status-success-fg" Icon={CircleCheck} text={t("probePresent")} />;
  return (
    <span title={probe.missing.join("\n")}>
      <StateCellText tone="text-status-warning-fg" Icon={CircleX} text={t("probeMissing")} />
      <span className="sr-only"> : {probe.missing.join(", ")}</span>
    </span>
  );
}

function StateCellText({ tone, Icon, text }: { tone: string; Icon: typeof CircleCheck; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <Icon size={14} aria-hidden="true" className="flex-shrink-0" />
      {text}
    </span>
  );
}

function FeatureName({ row }: { row: Row }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const note = row.installed?.note ?? row.latest?.note;
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-content-primary">{localized(row.feature.label, i18n.language)}</p>
      {row.feature.since && !row.installed && (
        <p className="text-xs text-[var(--brand-light)]">{t("featureSince", { version: row.feature.since })}</p>
      )}
      {note && <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{localized(note, i18n.language)}</p>}
    </div>
  );
}

export function CompatFeatureTable({ report }: { report: JellyfinCompatReport }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const { installed, latest } = report;
  const showLatest = latest !== null && latest.newer;

  const groups = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const feature of installed?.features ?? []) byId.set(feature.id, { feature, installed: feature, latest: null });
    for (const feature of showLatest ? latest?.features ?? [] : []) {
      const row = byId.get(feature.id);
      if (row) row.latest = feature;
      else byId.set(feature.id, { feature, installed: null, latest: feature });
    }
    const areas = new Map<string, Row[]>();
    for (const row of byId.values()) areas.set(row.feature.area, [...(areas.get(row.feature.area) ?? []), row]);
    return [...areas.entries()];
  }, [installed, latest, showLatest]);

  if (groups.length === 0) return <p className="text-sm text-content-tertiary">{t("featuresEmpty")}</p>;
  const areaLabel = (area: string) => (report.manifest?.areas[area] ? localized(report.manifest.areas[area], i18n.language) : area);
  const installedHead = installed ? t("compatVersion", { version: installed.version }) : t("compatInstalled");
  const latestHead = latest ? t("compatVersion", { version: latest.version }) : t("compatLatest");
  const cell = (row: Row, side: "installed" | "latest"): Cell => row[side]?.state ?? "n/a";

  return (
    <div>
      <p className="mb-3 text-xs text-content-tertiary">{t("featuresCaption")}</p>
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line-subtle text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
            <th scope="col" className="py-2 pr-4 font-semibold">{t("featureColumn")}</th>
            <th scope="col" className="py-2 pr-4 font-semibold">{installedHead}</th>
            <th scope="col" className="py-2 pr-4 font-semibold">{t("serverColumn")}</th>
            {showLatest && <th scope="col" className="py-2 font-semibold">{latestHead}</th>}
          </tr>
        </thead>
        {groups.map(([area, rows]) => (
          <tbody key={area}>
            <tr>
              <th scope="colgroup" colSpan={showLatest ? 4 : 3} className="pb-1 pt-4 text-xs font-semibold text-content-secondary">
                {areaLabel(area)}
              </th>
            </tr>
            {rows.map((row) => (
              <tr key={row.feature.id} className="border-t border-line-subtle align-top">
                <td className="py-2.5 pr-4"><FeatureName row={row} /></td>
                <td className="py-2.5 pr-4"><StateCell state={cell(row, "installed")} /></td>
                <td className="py-2.5 pr-4"><ProbeCell feature={row.installed} /></td>
                {showLatest && <td className="py-2.5"><StateCell state={cell(row, "latest")} /></td>}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className="space-y-4 md:hidden">
        {groups.map(([area, rows]) => (
          <section key={area} aria-label={areaLabel(area)}>
            <p className="mb-1.5 text-xs font-semibold text-content-secondary">{areaLabel(area)}</p>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.feature.id} className="rounded-xl bg-fill-subtle px-3 py-2.5">
                  <FeatureName row={row} />
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <Line label={installedHead}><StateCell state={cell(row, "installed")} /></Line>
                    <Line label={t("serverColumn")}><ProbeCell feature={row.installed} /></Line>
                    {showLatest && <Line label={latestHead}><StateCell state={cell(row, "latest")} /></Line>}
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-content-tertiary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
