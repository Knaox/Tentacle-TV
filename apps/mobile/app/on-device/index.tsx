import { useLocalSearchParams } from "expo-router";
import { OfflineManageScreen } from "@/offline/manage/OfflineManageScreen";

export default function OnDeviceRoute() {
  // `?item=` : le titre que le suivi en direct (Live Activity, notification) vient montrer.
  const { item } = useLocalSearchParams<{ item?: string }>();
  return <OfflineManageScreen focusItemId={typeof item === "string" ? item : null} />;
}
