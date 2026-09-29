import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "../components/ui/Spinner";
import { AuthLayout } from "../components/auth/AuthLayout";
import { SetupStepper, type SetupStep } from "../components/setup/SetupStepper";
import { DbStep } from "../components/setup/DbStep";
import { JellyfinStep } from "../components/setup/JellyfinStep";
import { AdminStep } from "../components/setup/AdminStep";
import { LinksStep } from "../components/setup/links/LinksStep";

interface SetupProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- l'utilisateur renvoyé par /api/setup/create-admin, stocké tel quel
  onComplete: (token: string, user: any) => void;
}

const STEP_COPY: Record<SetupStep, { title: string; subtitle: string }> = {
  db: { title: "dbTitle", subtitle: "dbSubtitle" },
  jellyfin: { title: "jellyfinTitle", subtitle: "jellyfinSubtitle" },
  admin: { title: "adminTitle", subtitle: "adminSubtitle" },
  links: { title: "serverLinks:wizardTitle", subtitle: "serverLinks:wizardSubtitle" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- l'utilisateur renvoyé par /api/setup/create-admin, stocké tel quel
type Session = { token: string; user: any };

/**
 * L'assistant d'installation du serveur web (base → Jellyfin → admin → accès),
 * dans le même cadre que la connexion. Les étapes vivent dans `components/setup/`.
 *
 * L'administrateur créé, l'installation est faite : la session est gardée ici
 * le temps de l'étape « Accès », facultative, puis remise à l'application.
 */
export function ServerSetup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("db");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const { t } = useTranslation("setup");

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.state === "setup_db" && (data.dbConnected || data.hasDbUrl)) {
          // DB URL available (env or config file) but tables missing → auto-migrate
          fetch("/api/setup/migrate", { method: "POST" })
            .then((r) => r.json())
            .then((res) => {
              const s = res.state === "setup_admin" ? "admin" : res.state === "setup_jellyfin" ? "jellyfin" : "db";
              setStep(s); setLoading(false);
            })
            .catch(() => { setStep("db"); setLoading(false); });
        } else if (data.dbConnected && data.state !== "setup_db") {
          // DB connected and tables exist → skip to correct step
          const map: Record<string, SetupStep> = { setup_jellyfin: "jellyfin", setup_admin: "admin" };
          setStep(map[data.state] || "db");
          setLoading(false);
        } else {
          // No DB URL at all → show DB step
          setStep("db");
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-0">
        <Spinner size="lg" label={t("configTitle")} />
      </div>
    );
  }

  const copy = STEP_COPY[step];
  return (
    <AuthLayout width="wide" title={t(copy.title)} subtitle={t(copy.subtitle)} header={<SetupStepper step={step} />}>
      {step === "db" && <DbStep onNext={() => setStep("jellyfin")} />}
      {step === "jellyfin" && <JellyfinStep onNext={() => setStep("admin")} />}
      {step === "admin" && (
        <AdminStep
          onComplete={(token, user) => {
            setSession({ token, user });
            setStep("links");
          }}
        />
      )}
      {step === "links" && session && <LinksStep token={session.token} onDone={() => onComplete(session.token, session.user)} />}
    </AuthLayout>
  );
}
