import { useEffect } from "react";
import { useRouter } from "expo-router";
import { requestWtLink } from "@/watchTogether/wtSheets";

/** `tentacle://watch-together/affinity` : l'affinité de la salle, ouverte depuis l'accueil. */
export default function WatchTogetherAffinityLink() {
  const router = useRouter();
  useEffect(() => {
    requestWtLink("affinity");
    router.replace("/");
  }, [router]);
  return null;
}
