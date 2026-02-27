import { useState, useEffect, useCallback } from "react";
import {
  useTentacleConfig,
  useJellyfinClient,
  useClaimPairingCode,
  setPairingBackendUrl,
  setSeerrBackendUrl,
  setPreferencesBackendUrl,
  setRequestsBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { verifyServer } from "@tentacle-tv/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { WelcomeStep } from "../components/pairing/WelcomeStep";
import { RelayCodeDisplay } from "../components/pairing/RelayCodeDisplay";
import { ServerInputStep } from "../components/pairing/ServerInputStep";
import { CodeInputStep } from "../components/pairing/CodeInputStep";
import { PairingSuccessStep } from "../components/pairing/PairingSuccessStep";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

type Step = "welcome" | "relayCode" | "manualServer" | "manualCode" | "success";

function setAllBackendUrls(url: string) {
  setPairingBackendUrl(url);
  setSeerrBackendUrl(url);
  setPreferencesBackendUrl(url);
  setRequestsBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
}

export function PairCodeScreen({ navigation }: Props) {
  const { i18n } = useTranslation("pairing");
  const { t } = useTranslation(["auth", "pairing"]);
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();
  const claimMut = useClaimPairingCode();

  const [step, setStep] = useState<Step>("welcome");
  const [pairUser, setPairUser] = useState("");

  // Manual flow state
  const [serverUrl, setServerUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [chars, setChars] = useState(["", "", "", ""]);

  const switchLang = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
  }, [i18n, storage]);

  // ── Relay flow: confirmed ──
  const handleRelayConfirmed = useCallback(async (data: RelayStatusResponse) => {
    if (!data.serverUrl || !data.token || !data.user) return;

    // Verify the server is reachable
    try {
      const res = await fetch(`${data.serverUrl}/api/health`);
      if (!res.ok) throw new Error("Health check failed");
    } catch {
      // Server not reachable — still store the data, user may fix network later
    }

    storage.setItem("tentacle_server_url", data.serverUrl);
    setAllBackendUrls(data.serverUrl);
    jellyfinClient.setBaseUrl(`${data.serverUrl}/api/jellyfin`);
    jellyfinClient.setAccessToken(data.token);
    setPreferencesToken(data.token);
    storage.setItem("tentacle_token", data.token);
    storage.setItem(
      "tentacle_user",
      JSON.stringify({ Id: data.user.id, Name: data.user.name }),
    );
    setPairUser(data.user.name);
    setStep("success");
    setTimeout(() => navigation.replace("Home"), 2000);
  }, [storage, jellyfinClient, navigation]);

  // ── Manual flow: test server ──
  const handleTestServer = useCallback(async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setServerError(null);
    try {
      const result = await verifyServer(serverUrl);
      if (result.success) {
        storage.setItem("tentacle_server_url", result.url);
        setAllBackendUrls(result.url);
        jellyfinClient.setBaseUrl(`${result.url}/api/jellyfin`);
        setStep("manualCode");
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setServerError(t(`auth:${key}`, result.errorParams));
      }
    } catch {
      setServerError(t("auth:serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  }, [serverUrl, storage, jellyfinClient, t]);

  // ── Manual flow: claim code ──
  const code = chars.join("");
  const canSubmit = code.length === 4 && !claimMut.isPending && step === "manualCode";

  const handleClaimSubmit = useCallback(() => {
    if (code.length !== 4 || claimMut.isPending) return;
    claimMut.mutate(
      { code, deviceName: "Android TV" },
      {
        onSuccess: (data) => {
          setPairUser(data.username || "");
          if (data.serverUrl) {
            storage.setItem("tentacle_server_url", data.serverUrl);
            setAllBackendUrls(data.serverUrl);
            jellyfinClient.setBaseUrl(`${data.serverUrl}/api/jellyfin`);
          }
          jellyfinClient.setAccessToken(data.token);
          storage.setItem("tentacle_token", data.token);
          if (data.userId && data.username) {
            storage.setItem(
              "tentacle_user",
              JSON.stringify({ Id: data.userId, Name: data.username }),
            );
          }
          setStep("success");
          setTimeout(() => navigation.replace("Home"), 2000);
        },
      },
    );
  }, [code, claimMut, storage, jellyfinClient, navigation]);

  useEffect(() => {
    if (code.length === 4 && !claimMut.isPending && step === "manualCode") {
      handleClaimSubmit();
    }
  }, [code, claimMut.isPending, step, handleClaimSubmit]);

  useEffect(() => {
    if (claimMut.isError) setChars(["", "", "", ""]);
  }, [claimMut.isError]);

  const handleUpdateChar = useCallback((index: number, value: string) => {
    setChars((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === "Backspace") {
      setChars((prev) => {
        const next = [...prev];
        if (prev[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
        }
        return next;
      });
    }
  }, []);

  const handleChangeServer = useCallback(() => {
    storage.removeItem("tentacle_server_url");
    setStep("manualServer");
    setChars(["", "", "", ""]);
    claimMut.reset();
  }, [storage, claimMut]);

  // ── Render based on step ──
  switch (step) {
    case "welcome":
      return (
        <WelcomeStep
          onShowCode={() => setStep("relayCode")}
          onManualSetup={() => setStep("manualServer")}
          onSwitchLang={switchLang}
          currentLang={i18n.language}
        />
      );

    case "relayCode":
      return (
        <RelayCodeDisplay
          onConfirmed={handleRelayConfirmed}
          onCancel={() => setStep("welcome")}
          onManualSetup={() => setStep("manualServer")}
        />
      );

    case "manualServer":
      return (
        <ServerInputStep
          serverUrl={serverUrl}
          onChangeUrl={(text) => { setServerUrl(text); setServerError(null); }}
          testing={testing}
          error={serverError}
          onSubmit={handleTestServer}
          onSwitchLang={switchLang}
          currentLang={i18n.language}
        />
      );

    case "manualCode":
      return (
        <CodeInputStep
          chars={chars}
          onUpdateChar={handleUpdateChar}
          onKeyPress={handleKeyPress}
          isPending={claimMut.isPending}
          isError={claimMut.isError}
          canSubmit={canSubmit}
          onSubmit={handleClaimSubmit}
          onChangeServer={handleChangeServer}
        />
      );

    case "success":
      return <PairingSuccessStep username={pairUser} />;
  }
}
