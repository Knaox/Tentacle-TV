import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, cls, creds } from "./adminUtils";

interface MetadataInfo {
  tmdb: { configured: boolean; source: "env" | "db" | null; last4: string | null };
  anilist: { clientIdConfigured: boolean; clientSecretConfigured: boolean; source: "env" | "db" | null };
  watchRegion: string;
}

/**
 * Onglet « Métadonnées » : clé TMDB, client AniList, région des plateformes.
 * Les valeurs ne REDESCENDENT jamais en clair (lecture masquée côté serveur) :
 * un champ laissé vide conserve la valeur enregistrée, « Retirer » l'efface.
 * Une variable d'environnement, quand elle existe, garde la priorité — on
 * l'affiche pour ne pas troubler l'admin qui saisit sans effet.
 */
export function AdminMetadata() {
  const { t } = useTranslation("admin");
  const [info, setInfo] = useState<MetadataInfo | null>(null);
  const [tmdbKey, setTmdbKey] = useState("");
  const [anilistId, setAnilistId] = useState("");
  const [anilistSecret, setAnilistSecret] = useState("");
  const [region, setRegion] = useState("FR");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/metadata`, { headers: hdrs(), credentials: creds() });
      if (r.ok) {
        const d = (await r.json()) as MetadataInfo;
        setInfo(d);
        setRegion(d.watchRegion || "FR");
      }
    } catch {
      /* le message d'échec vit sur la sauvegarde, pas sur la lecture */
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setAnilistId("");
        setAnilistSecret("");
        await load();
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
    if (anilistId.trim()) payload.anilistClientId = anilistId.trim();
    if (anilistSecret.trim()) payload.anilistClientSecret = anilistSecret.trim();
    void save(payload);
  };

  if (!info) return null;

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
      <h1 className="mb-1 text-2xl font-bold text-content-primary">{t("metadataTitle")}</h1>
      <p className="mb-6 text-sm text-content-quaternary">{t("metadataDescription")}</p>

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
        <h2 className="mb-1 text-lg font-semibold text-content-primary">AniList</h2>
        <p className="mb-4 text-sm text-content-quaternary">{t("anilistDescription")}</p>
        <div className={cls.sub}>
          <label className={cls.lbl} htmlFor="anilist-id">{t("anilistClientIdLabel")}</label>
          <input
            id="anilist-id"
            type="text"
            autoComplete="off"
            placeholder={info.anilist.clientIdConfigured ? "••••••••" : ""}
            value={anilistId}
            onChange={(e) => setAnilistId(e.target.value)}
            className={cls.inp}
          />
          <label className={cls.lbl} htmlFor="anilist-secret">{t("anilistClientSecretLabel")}</label>
          <input
            id="anilist-secret"
            type="password"
            autoComplete="off"
            placeholder={info.anilist.clientSecretConfigured ? "••••••••" : ""}
            value={anilistSecret}
            onChange={(e) => setAnilistSecret(e.target.value)}
            className={cls.inp}
          />
          {statusLine(
            info.anilist.clientIdConfigured && info.anilist.clientSecretConfigured,
            null,
            info.anilist.source
          )}
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
