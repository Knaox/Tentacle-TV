import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import type { SetupContext, SetupTmdbRequest } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { tmdbKeyHint } from "../admin/metadata/tmdbKey";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import { WizardFrame, type WizardFrameBase } from "./WizardFrame";

const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";

interface TmdbKeyEntryProps {
  /** Le cadre de l'écran (titre, avantages à gauche) : la saisie y pose ses boutons. */
  frame: WizardFrameBase;
  /** Le serveur a accepté (clé validée, ou « plus tard ») : le contexte à jour, puis l'écran suivant. */
  onDone: (context: SetupContext) => void;
}

/**
 * La saisie de la clé : « Vérifier et continuer » la fait valider par TMDB,
 * côté serveur, avant de l'enregistrer ; « Configurer plus tard » n'écrit
 * aucune clé (le serveur retient le choix). Le refus se dit sous le champ ;
 * il s'efface à la frappe — il ne valait que pour la clé jugée. Les deux
 * gestes vont au pied de l'écran : la saisie pose donc le cadre.
 */
export function TmdbKeyEntry({ frame, onDone }: TmdbKeyEntryProps) {
  const { t } = useTranslation("setupWizard");
  const inputId = useId();
  const formId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState<"save" | "later" | null>(null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const key = value.trim();
  const hint = tmdbKeyHint(value);

  const send = async (body: SetupTmdbRequest, kind: "save" | "later") => {
    setPending(kind);
    setError(null);
    try {
      onDone(await setupApi.tmdb(body));
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(null);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (key && !pending) void send({ apiKey: key }, "save");
  };

  return (
    <WizardFrame
      {...frame}
      primary={{ label: t("tmdbSave"), form: formId, disabled: !key || pending !== null, pending: pending === "save", pendingLabel: t("tmdbChecking") }}
      secondary={[{ label: t("tmdbLater"), onClick: () => void send({ later: true }, "later"), disabled: pending !== null, pending: pending === "later" }]}
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor={inputId} className={cls.lbl}>
            {t("tmdbKeyLabel")}
          </label>
          <div className="relative">
            <input
              id={inputId}
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={t("tmdbKeyPlaceholder")}
              aria-describedby={hint ? hintId : undefined}
              aria-invalid={error === "tmdb_key_invalid" ? true : undefined}
              // Une clé d'API n'est pas un mot de passe : ni trousseau, ni gestionnaire, ni correcteur.
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              data-1p-ignore
              data-lpignore="true"
              className={`${cls.inp} pr-12 aria-[invalid=true]:border-status-error ${value ? "font-mono" : ""}`}
            />
            <button
              type="button"
              onClick={() => setReveal((shown) => !shown)}
              aria-label={t(reveal ? "tmdbKeyHide" : "tmdbKeyShow")}
              aria-pressed={reveal}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              {reveal ? <EyeOff aria-hidden size={17} /> : <Eye aria-hidden size={17} />}
            </button>
          </div>
          {hint ? (
            <p id={hintId} className={`mt-1.5 text-xs leading-relaxed ${hint === "v4-token" ? "text-status-warning-fg" : "text-content-tertiary"}`}>
              {t(hint === "v4-token" ? "tmdbKeyHintV4" : "tmdbKeyHintFormat")}
            </p>
          ) : null}
          <a
            href={TMDB_API_SETTINGS}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary"
          >
            {t("tmdbGetKey")}
            <ExternalLink aria-hidden size={14} />
          </a>
        </div>
        <SetupErrorLine code={error} />
        <p className="text-xs leading-relaxed text-content-tertiary">{t("tmdbLaterHint")}</p>
      </form>
    </WizardFrame>
  );
}
