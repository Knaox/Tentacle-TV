import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { useIsMobile } from "../../hooks/useIsMobile";
import { AdminNotice } from "../admin/kit";
import { cls } from "../../pages/adminUtils";
import { useErrorText } from "./ActionError";
import { safeHttpUrl } from "./pluginCatalog";
import { describePluginError, type PluginErrorDescription } from "./pluginErrors";
import type { PluginSource } from "./types";

interface AddSourceSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { url: string; name?: string }) => Promise<PluginSource>;
  onAdded: (source: PluginSource) => void;
}

const DESKTOP_WIDTH = 440;
const MOBILE_HEIGHT_RATIO = 0.9;

/**
 * Ajouter une source, en volet : l'adresse du registre (seule obligatoire —
 * le serveur nomme la source d'après son hôte), un nom au besoin, et ce
 * qu'implique une source tierce. Le serveur lit le registre à l'ajout : la
 * réponse dit tout de suite ce qu'il publie, ou pourquoi il ne répond pas.
 */
export function AddSourceSheet({ open, onClose, onSubmit, onAdded }: AddSourceSheetProps) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const size = isMobile ? Math.round(window.innerHeight * MOBILE_HEIGHT_RATIO) : DESKTOP_WIDTH;
  return (
    <Sheet open={open} onClose={onClose} placement={isMobile ? "bottom" : "right"} size={size} labelledBy={titleId}>
      {/* Remonté à chaque ouverture : le formulaire repart vierge. */}
      {open && <AddSourceForm titleId={titleId} onClose={onClose} onSubmit={onSubmit} onAdded={onAdded} />}
    </Sheet>
  );
}

function AddSourceForm({ titleId, onClose, onSubmit, onAdded }: Omit<AddSourceSheetProps, "open"> & { titleId: string }) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const errorText = useErrorText();
  const urlId = useId();
  const nameId = useId();
  const hintId = useId();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PluginErrorDescription | null>(null);

  const href = safeHttpUrl(url);
  const host = href ? new URL(href).hostname : "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!href || busy) return;
    setBusy(true);
    setError(null);
    try {
      const source = await onSubmit({ url: url.trim(), ...(name.trim() ? { name: name.trim() } : {}) });
      onAdded(source);
    } catch (err) {
      setError(describePluginError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 px-5 py-5" noValidate>
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-bold text-content-primary">{t("addSourceTitle")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common:close")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <AdminNotice tone="warning">{t("sourceWarning")}</AdminNotice>

      <div>
        <label htmlFor={urlId} className={cls.lbl}>{t("sourceUrl")}</label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          autoFocus
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://registry.example.com/plugins.json"
          aria-describedby={hintId}
          aria-invalid={url.trim() !== "" && !href}
          className={cls.inp}
        />
        <p id={hintId} className={`mt-1.5 text-xs ${url.trim() && !href ? "text-status-error-fg" : "text-content-tertiary"}`}>
          {url.trim() && !href ? t("invalidSourceUrlHint") : t("sourceUrlHint")}
        </p>
      </div>

      <div>
        <label htmlFor={nameId} className={cls.lbl}>{t("sourceName")}</label>
        <input
          id={nameId}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder={host || t("sourceNamePlaceholder")}
          className={cls.inp}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-status-error-fg">
          {error.reason === "invalidRequest" ? `${t("failedAddSource")} — ${t("errorInvalidSourceUrl")}` : errorText("addSource", error)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!href || busy} className={cls.bp}>
          {busy ? t("addingSource") : t("add")}
        </button>
        <button type="button" onClick={onClose} className={cls.bs}>{t("common:cancel")}</button>
      </div>
    </form>
  );
}
