import { useEffect } from "react";
import { useRouter } from "expo-router";
import { requestWtLink } from "@/watchTogether/wtSheets";

/** `tentacle://watch-together` : la feuille du groupe (ou les invitations), ouverte depuis l'accueil. */
export default function WatchTogetherLink() {
  const router = useRouter();
  useEffect(() => {
    requestWtLink("room");
    router.replace("/");
  }, [router]);
  return null;
}
