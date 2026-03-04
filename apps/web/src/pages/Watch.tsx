import { isTauri } from "../hooks/useDesktopPlayer";
import { WatchWeb } from "./WatchWeb";
import { WatchDesktop } from "./WatchDesktop";

export function Watch() {
  return isTauri() ? <WatchDesktop /> : <WatchWeb />;
}
