import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import { Field } from "../admin/services/Field";
import { SetupErrorLine } from "./SetupErrorLine";
import type { WizardErrorCode } from "./setupApi";
import { WizardFrame, type WizardAction, type WizardFrameBase } from "./WizardFrame";

/** Ce qui est déjà fait, dit en toutes lettres (jamais la couleur seule) : un compte créé, une connexion, une clé gardée. */
export function DoneLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-xl border border-line-subtle bg-status-success-bg px-4 py-3 text-sm leading-relaxed text-content-primary" role="status">
      <CircleCheck size={18} aria-hidden="true" className="mt-px shrink-0 text-status-success-fg" />
      <span>{children}</span>
    </p>
  );
}

interface CredentialsFormProps {
  /** Le cadre de l'écran qui demande le compte (titre, explication) : le formulaire y pose son bouton. */
  frame: WizardFrameBase;
  submitLabel: string;
  /** Rend un code d'erreur, ou rien si c'est accepté. */
  onSubmit: (credentials: { username: string; password: string }) => Promise<WizardErrorCode | null>;
  initialUsername?: string;
  secondary?: readonly WizardAction[];
  children?: ReactNode;
}

/**
 * Un compte administrateur EXISTANT : son nom et son mot de passe, que
 * Jellyfin juge. Le mot de passe ne vit qu'en mémoire. Le formulaire tient
 * l'état du bouton : c'est lui qui pose le cadre de l'écran.
 */
export function CredentialsForm({ frame, submitLabel, onSubmit, initialUsername = "", secondary, children }: CredentialsFormProps) {
  const { t } = useTranslation("setupWizard");
  const formId = useId();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      setError(await onSubmit({ username: username.trim(), password }));
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame {...frame} primary={{ label: submitLabel, form: formId, pending, disabled: !username.trim() || !password }} secondary={secondary}>
      <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-5">
        {children}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
          <Field label={t("accountPassword")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <SetupErrorLine code={error} />
      </form>
    </WizardFrame>
  );
}
