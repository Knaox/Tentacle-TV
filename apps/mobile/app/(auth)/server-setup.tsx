import { useRouter } from "expo-router";
import { ServerSetupScreen } from "@/screens/ServerSetupScreen";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";

export default function ServerSetupRoute() {
  const router = useRouter();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();

  const handleServerValidated = (url: string) => {
    storage.setItem("tentacle_server_url", url);
    setServerUrl(url);
    router.replace("/(auth)/login");
  };

  return <ServerSetupScreen onServerValidated={handleServerValidated} />;
}
