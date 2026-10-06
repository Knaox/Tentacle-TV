import { useTranslation } from "react-i18next";
import type { DeviceNotice } from "@tentacle-tv/shared";
import { useOnceNotice } from "./useOnceNotice";

/**
 * Le message discret de l'appareil — « Cet appareil ne lit pas l'AV1 : le
 * serveur convertit » (décision du 07/10) —, ou null. Dit une fois, 5 s, la
 * première image venue (`useOnceNotice`), dans la ligne de message du
 * lecteur, la même que « Qualité réduite ». Android TV seulement : l'Apple TV
 * n'en reçoit jamais (`deviceNotice` absent).
 */
export function useDeviceNotice(notice: DeviceNotice | null | undefined, ready: boolean): string | null {
  const { t } = useTranslation("player");
  const visible = useOnceNotice(!!notice, ready);
  return visible && notice ? t(`deviceNotice.${notice}`) : null;
}
