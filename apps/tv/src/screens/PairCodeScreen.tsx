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
} from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import { verifyServer } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ServerInputStep } from "../components/pairing/ServerInputStep";
import { CodeInputStep } from "../components/pairing/CodeInputStep";
import { PairingSuccessStep } from "../components/pairing/PairingSuccessStep";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

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
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();
  const claimMut = useClaimPairingCode();
  const { t } = useTranslation(["auth", "pairing"]);

  const savedUrl = storage.getItem("tentacle_server_url");
  const [serverUrl, setServerUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState(!!savedUrl);

  const [chars, setChars] = useState(["", "", "", ""]);
  const [paired, setPaired] = useState(false);
  const [pairUser, setPairUser] = useState("");

  useEffect(() => {
    if (savedUrl) setAllBackendUrls(savedUrl);
  }, [savedUrl]);

  const switchLang = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
  }, [i18n, storage]);

  const handleTestServer = async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setServerError(null);
    try {
      const result = await verifyServer(serverUrl);
      if (result.success) {
        storage.setItem("tentacle_server_url", result.url);
        setAllBackendUrls(result.url);
        jellyfinClient.setBaseUrl(`${result.url}/api/jellyfin`);
        setServerReady(true);
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setServerError(t(`auth:${key}`, result.errorParams));
      }
    } catch {
      setServerError(t("auth:serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  };

  const code = chars.join("");
  const canSubmit = code.length === 4 && !claimMut.isPending && !paired;

  const handleSubmit = useCallback(() => {
    if (code.length !== 4 || claimMut.isPending || paired) return;
    claimMut.mutate(
      { code, deviceName: "Android TV" },
      {
        onSuccess: (data) => {
          setPaired(true);
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
          setTimeout(() => navigation.replace("Home"), 2000);
        },
      },
    );
  }, [code, claimMut, paired, storage, jellyfinClient, navigation]);

  useEffect(() => {
    if (code.length === 4 && !claimMut.isPending && !paired) handleSubmit();
  }, [code, claimMut.isPending, paired, handleSubmit]);

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
    setServerReady(false);
    setChars(["", "", "", ""]);
    claimMut.reset();
  }, [storage, claimMut]);

  if (paired) {
    return <PairingSuccessStep username={pairUser} />;
  }

  if (!serverReady) {
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
  }

  return (
    <CodeInputStep
      chars={chars}
      onUpdateChar={handleUpdateChar}
      onKeyPress={handleKeyPress}
      isPending={claimMut.isPending}
      isError={claimMut.isError}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onChangeServer={handleChangeServer}
    />
  );
}
