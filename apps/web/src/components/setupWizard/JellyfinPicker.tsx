import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { JellyfinDiscoveryResponse, JellyfinProbeResult } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { JellyfinOption } from "./JellyfinOption";
import { preselectedUrl, withManual } from "./jellyfinChoice";
import { MissingJellyfin } from "./MissingJellyfin";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";

/** En natif, tant que rien ne répond (Jellyfin en cours d'installation) : une nouvelle recherche de temps en temps. */
const NATIVE_RETRY_MS = 15_000;
const linkBtn = "min-h-11 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary";

/**
 * Pile sans Jellyfin, ou installation native : les Jellyfin joignables, listés
 * par le serveur (`/jellyfin/discover`), le vierge présélectionné. Une adresse
 * saisie à la main rejoint la liste. Le choix fait, la cible est verrouillée
 * pour la suite de l'assistant.
 */
export function JellyfinPicker({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const groupName = useId();
  const context = wizard.data.context;
  const native = context?.provisioner === "native-host";
  const [discovery, setDiscovery] = useState<JellyfinDiscoveryResponse | null>(null);
  const [servers, setServers] = useState<JellyfinProbeResult[]>(wizard.data.probe ? [wizard.data.probe] : []);
  const [selected, setSelected] = useState<string | null>(wizard.data.probe?.url ?? null);
  const [searching, setSearching] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<WizardErrorCode | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      const found = await setupApi.discover();
      setDiscovery(found);
      setServers((prev) => {
        const manual = prev.filter((p) => !found.servers.some((s) => s.url === p.url));
        return [...found.servers, ...manual];
      });
      setSelected((prev) => prev ?? preselectedUrl(found.servers));
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void search();
  }, [search]);
  const empty = discovery !== null && servers.length === 0;
  useEffect(() => {
    if (!native || !empty || searching) return;
    const timer = setTimeout(() => void search(), NATIVE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [native, empty, searching, search]);

  const checkManual = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const probe = await setupApi.probe(manualUrl.trim());
      setServers((prev) => withManual(prev, probe));
      setSelected(probe.compatible ? probe.url : null);
      if (!probe.compatible) setError("jf_incompatible_version");
      setManualOpen(false);
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setChecking(false);
    }
  };

  const chosen = servers.find((s) => s.url === selected && s.compatible) ?? null;
  const confirm = () => {
    if (!chosen) return;
    wizard.patch({ probe: chosen, jellyfinUrl: chosen.url, mode: chosen.blank ? "initialize" : "connect", clientUrl: chosen.clientUrl ?? "" });
    wizard.next();
  };

  return (
    <div className="space-y-4">
      {searching && servers.length === 0 ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-content-tertiary">{t("jfSearching")}</p>
          {[0, 1].map((row) => (
            <div key={row} className="h-14 rounded-xl border border-line-subtle bg-fill-faint motion-safe:animate-pulse" />
          ))}
        </div>
      ) : null}

      {servers.length > 0 ? (
        <div role="radiogroup" aria-label={t("jfListLabel")} className="space-y-2">
          {servers.map((server) => (
            <JellyfinOption key={server.url} server={server} name={groupName} checked={selected === server.url} onSelect={() => setSelected(server.url)} />
          ))}
        </div>
      ) : null}

      {empty ? <p className="text-sm text-content-secondary">{t("jfNoneFound")}</p> : null}
      {discovery?.bridged && discovery.udp !== "answered" ? <AdminNotice tone="info">{t("jfBridgedNote")}</AdminNotice> : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" onClick={() => void search()} disabled={searching} className={`${linkBtn} inline-flex items-center gap-1.5`}>
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
      {empty && context ? <MissingJellyfin guide={context.missingJellyfin} waiting={native} /> : null}

      <button type="button" onClick={confirm} disabled={!chosen} className={`${cls.bp} w-full sm:w-auto`}>
        {chosen?.blank ? t("jfUseBlank") : t("jfUseConfigured")}
      </button>
    </div>
  );
}
