import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { JellyfinDiscoveryResponse, JellyfinProbeResult } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { JellyfinList } from "./JellyfinList";
import { LocalJellyfin } from "./LocalJellyfin";
import { mergeServers, recommendedUrl, sameServer, serverState, withManual, withSelection } from "./jellyfinChoice";
import { MissingJellyfin } from "./MissingJellyfin";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import { SetupWaiting } from "./SetupWaiting";
import type { Wizard } from "./useWizard";
import { STACK_WAITING, useStackProbe } from "./useStackProbe";
import { WizardFrame } from "./WizardFrame";

/** En natif, tant que rien ne répond (Jellyfin en cours d'installation) : une nouvelle recherche de temps en temps. */
const NATIVE_RETRY_MS = 15_000;
const linkBtn = "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary disabled:opacity-60";

/**
 * TOUS les Jellyfin joignables, listés par le serveur (`/jellyfin/discover`),
 * neufs et déjà configurés bien distingués. Pile complète : le sien en tête,
 * sondé à part tant qu'il démarre. RIEN n'est choisi d'office : un badge
 * « Conseillé » (celui de la pile, sinon le neuf), et le choix reste un geste
 * de l'administrateur. Le serveur sonde le Jellyfin choisi et en tire le
 * parcours (`/jellyfin/select`). Une adresse saisie à la main rejoint la liste.
 * App Windows : le Jellyfin de CE PC en tête (`LocalJellyfin` : le démarrer,
 * l'installer), qui rejoint la liste dès qu'il répond. L'écran entier : c'est
 * le choix qui décide du bouton « Continuer » du pied.
 */
