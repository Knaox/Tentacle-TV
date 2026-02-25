import { useRouter } from "expo-router";
import { ServerSetupScreen } from "@/screens/ServerSetupScreen";
import { useServerUrl } from "../_layout";

export default function ServerSetupRoute() {
  const router = useRouter();
  const { setServerUrl } = useServerUrl();

  const handleServerValidated = (url: string) => {
    setServerUrl(url);
    router.replace("/(auth)/login");
  };

  return <ServerSetupScreen onServerValidated={handleServerValidated} />;
}
