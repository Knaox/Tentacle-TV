import type { SupportTicket } from "@tentacle-tv/api-client";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TicketCard } from "../../../components/support/TicketCard";
import { STATUS_STYLE, TICKET_STATUS_LABEL_KEYS, type TicketStatus } from "../../../components/support/ticketMeta";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";

const STEPS = [900, 700, 1000, 1500] as const;
const COLS: readonly { x: number; status: TicketStatus }[] = [
  { x: 24, status: "open" },
  { x: 190, status: "in_progress" },
  { x: 356, status: "resolved" },
];
// Une vraie TicketCard fait 135 px logiques à cette largeur (mesuré dans le
// DOM, sujet sur deux lignes, méta sur deux lignes) : le pas la dépasse.
const CARD_STEP = 144;
const COL_Y = 14;
const COL_H = 340;
const CARD_Y = COL_Y + 12 + 36;
const noop = () => {};

function fakeTicket(id: string, subject: string, category: SupportTicket["category"], hoursAgo: number, messages: number): SupportTicket {
  return {
    id, subject, category, status: "open", jellyfinUserId: "scene", username: "Knaox",
    createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    _count: { messages },
  };
}

/** Le vrai tableau des tickets, avec ses vraies cartes : l'une glisse d'« Ouvert » à « En cours », le volet s'ouvre. */
export function TicketsBoardScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const grabbed = step >= 1;
  const moved = step >= 2;
  const panel = step >= 3;
  const tickets = useMemo(
    () => ({
      subtitles: fakeTicket("a", t("whatsNew:sceneTicketSubtitles"), "bug", 2, 3),
      login: fakeTicket("b", t("whatsNew:sceneTicketLogin"), "account", 20, 1),
      audio: fakeTicket("c", t("whatsNew:sceneTicketAudio"), "bug", 5, 2),
      poster: fakeTicket("d", t("whatsNew:sceneTicketPoster"), "feature", 48, 4),
    }),
    [t],
  );
  const counts = [moved ? 1 : 2, moved ? 2 : 1, 1];
  return (
    <SceneStage cycle={cycle}>
      {COLS.map((col, i) => (
        <Place key={col.status} x={col.x} y={COL_Y} w={150} h={COL_H} className="flex flex-col rounded-xl border border-line-subtle bg-fill-faint p-3">
          <header className="mb-3 flex items-center gap-2 px-1">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[col.status].dot}`} aria-hidden />
            <span className="text-sm font-semibold text-content-primary">{t(TICKET_STATUS_LABEL_KEYS[col.status])}</span>
            <span className="ml-auto rounded-md bg-fill-subtle px-2 py-0.5 text-xs text-content-tertiary">{counts[i]}</span>
          </header>
        </Place>
      ))}
      <Place x={COLS[1].x + 12} y={CARD_Y} w={126}><TicketCard ticket={tickets.audio} scope="mine" draggable={false} onOpen={noop} /></Place>
      <Place x={COLS[2].x + 12} y={CARD_Y} w={126}><TicketCard ticket={tickets.poster} scope="mine" draggable={false} onOpen={noop} /></Place>
      <Place x={COLS[0].x + 12} y={CARD_Y + CARD_STEP} w={126} dy={moved ? -CARD_STEP : 0}>
        <TicketCard ticket={tickets.login} scope="mine" draggable={false} onOpen={noop} />
      </Place>
      <Place
        x={COLS[0].x + 12}
        y={CARD_Y}
        w={126}
        dx={moved ? COLS[1].x - COLS[0].x : 0}
        dy={moved ? CARD_STEP : 0}
        scale={grabbed && !panel ? 1.05 : 1}
        className={grabbed && !panel ? "opacity-90" : ""}
      >
        <TicketCard ticket={tickets.subtitles} scope="mine" draggable={false} onOpen={noop} />
      </Place>
      <Place x={520} y={COL_Y} w={112} h={COL_H} visible={panel} dx={panel ? 0 : 130} className="rounded-xl border border-line-subtle bg-surface-modal p-3 shadow-2xl">
        <span className="line-clamp-2 text-sm font-medium text-content-primary">{tickets.subtitles.subject}</span>
        <span className={`mt-2 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE.in_progress.chip}`}>
          {t(TICKET_STATUS_LABEL_KEYS.in_progress)}
        </span>
        <span className="mt-3 block h-1.5 w-3/4 rounded-sm bg-fill-medium" />
        <span className="mt-1.5 block h-1.5 w-1/2 rounded-sm bg-fill-soft" />
      </Place>
      <FauxCursor
        x={grabbed ? (moved ? COLS[1].x + 70 : COLS[0].x + 70) : 560}
        y={grabbed ? (moved ? CARD_Y + CARD_STEP + 45 : CARD_Y + 45) : 330}
        pressed={grabbed && !panel}
        hidden={panel}
        reduced={reduced}
      />
    </SceneStage>
  );
}
