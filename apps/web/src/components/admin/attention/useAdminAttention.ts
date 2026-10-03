import { useEffect, useMemo, useState } from "react";
import { useAdminMetadataStatus, useIsHintDismissed } from "@tentacle-tv/api-client";
import {
  buildAdminAttention,
  evaluateServerLinks,
  resolveServerUpdate,
  type AdminAttention,
  type JellyfinSetupReport,
  type LinkCheck,
} from "@tentacle-tv/shared";
import { MIN_SERVER_VERSION } from "../../../hooks/useServerCompat";
import { useServicesAttention } from "../home/overviewApi";
import { useJellyfinCompat, useJellyfinSetup } from "../jellyfin/jellyfinAdminApi";
import { useServerUpdate } from "../serverUpdate/serverUpdateApi";
import { useKeyHealth } from "../services/useServicesData";
import { useServerLinks } from "../../serverLinks/useServerLinks";
import { readAdminKeyCheck } from "./attentionSources";

/**
 * Ce qui demande l'attention, lu sur les routes existantes — les MÊMES
 * entrées de cache que les sections et la page Services (une seule requête
 * par sujet) — puis jugé par le modèle partagé (`buildAdminAttention`).
 *
 * Une source vaut `undefined` tant qu'elle n'a pas répondu, `null` quand
 * elle a échoué (ou qu'un serveur plus ancien ne la connaît pas) : l'état en
 * une ligne attend les premières, ignore les secondes.
 *
 * Le masquage d'une recommandation attend sa lecture (rien ne clignote) —
 * mais pas indéfiniment : si elle échoue, au bout de huit secondes, la
 * recommandation se montre. Mieux vaut une recommandation masquée qui
 * revient qu'aucune.
 */

const HINTS_GRACE_MS = 8000;

export interface AttentionContext {
  jellyfinUrl: string | null;
  jellyfinVersion: string | null;
  serverCurrent: string | null;
  serverRequired: string | null;
  links: readonly LinkCheck[] | null;
  setup: JellyfinSetupReport | null;
  /** L'état de Jellyfin et de la base n'a pas pu se lire. */
  servicesFailed: boolean;
}

export function useAdminAttention(): { attention: AdminAttention; context: AttentionContext } {
  const services = useServicesAttention();
  const key = useKeyHealth();
  const metadata = useAdminMetadataStatus({ enabled: true });
  const links = useServerLinks();
  const setup = useJellyfinSetup();
  const compat = useJellyfinCompat();
  const update = useServerUpdate();
  const publicUrl = useIsHintDismissed("adminPublicUrl");
  const tmdbKey = useIsHintDismissed("adminTmdbKey");
  const jellyfin = useIsHintDismissed("adminJellyfin");
  const directPlay = useIsHintDismissed("adminDirectPlay");
  const hintsKnown = [publicUrl, tmdbKey, jellyfin, directPlay].every((value) => value !== undefined);
  const [hintsGraceOver, setHintsGraceOver] = useState(false);
  useEffect(() => {
    if (hintsKnown) return;
    const id = setTimeout(() => setHintsGraceOver(true), HINTS_GRACE_MS);
    return () => clearTimeout(id);
  }, [hintsKnown]);
  const dismissed = useMemo(() => {
    const or = (value: boolean | undefined) => value ?? (hintsGraceOver ? false : undefined);
    return { publicUrl: or(publicUrl), tmdbKey: or(tmdbKey), jellyfin: or(jellyfin), directPlay: or(directPlay) };
  }, [publicUrl, tmdbKey, jellyfin, directPlay, hintsGraceOver]);

  const checks = useMemo(() => (links.data ? evaluateServerLinks(links.data) : null), [links.data]);
  const report = update.data;
  const verdict = useMemo(
    () => report
      ? resolveServerUpdate({
        current: report.current,
        latest: report.latest?.version ?? null,
        requiredByClients: report.requiredByClients,
        clientMinimum: MIN_SERVER_VERSION,
      })
      : null,
    [report],
  );
  const setupReport = setup.data && !setup.data.error ? setup.data : null;
  const installed = compat.data?.installed ?? null;

  const attention = useMemo(
    () => buildAdminAttention({
      jellyfin: services.loading ? undefined : (services.data?.jellyfin ?? null),
      adminKey: key.isPending ? undefined : readAdminKeyCheck(key.data?.state),
      databaseDown: services.loading ? undefined : (services.data?.databaseDown ?? null),
      tmdbConfigured: metadata.isPending ? undefined : (metadata.data?.tmdb.configured ?? null),
      links: links.isPending ? undefined : checks,
      jellyfinSetup: setup.isPending ? undefined : setupReport,
      jellyfinVersion: compat.isPending ? undefined : (installed?.status ?? null),
      serverUpdate: update.isPending ? undefined : (verdict?.status ?? null),
      dismissed,
    }),
    [services.loading, services.data, key.isPending, key.data, metadata.isPending, metadata.data, links.isPending, checks,
      setup.isPending, setupReport, compat.isPending, installed, update.isPending, verdict, dismissed],
  );

  const context = useMemo<AttentionContext>(
    () => ({
      jellyfinUrl: services.data?.jellyfinUrl ?? null,
      jellyfinVersion: installed?.version ?? null,
      serverCurrent: report?.current ?? null,
      serverRequired: verdict?.required ?? null,
      links: checks,
      setup: setupReport,
      servicesFailed: !services.loading && services.data === null,
    }),
    [services.loading, services.data, installed, report, verdict, checks, setupReport],
  );
  return { attention, context };
}
