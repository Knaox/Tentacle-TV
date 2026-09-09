/**
 * Admin > Téléchargements : le plafond de débit que le serveur consacre aux
 * transferts hors ligne — un pour les clients extérieurs, un pour le réseau
 * local (la règle de la lecture directe : IP privée = réseau local). Réglage
 * du SERVEUR, dans sa table de configuration : c'est la seule carte de la page
 * qui n'écrit pas dans Jellyfin. Le partage équitable entre comptes et
 * l'application à chaud sont l'affaire du backend ; ici, deux lignes.
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { BACKEND, cls, creds, hdrs } from "./adminUtils";
import { useToast } from "../contexts/ToastContext";
import { ToggleSwitch } from "../components/settings/ToggleSwitch";
import { AdminBandwidthIps } from "./AdminBandwidthIps";
import { MAX_MIB_PER_S, MIN_MIB_PER_S, toBps, toDraft, type CapDraft } from "./adminBandwidthUnits";

/** Octets par seconde, `null` = illimité, et les adresses déclarées locales — la forme de l'API. */
interface BandwidthCaps {
  external: number | null;
  internal: number | null;
  internalIps: string[];
}
type PoolId = "external" | "internal";

const POOLS: readonly PoolId[] = ["external", "internal"];
const QUERY_KEY = ["admin-download-bandwidth"];

/**
 * Ce que le serveur rend, mis en forme : un serveur d'avant la liste
 * d'adresses (ou un champ absent) ne doit pas faire tomber la page — la liste
 * vaut alors « aucune ».
 */
function readCaps(raw: Partial<BandwidthCaps> | null | undefined): BandwidthCaps {
  return {
    external: typeof raw?.external === "number" ? raw.external : null,
    internal: typeof raw?.internal === "number" ? raw.internal : null,
    internalIps: Array.isArray(raw?.internalIps) ? raw.internalIps.filter((ip) => typeof ip === "string") : [],
  };
}

async function fetchBandwidth(): Promise<BandwidthCaps> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/bandwidth`, {
    headers: hdrs(),
    credentials: creds(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readCaps(await res.json());
}

async function putBandwidth(caps: BandwidthCaps): Promise<BandwidthCaps> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/bandwidth`, {
    method: "PUT",
    headers: hdrs(),
    credentials: creds(),
    body: JSON.stringify(caps),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readCaps(await res.json());
}

export function AdminDownloadBandwidth() {
  const { t } = useTranslation("admin");
  const { data, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchBandwidth,
    staleTime: 30_000,
    // Un brouillon en cours ne doit pas être remis à zéro par un retour d'onglet.
    refetchOnWindowFocus: false,
  });

  return (
    <section className="mt-6 rounded-xl border border-line-subtle bg-fill-faint p-4">
      <h2 className="text-base font-semibold text-content-primary">{t("bandwidthTitle")}</h2>
      <p className="mt-1 text-sm text-content-tertiary">{t("bandwidthIntro")}</p>
      <p className="mt-2 text-xs text-content-quaternary">{t("bandwidthPoolsHelp")}</p>
      {isError && (
        <p className="mt-4 rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-sm text-status-error-fg">
          {t("bandwidthLoadError")}
        </p>
      )}
      {/* La clé remonte le brouillon sur ce que le serveur vient de confirmer. */}
      {data && <BandwidthForm key={`${data.external}:${data.internal}:${data.internalIps.join(",")}`} initial={data} />}
    </section>
  );
}

function BandwidthForm({ initial }: { initial: BandwidthCaps }) {
  const { t } = useTranslation("admin");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<PoolId, CapDraft>>({
    external: toDraft(initial.external),
    internal: toDraft(initial.internal),
  });
  const [ips, setIps] = useState<string[]>(initial.internalIps);
  const [addingIp, setAddingIp] = useState(false);

  const mutation = useMutation({
    mutationFn: putBandwidth,
    onSuccess: (saved) => {
      queryClient.setQueryData<BandwidthCaps>(QUERY_KEY, saved);
      show("success", t("bandwidthSaved"));
    },
    onError: () => show("error", t("saveFailed")),
  });

  const values = { external: toBps(drafts.external), internal: toBps(drafts.internal) };
  const invalid = POOLS.some((pool) => values[pool] === undefined);
  const sameIps = ips.length === initial.internalIps.length && ips.every((ip, i) => ip === initial.internalIps[i]);
  const unchanged = sameIps && POOLS.every((pool) => values[pool] === initial[pool]);

  const update = (pool: PoolId, patch: Partial<CapDraft>) =>
    setDrafts((previous) => ({ ...previous, [pool]: { ...previous[pool], ...patch } }));

  const save = () => {
    if (invalid) return;
    mutation.mutate({ external: values.external ?? null, internal: values.internal ?? null, internalIps: ips });
  };

  return (
    <div className="mt-4 space-y-2">
      <CapRow
        label={t("bandwidthExternal")}
        draft={drafts.external}
        invalid={values.external === undefined}
        onChange={(patch) => update("external", patch)}
      />
      <CapRow
        label={t("bandwidthInternal")}
        draft={drafts.internal}
        invalid={values.internal === undefined}
        onChange={(patch) => update("internal", patch)}
        // Le « + » : des adresses à traiter comme locales, plafond ou non.
        extra={
          <button
            type="button"
            onClick={() => setAddingIp((open) => !open)}
            aria-label={t("bandwidthAddIp")}
            aria-expanded={addingIp}
            title={t("bandwidthAddIp")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-content-secondary transition hover:bg-fill-medium hover:text-content-primary"
          >
            <Plus size={16} />
          </button>
        }
      />
      <AdminBandwidthIps ips={ips} onChange={setIps} adding={addingIp} onAddingChange={setAddingIp} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={invalid || unchanged || mutation.isPending}
          className={cls.bp}
        >
          {mutation.isPending ? "..." : t("save")}
        </button>
        {invalid && <span className="text-xs text-[var(--status-error-fg)]">{t("bandwidthInvalid")}</span>}
      </div>
    </div>
  );
}

function CapRow({
  label,
  draft,
  invalid,
  onChange,
  extra,
}: {
  label: string;
  draft: CapDraft;
  invalid: boolean;
  onChange: (patch: Partial<CapDraft>) => void;
  /** Un bouton de plus après l'interrupteur (le « + » des adresses locales). */
  extra?: ReactNode;
}) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-fill-subtle p-3">
      <span className="min-w-0 flex-1 text-sm font-semibold text-content-primary">{label}</span>
      <label className="flex flex-shrink-0 cursor-pointer items-center gap-2">
        <span className="text-xs font-medium text-content-tertiary">{t("bandwidthLimit")}</span>
        <ToggleSwitch
          checked={draft.enabled}
          onChange={(enabled) => onChange({ enabled })}
          label={`${label} — ${t("bandwidthLimit")}`}
        />
      </label>
      {extra}
      {draft.enabled ? (
        <label className="flex items-center gap-2">
          <span className="w-28">
            <input
              type="number"
              inputMode="decimal"
              min={MIN_MIB_PER_S}
              max={MAX_MIB_PER_S}
              step={0.1}
              value={draft.mib}
              onChange={(event) => onChange({ mib: event.target.value })}
              aria-invalid={invalid}
              className={cls.inp}
            />
          </span>
          <span className="text-xs text-content-tertiary">{t("bandwidthUnit")}</span>
        </label>
      ) : (
        <span className="text-xs text-content-quaternary">{t("bandwidthUnlimited")}</span>
      )}
    </div>
  );
}
