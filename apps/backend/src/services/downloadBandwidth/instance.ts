import { getDownloadBandwidthConfig } from "../configStore";
import { BandwidthArbiter } from "./arbiter";

/** L'unique arbitre du processus — mono-instance Docker, un état mémoire suffit. */
export const downloadArbiter = new BandwidthArbiter(getDownloadBandwidthConfig);
