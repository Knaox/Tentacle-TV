import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ADMIN_METADATA_KEY, useAdminMetadataStatus, type AdminMetadataStatus } from "@tentacle-tv/api-client";
import { BACKEND, hdrs, cls, creds } from "./adminUtils";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";
import { MetadataSkeleton } from "../components/admin/metadata/MetadataSkeleton";
import { MetadataLoadError } from "../components/admin/metadata/MetadataLoadError";

/**
 * Onglet « Métadonnées » : clé TMDB, région des plateformes.
 * Lecture PARTAGÉE avec le bandeau « clé TMDB manquante » (même requête,
 * `live` ici) : squelette pendant la première lecture, erreur avec
 * « Réessayer » si elle échoue — plus de page blanche.
 * Pleine largeur : le rail de l'administration borne déjà la page à gauche.
 */
export function AdminMetadata() {
  const { t } = useTranslation("adminMetadata");
  const { isAdmin } = getUserInfo();
  const status = useAdminMetadataStatus({ enabled: isAdmin, live: true });

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-content-primary">{t("title")}</h1>
        <p className="mb-6 max-w-3xl text-sm text-content-tertiary">{t("description")}</p>
        {status.data ? (
          <MetadataSettings info={status.data} />
        ) : status.isError ? (
          <MetadataLoadError onRetry={() => void status.refetch()} retrying={status.isFetching} />
        ) : (
          <MetadataSkeleton />
        )}
      </div>
    </PageTransition>
  );
}

/**
 * Les valeurs ne REDESCENDENT jamais en clair (lecture masquée côté serveur) :
 * un champ laissé vide conserve la valeur enregistrée, « Retirer » l'efface.
 * Une variable d'environnement, quand elle existe, garde la priorité — on
 * l'affiche pour ne pas troubler l'admin qui saisit sans effet.
 */
function MetadataSettings({ info }: { info: AdminMetadataStatus }) {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const [tmdbKey, setTmdbKey] = useState("");
  const [region, setRegion] = useState(info.watchRegion || "FR");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const save = async (payload: Record<string, string>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/metadata`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify(payload),
        credentials: creds(),
      });
      if (r.ok) {
        setMsg({ ok: true, t: t("saved") });
        setTmdbKey("");
        // Le bandeau « clé TMDB manquante » lit le même état : il s'efface
        // dès la clé posée, sans attendre ses cinq minutes de fraîcheur.
        void queryClient.invalidateQueries({ queryKey: ADMIN_METADATA_KEY });
      } else {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        setMsg({
          ok: false,
          t: body?.error === "tmdb-key-invalid" ? t("tmdbKeyInvalid") : t("saveFailed"),
        });
      }
    } catch {
      setMsg({ ok: false, t: t("saveFailed") });
    }
    setBusy(false);
  };

  const submit = () => {
    // Seuls les champs SAISIS partent : vide = valeur conservée côté serveur.
    const payload: Record<string, string> = { watchRegion: region.trim().toUpperCase() };
    if (tmdbKey.trim()) payload.tmdbApiKey = tmdbKey.trim();
    void save(payload);
  };

  const statusLine = (configured: boolean, last4?: string | null, source?: "env" | "db" | null) => (
    <p className="mt-1 text-xs text-content-quaternary">
      {configured
        ? t("metadataConfiguredHint", { last4: last4 ? `…${last4}` : "" })
        : t("metadataNotConfigured")}
      {source === "env" && ` ${t("metadataEnvSource")}`}
    </p>
  );

  return (
    <div>
      <div className={cls.card}>
        <h2 className="mb-1 text-lg font-semibold text-content-primary">TMDB</h2>
        <p className="mb-4 text-sm text-content-quaternary">{t("tmdbDescription")}</p>
        <div className={cls.sub}>
          <label className={cls.lbl} htmlFor="tmdb-key">{t("tmdbKeyLabel")}</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="tmdb-key"
              type="password"
              autoComplete="off"
              placeholder={info.tmdb.configured ? "••••••••" : ""}
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              className={`${cls.inp} min-w-[260px] flex-1`}
            />
            {info.tmdb.configured && info.tmdb.source !== "env" && (
              <button
                onClick={() => void save({ tmdbApiKey: "" })}
                disabled={busy}
                className="text-xs text-content-tertiary underline-offset-2 hover:underline"
              >
                {t("metadataRemove")}
              </button>
            )}
          </div>
          {statusLine(info.tmdb.configured, info.tmdb.last4, info.tmdb.source)}
        </div>
      </div>

      <div className={cls.card}>
        <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("metadataRegionTitle")}</h2>
        <p className="mb-4 text-sm text-content-quaternary">{t("metadataRegionDescription")}</p>
        <div className={cls.sub}>
          <label className={cls.lbl} htmlFor="watch-region">{t("metadataRegionLabel")}</label>
          <input
            id="watch-region"
            type="text"
            maxLength={2}
            value={region}
            onChange={(e) => setRegion(e.target.value.toUpperCase())}
            className={`${cls.inp} w-24`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy} className={cls.bp}>
          {busy ? "..." : t("save")}
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-error-fg)]"}`}>
            {msg.t}
          </span>
        )}
      </div>
    </div>
  );
}
