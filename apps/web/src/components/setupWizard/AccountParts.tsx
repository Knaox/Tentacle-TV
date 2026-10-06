import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { SetupErrorLine } from "./SetupErrorLine";
import type { WizardErrorCode } from "./setupApi";

export const primary = `${cls.bp} w-full sm:w-auto`;
export const linkBtn = "min-h-11 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary";

/** Ce qui est déjà fait, dit en toutes lettres (jamais la couleur seule) : un compte créé, une connexion. */
export function DoneLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-content-primary" role="status">
      <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-status-success-fg" />
      <span>{children}</span>
    </p>
  );
}

interface CredentialsFormProps {
  submitLabel: string;
  /** Rend un code d'erreur, ou rien si c'est accepté. */
  onSubmit: (credentials: { username: string; password: string }) => Promise<WizardErrorCode | null>;
  initialUsername?: string;
  children?: ReactNode;
}

/**
 * Un compte administrateur EXISTANT : son nom et son mot de passe, que
 * Jellyfin juge. Le mot de passe ne vit qu'en mémoire.
 */
export function CredentialsForm({ submitLabel, onSubmit, initialUsername = "", children }: CredentialsFormProps) {
  const { t } = useTranslation("setupWizard");
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
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      {children}
      <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
      <Field label={t("accountPassword")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      <SetupErrorLine code={error} />
      <button type="submit" disabled={pending || !username.trim() || !password} className={primary}>
        {pending ? t("working") : submitLabel}
      </button>
    </form>
  );
}
