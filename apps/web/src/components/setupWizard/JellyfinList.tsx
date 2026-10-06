import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { groupServers } from "./jellyfinChoice";
import { JellyfinOption } from "./JellyfinOption";

interface Props {
  servers: readonly JellyfinProbeResult[];
  selected: string | null;
  /** Le Jellyfin conseillé : un badge, jamais coché d'office. */
  recommended: string | null;
  onSelect: (url: string) => void;
  /** Le Jellyfin de la pile démarre encore : sa place en tête est gardée. */
  stackStarting: boolean;
}

/**
 * Tous les Jellyfin trouvés, en UN groupe de boutons radio, rangés pour que
 * la différence saute aux yeux : celui de la pile en tête, puis les NEUFS
 * (Tentacle les configure), puis les DÉJÀ CONFIGURÉS (un compte existant,
 * rien n'y est créé), puis ceux qu'il ne prend pas en charge.
 */
export function JellyfinList({ servers, selected, recommended, onSelect, stackStarting }: Props) {
  const { t } = useTranslation("setupWizard");
  const name = useId();
  const groups = groupServers(servers);
  const option = (server: JellyfinProbeResult) => (
    <JellyfinOption
      key={server.url}
      server={server}
      name={name}
      checked={selected === server.url}
      recommended={recommended === server.url}
      onSelect={() => onSelect(server.url)}
    />
  );
  const section = (key: "fresh" | "configured" | "incompatible", list: JellyfinProbeResult[]) =>
    list.length > 0 ? (
      <div className="space-y-2">
        <p className="text-xs font-medium text-content-tertiary">{t(`jfGroup_${key}`)}</p>
        {list.map(option)}
      </div>
    ) : null;

  if (!stackStarting && servers.length === 0) return null;
  return (
    <div role="radiogroup" aria-label={t("jfListLabel")} className="space-y-4">
      {groups.stack ? option(groups.stack) : null}
      {stackStarting && !groups.stack ? (
        <div className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed border-line-subtle px-4 py-3 text-sm text-content-tertiary" aria-live="polite">
          <LoaderCircle size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
          {t("jfStackStarting")}
        </div>
      ) : null}
      {section("fresh", groups.fresh)}
      {section("configured", groups.configured)}
      {section("incompatible", groups.incompatible)}
    </div>
  );
}
