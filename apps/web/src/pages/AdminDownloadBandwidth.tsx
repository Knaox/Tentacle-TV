/**
 * Admin > Téléchargements : le plafond de débit que le serveur consacre aux
 * transferts hors ligne — un pour les clients extérieurs, un pour le réseau
 * local (la règle de la lecture directe : IP privée = réseau local). Réglage
 * du SERVEUR, dans sa table de configuration : c'est la seule carte de la page
 * qui n'écrit pas dans Jellyfin. Le partage équitable entre comptes et
 * l'application à chaud sont l'affaire du backend ; ici, deux lignes.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BACKEND, cls, creds, hdrs } from "./adminUtils";
import { useToast } from "../contexts/ToastContext";
import { ToggleSwitch } from "../components/settings/ToggleSwitch";
import { MAX_MIB_PER_S, MIN_MIB_PER_S, toBps, toDraft, type CapDraft } from "./adminBandwidthUnits";

/** Octets par seconde, `null` = illimité — la forme de l'API. */
interface BandwidthCaps {
  external: number | null;
  internal: number | null;
}
type PoolId = keyof BandwidthCaps;

const POOLS: readonly PoolId[] = ["external", "internal"];
const QUERY_KEY = ["admin-download-bandwidth"];

async function fetchBandwidth(): Promise<BandwidthCaps> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/bandwidth`, {
    headers: hdrs(),
    credentials: creds(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function putBandwidth(caps: BandwidthCaps): Promise<BandwidthCaps> {
  const res = await fetch(`${BACKEND}/api/admin/downloads/bandwidth`, {
    method: "PUT",
    headers: hdrs(),
    credentials: creds(),
    body: JSON.stringify(caps),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
      {data && <BandwidthForm key={`${data.external}:${data.internal}`} initial={data} />}
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
  const unchanged = POOLS.every((pool) => values[pool] === initial[pool]);

  const update = (pool: PoolId, patch: Partial<CapDraft>) =>
    setDrafts((previous) => ({ ...previous, [pool]: { ...previous[pool], ...patch } }));

  const save = () => {
    if (invalid) return;
    mutation.mutate({ external: values.external ?? null, internal: values.internal ?? null });
  };

  return (
    <div className="mt-4 space-y-2">
      {POOLS.map((pool) => (
        <CapRow
          key={pool}
          label={t(pool === "external" ? "bandwidthExternal" : "bandwidthInternal")}
          draft={drafts[pool]}
          invalid={values[pool] === undefined}
          onChange={(patch) => update(pool, patch)}
        />
      ))}
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
}: {
  label: string;
  draft: CapDraft;
  invalid: boolean;
  onChange: (patch: Partial<CapDraft>) => void;
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
