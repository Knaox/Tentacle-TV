import { useCallback, useEffect, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { pairWithPassword } from "@tentacle-tv/tv-core";
import type { LoginError } from "../redesign/screens/pairing/pairingTypes";
import { pairingTransport } from "../auth/pairingTransport";
import type { PairedAccount } from "./usePairingCode";

/**
 * L'étape « identifiant et mot de passe » du jumelage : ce qui est saisi,
 * l'envoi, et son verdict. La TV en sort jumelée comme par un code
 * (`pairWithPassword`, tv-core) ; le compte confirmé passe à `onPaired`.
 *
 * Le mot de passe quitte l'état dès l'envoi : jamais rangé, jamais
 * journalisé, et un refus rend le formulaire sans lui (l'identifiant reste).
 */
export function usePasswordLogin(onPaired: (account: PairedAccount) => void) {
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  // Un seul envoi à la fois, et rien après le départ de l'écran.
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const changeUsername = useCallback((next: string) => {
    setUsername(next);
    setError(null);
  }, []);
  const changePassword = useCallback((next: string) => {
    setPassword(next);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    const name = username.trim();
    const serverUrl = storage.getItem("tentacle_server_url");
    if (!name || !password || !serverUrl || sending.current) return;
    sending.current = true;
    const secret = password;
    setPassword("");
    setError(null);
    setSigningIn(true);
    const result = await pairWithPassword(
      {
        username: name,
        password: secret,
        // La graine, jamais l'identité adoptée : le serveur en dérive celle du jeton.
        identity: { deviceId: client.getLoginDeviceId(), client: client.getClientName(), device: client.getDeviceName() },
      },
      pairingTransport(serverUrl),
    );
    sending.current = false;
    if (!mounted.current) return;
    // Après un `await`, l'ancienne architecture ne groupe pas les mises à jour.
    unstable_batchedUpdates(() => {
      setSigningIn(false);
      if (result.ok) onPaired({ token: result.token, user: result.user });
      else setError({ key: result.error, status: result.status });
    });
  }, [username, password, storage, client, onPaired]);

  /** En quittant l'étape : le mot de passe et l'erreur s'oublient, l'identifiant reste. */
  const leave = useCallback(() => {
    setPassword("");
    setError(null);
  }, []);

  return { username, password, signingIn, error, changeUsername, changePassword, submit, leave };
}

export type PasswordLogin = ReturnType<typeof usePasswordLogin>;
