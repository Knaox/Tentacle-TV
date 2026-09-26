import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { adminMetadataErrorCode, useTestTmdbKey, useUpdateAdminMetadata } from "@tentacle-tv/api-client";
import { cls } from "../../../pages/adminUtils";
import { useToast } from "../../../contexts/ToastContext";
import { InlineNotice } from "./MetadataUi";
import { saveNotice, testNotice, tmdbKeyHint, type Notice } from "./tmdbKey";

const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";

interface TmdbKeyFormProps {
  /** Une clé est déjà en place : « Nouvelle clé », focus d'emblée, « Annuler ». */
  replacing: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}

/**
 * La saisie d'une clé TMDB : « Tester » la vérifie sans l'enregistrer,
 * « Enregistrer » la fait valider par le serveur avant de la stocker. Un
 * verdict ne vaut que pour la clé qu'il a jugée : il s'efface à la frappe.
 */
export function TmdbKeyForm({ replacing, onSaved, onCancel }: TmdbKeyFormProps) {
  const { t } = useTranslation("adminMetadata");
  const toast = useToast();
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const test = useTestTmdbKey();
  const update = useUpdateAdminMetadata();
  const key = value.trim();
  const hint = tmdbKeyHint(value);
  const busy = test.isPending || update.isPending;

  let notice: Notice | null = null;
  if (update.isError) notice = saveNotice(adminMetadataErrorCode(update.error));
  else if (test.isSuccess) notice = testNotice(test.data, false);
  else if (test.isError) notice = testNotice(adminMetadataErrorCode(test.error), false);

  const onChange = (next: string) => {
    setValue(next);
    test.reset();
    update.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!key || busy) return;
    test.reset();
    update.mutate(
      { tmdbApiKey: key },
      {
        onSuccess: () => {
          toast.show("success", t("keySavedToast"));
          onSaved();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={inputId} className={cls.lbl}>
        {t(replacing ? "keyNewLabel" : "keyLabel")}
      </label>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            id={inputId}
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("keyPlaceholder")}
            aria-describedby={hint ? hintId : undefined}
            // Une clé d'API n'est pas un mot de passe : ni trousseau du
            // navigateur, ni gestionnaire, ni correcteur.
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            data-1p-ignore
            data-lpignore="true"
            autoFocus={replacing}
            className={`${cls.inp} pr-12 font-mono`}
          />
          <button
            type="button"
            onClick={() => setReveal((shown) => !shown)}
            aria-label={t(reveal ? "keyHide" : "keyShow")}
            aria-pressed={reveal}
            className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            {reveal ? <EyeOff aria-hidden size={17} /> : <Eye aria-hidden size={17} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => test.mutate(key)} disabled={!key || busy} className={cls.bs}>
            {test.isPending && <LoaderCircle aria-hidden size={16} className="animate-spin" />}
            {t("test")}
          </button>
          <button type="submit" disabled={!key || busy} className={cls.bp}>
            {update.isPending && <LoaderCircle aria-hidden size={16} className="animate-spin" />}
            {t("save")}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={update.isPending} className={cls.bs}>
              {t("cancel")}
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p id={hintId} className={`text-xs ${hint === "v4-token" ? "text-status-warning-fg" : "text-content-tertiary"}`}>
          {t(hint === "v4-token" ? "keyHintV4" : "keyHintFormat")}
        </p>
      )}
      <div aria-live="polite">{notice && <InlineNotice tone={notice.tone}>{t(notice.key)}</InlineNotice>}</div>
      <a
        href={TMDB_API_SETTINGS}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-light underline-offset-2 hover:underline"
      >
        {t("tmdbGetKey")}
        <ExternalLink aria-hidden size={14} />
      </a>
    </form>
  );
}