export function JellyfinPicker({ wizard, title, subtitle }: { wizard: Wizard; title: string; subtitle: string }) {
  const { t } = useTranslation("setupWizard");
  const context = wizard.data.context;
  const selection = context?.flow.selection ?? null;
  const native = context?.provisioner === "native-host" || context?.provisioner === "managed-by-tentacle";
  const appHost = context?.appHost?.jellyfin === true;
  const stackUrl = context?.provisioner === "docker-sibling" ? context.jellyfin.suggestedUrl : null;
  const stackProbe = useStackProbe(stackUrl, null);
  const [discovery, setDiscovery] = useState<JellyfinDiscoveryResponse | null>(null);
  const [manual, setManual] = useState<JellyfinProbeResult[]>([]);
  // Un retour à cet écran : le Jellyfin choisi avant reste coché — c'était un geste.
  const [picked, setPicked] = useState<string | null>(selection?.url ?? null);
  const [selecting, setSelecting] = useState(false);
  const [searching, setSearching] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<WizardErrorCode | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      setDiscovery(await setupApi.discover());
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void search();
  }, [search]);

  const servers = useMemo(() => {
    const found = discovery?.servers ?? [];
    const merged = mergeServers(stackProbe.probe ?? found.find((s) => s.inStack) ?? null, found, manual);
    return withSelection(merged, selection, context?.jellyfin.clientUrl ?? null);
  }, [stackProbe.probe, discovery, manual, selection, context?.jellyfin.clientUrl]);
  const stackStarting = !!stackUrl && stackProbe.waiting && !servers.some((s) => s.inStack);
  const empty = discovery !== null && servers.length === 0 && !stackStarting;
  useEffect(() => {
    if (!native || !empty || searching) return;
    const timer = setTimeout(() => void search(), NATIVE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [native, empty, searching, search]);

  // Le Jellyfin de ce PC vient de répondre (démarré, installé) : il rejoint la liste, sans être choisi d'office.
  const addLocal = useCallback(
    (url: string) => {
      setupApi.probe(url).then((probe) => setManual((prev) => withManual(prev, probe)), () => undefined);
      void search();
    },
    [search],
  );

  const checkManual = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const probe = await setupApi.probe(manualUrl.trim());
      setManual((prev) => withManual(prev, probe));
      setPicked(probe.compatible ? probe.url : null);
      if (!probe.compatible) setError("jf_incompatible_version");
      setManualOpen(false);
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setChecking(false);
    }
  };

  // Rien de coché tant que l'administrateur n'a rien coché.
  const chosen = servers.find((s) => s.url === picked && s.compatible) ?? null;
  const state = chosen ? serverState(chosen) : null;
  const switching = !!selection && !!chosen && !sameServer(chosen, selection);
  const confirm = async () => {
    if (!chosen) return;
    setSelecting(true);
    setError(null);
    try {
      // Le serveur sonde CE Jellyfin et en tire le parcours : neuf → le compte, déjà configuré → la connexion.
      wizard.choose(await setupApi.select(chosen.url));
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setSelecting(false);
    }
  };

  // À gauche, ce que le choix entraîne (et ses mises en garde) ; dans le pied, seulement ce qui manque pour continuer.
  const aside = state ? (
    <>
      <p aria-live="polite" className="text-content-primary">
        {state === "blank" ? t("jfNextBlank") : t("jfNextConfigured")}
      </p>
      {chosen?.inStack && state === "configured" ? <AdminNotice tone="warning">{t("jfStackConfigured")}</AdminNotice> : null}
      {switching && selection ? <AdminNotice tone="info">{t("jfChangeNotice", { name: selection.serverName || t("jfUnnamed") })}</AdminNotice> : null}
    </>
  ) : undefined;

  return (
    <WizardFrame
      wizard={wizard}
      title={title}
      subtitle={subtitle}
      aside={aside}
      status={state ? null : t("jfPickFirst")}
      primary={{
        label: !chosen ? t("jfPickContinue") : chosen.blank ? t("jfUseBlank") : t("jfUseConfigured"),
        onClick: () => void confirm(),
        disabled: !chosen,
        pending: selecting,
        pendingLabel: t("jfSelecting"),
      }}
    >
      <div className="space-y-4">
        {appHost ? <LocalJellyfin onFound={addLocal} /> : null}
        {searching && servers.length === 0 && !stackStarting ? <SetupWaiting title={t("jfSearching")} /> : null}

        <JellyfinList servers={servers} selected={picked} recommended={recommendedUrl(servers)} onSelect={setPicked} stackStarting={stackStarting} />
        {searching && (servers.length > 0 || stackStarting) ? <SetupWaiting variant="inline" title={t("jfSearchingOthers")} /> : null}

        {empty ? <p className="text-sm text-content-secondary">{t("jfNoneFound")}</p> : null}
        {discovery?.bridged && discovery.udp !== "answered" ? <AdminNotice tone="info">{t("jfBridgedNote")}</AdminNotice> : null}
        {stackProbe.error && !STACK_WAITING.has(stackProbe.error) ? <SetupErrorLine code={stackProbe.error} onRetry={stackProbe.retry} /> : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
          <button type="button" onClick={() => void search()} disabled={searching} className={`${linkBtn} gap-1.5`}>
            <RefreshCw size={14} aria-hidden="true" className={searching ? "motion-safe:animate-spin" : ""} />
            {searching ? t("jfSearchingShort") : t("jfRescan")}
          </button>
          {!manualOpen && !empty ? (
            <button type="button" onClick={() => setManualOpen(true)} className={linkBtn}>
              {t("jfManual")}
            </button>
          ) : null}
        </div>

        {manualOpen || empty ? (
          <form onSubmit={(e) => void checkManual(e)} className="flex flex-wrap items-end gap-3">
            <Field
              label={t("jfUrl")}
              hint={t("jfUrlHint")}
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="http://192.168.1.20:8096"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 grow basis-72"
              required
            />
            <button type="submit" disabled={checking || !manualUrl.trim()} className={`${cls.bs} mb-[1.625rem]`}>
              {checking ? t("jfChecking") : t("jfCheck")}
            </button>
          </form>
        ) : null}

        <SetupErrorLine code={error} />
        {empty && context && !stackUrl && !appHost ? <MissingJellyfin guide={context.missingJellyfin} waiting={native} /> : null}
      </div>
    </WizardFrame>
  );
}
