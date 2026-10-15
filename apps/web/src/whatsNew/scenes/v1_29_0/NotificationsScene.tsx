import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";
import { FauxNavBar } from "../v1_22_0/FauxNavBar";
import { FauxDetailStage } from "../v1_24_0/FauxDetailStage";
import { useFauxDetail } from "../v1_24_0/useFauxDetail";
import { BELL_SLOT, FauxBell, FauxNotificationPanel, notifRowCenter, type SceneNotif } from "./FauxNotificationPanel";

/**
 * Le pointeur va à la cloche, le clic, le panneau s'ouvre DEPUIS elle :
 * Aujourd'hui, Plus tôt, l'état de chaque demande d'un coup d'œil. Il survole
 * « … est sorti », le clic, et la fiche de CE titre s'ouvre — la notification
 * lue, la pastille de la cloche décomptée. Un seul élément bouge à la fois.
 */
const STEPS = [700, 650, 300, 1300, 900, 300, 2200] as const;
const TO_BELL = 1;
const PRESS_BELL = 2;
const OPEN = 3;
const HOVER = 4;
const PRESS_ROW = 5;
const DETAIL = 6;

/**
 * La cloche refaite : les notifications par jour, chacune avec la pastille de
 * son état (Disponible, En route, Refusée), et un clic qui mène à l'endroit
 * EXACT — ici, la fiche du titre arrivé, le vrai titre du bandeau. Mouvement
 * réduit : l'image fixe est le panneau ouvert, la ligne survolée — c'est elle
 * qui dit la nouveauté (la fiche seule ne la dirait pas).
 */
export function NotificationsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "notifications", "reco", "common"]);
  const clock = useSceneClock(STEPS, { active, reduced });
  const step = reduced ? HOVER : clock.step;
  const media = useSceneMedia();
  const detail = useFauxDetail();
  const title = detail.title || t("whatsNew:sceneNotifFallbackTitle");
  // Un titre qui VIENT d'arriver : rien d'entamé, rien de posé dans Ma liste.
  const arrived = { ...detail, title, statuses: [], play: { label: t("common:play"), remaining: null, progress: null } };
  const other = (index: number, fallback: string) => posterAt(media, index)?.title || fallback;

  const today: SceneNotif[] = [
    {
      title, body: t("whatsNew:sceneNotifArrived", { title }), stateLabel: t("notifications:stateAvailable"),
      tone: "success", ago: t("notifications:minutesAgo", { count: 5 }), unread: step < PRESS_ROW,
    },
    {
      title: other(1, "Arcane"), body: t("whatsNew:sceneNotifOnTheWay", { title: other(1, "Arcane") }),
      stateLabel: t("notifications:stateProgress"), tone: "info", ago: t("notifications:hoursAgo", { count: 2 }), unread: true,
    },
  ];
  const earlier: SceneNotif[] = [
    {
      title: other(2, "Dune"), body: t("whatsNew:sceneNotifDeclined", { title: other(2, "Dune") }),
      stateLabel: t("notifications:stateDeclined"), tone: "danger", ago: t("notifications:daysAgo", { count: 1 }), unread: false,
    },
  ];
  const unread = today.filter((n) => n.unread).length;
  const open = step >= OPEN && step < DETAIL;
  const bell = { x: BELL_SLOT.x + BELL_SLOT.size / 2, y: BELL_SLOT.y + BELL_SLOT.size / 2 };
  const row = notifRowCenter(0);
  const cursor = step >= HOVER ? row : step >= TO_BELL ? bell : { x: 470, y: 320 };

  return (
    <SceneStage cycle={clock.cycle}>
      <Place x={0} y={0} w={640} h={360} visible={step < DETAIL}>
        <FauxNavBar active="home" pinned={false} moreOpen={false} />
        <FauxBell count={unread} open={open} />
        <FauxRow x={32} y={82} title={t("reco:rowForYou")} count={7} cardW={78} gap={12} />
        <FauxRow x={32} y={232} title={t("common:latestAdditionsShort")} count={7} cardW={78} gap={12} offset={7} />
      </Place>
      <FauxNotificationPanel
        today={today} earlier={earlier} unread={unread} hovered={step >= HOVER ? 0 : null}
        visible={open} scale={open ? 1 : 0.94}
      />
      <Place x={0} y={0} w={640} h={360} visible={step >= DETAIL} scale={step >= DETAIL ? 1 : 1.02}>
        <FauxDetailStage data={arrived} logo={step >= DETAIL} meta={step >= DETAIL} />
      </Place>
      <FauxCursor
        x={cursor.x} y={cursor.y} pressed={step === PRESS_BELL || step === PRESS_ROW} hidden={step >= DETAIL} reduced={reduced}
      />
    </SceneStage>
  );
}
