import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { SetupCompleteResponse } from "@tentacle-tv/shared";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { AccountScreen, FinalAccountScreen } from "./AccountScreen";
import { DatabaseScreen } from "./DatabaseScreen";
import { DoneScreen, RemoteScreen } from "./FinishScreens";
import { CodeScreen, WelcomeScreen } from "./IntroScreens";
import { JellyfinScreen } from "./JellyfinScreen";
import { LibrariesScreen } from "./LibrariesScreen";
import { LocaleScreen } from "./LocaleScreen";
import { ApplyScreen, RecapScreen } from "./RecapApplyScreens";
import { useWizard } from "./useWizard";

export interface SetupWizardProps {
  /** L'installation finie : la session (la même que `POST /api/auth/login`) est remise à l'application. */
  onComplete: (token: string, user: SetupCompleteResponse["User"]) => void;
}

/**
 * L'assistant d'installation v2 — une question par écran, dans l'ordre de
 * `wizardModel.ts`. Chargé à la demande (`pages/ServerSetup.tsx`) : il ne pèse
 * rien sur un serveur déjà installé, ni dans le client LG.
 */
export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const wizard = useWizard();
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();

  // La session ouverte avant la fin du parcours : l'accès à distance (appels
  // d'administration) la porte déjà, l'application ne la reçoit qu'à « Ouvrir ».
  const onSession = useCallback(
    (session: SetupCompleteResponse) => {
      client.adoptJellyfinDeviceId(session.DeviceId);
      client.setAccessToken(session.AccessToken);
      storage.setItem("tentacle_token", session.AccessToken);
    },
    [client, storage],
  );
  // Le lien des journaux mène à /setup, que l'application installée ne connaît pas : on rentre à l'accueil.
  const navigate = useNavigate();
  const onFinish = useCallback(
    (session: SetupCompleteResponse) => {
      navigate("/", { replace: true });
      onComplete(session.AccessToken, session.User);
    },
    [navigate, onComplete],
  );

  switch (wizard.step) {
    case "welcome":
      return <WelcomeScreen wizard={wizard} />;
    case "code":
      return <CodeScreen wizard={wizard} />;
    case "database":
      return <DatabaseScreen wizard={wizard} />;
    case "jellyfin":
      return <JellyfinScreen wizard={wizard} />;
    case "account":
      return <AccountScreen wizard={wizard} />;
    case "locale":
      return <LocaleScreen wizard={wizard} />;
    case "libraries":
      return <LibrariesScreen wizard={wizard} />;
    case "finalAccount":
      return <FinalAccountScreen wizard={wizard} />;
    case "recap":
      return <RecapScreen wizard={wizard} />;
    case "apply":
      return <ApplyScreen wizard={wizard} onSession={onSession} />;
    case "remote":
      return <RemoteScreen wizard={wizard} />;
    case "done":
      return <DoneScreen wizard={wizard} onFinish={onFinish} />;
  }
}
