import { useEffect, useMemo, type ReactNode } from "react";
import { useMotionValue } from "framer-motion";
import { WatchTogetherContext, type WatchTogetherContextValue, type WtChatApi } from "@tentacle-tv/api-client";
import type { WtAffinityMatchDto, WtAffinityStateDto, WtMemberDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { Modal } from "../../components/ui/Modal";
import { SkipSegmentButton } from "../../components/player/SkipSegmentButton";
import { AffinityMatchView } from "../../watchTogether/affinity/AffinityMatchView";
import { ChatOverlay } from "../../watchTogether/chat/ChatOverlay";
import { MessageToastLayer } from "../../watchTogether/chat/MessageToastLayer";
import { ReactionLayer } from "../../watchTogether/chat/ReactionLayer";
import { ElsewhereNotice } from "../../watchTogether/ElsewhereNotice";
import { GroupPlaybackOverlay } from "../../watchTogether/GroupPlaybackOverlay";
import { GroupPlaybackPill } from "../../watchTogether/GroupPlaybackPill";
import { InviteInboxModal } from "../../watchTogether/InviteInboxModal";
import { WatchTogetherRoomModal } from "../../watchTogether/room/WatchTogetherRoomModal";
import { closeRoomModal, openRoomModal } from "../../watchTogether/roomModalStore";
import { WatchTogetherPanel } from "../../watchTogether/WatchTogetherPanel";
import { LAB_EPISODE_ID, LAB_USER_ID, labParam } from "./labFixtures";
import { LabPlayerWeb } from "./labPlayerWeb";
import { labWtContext } from "./labWatchTogether";

const noop = () => {};

const member = (userId: string, username: string, over: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId, username, hasAvatar: false, online: true, inPlayback: true, buffering: false, playbackError: false,
  isHost: false, joinedAt: 0, ...over,
});

const ROOM: WtRoomStateDto = {
  groupId: "lab-group", hostUserId: LAB_USER_ID, epoch: 4, itemId: LAB_EPISODE_ID, paused: false,
  positionTicks: 880_000_000, stateAtServerTime: Date.now(), pauseReason: "none" as WtRoomStateDto["pauseReason"],
  waitingForUserIds: ["lab-marc"],
  members: [
    member(LAB_USER_ID, "Knaoxtest", { isHost: true, driftMs: 0 }),
    member("lab-lea", "Léa", { driftMs: 34 }),
    member("lab-marc", "Marc", { buffering: true }),
    member("lab-ines", "Inès", { inPlayback: false }),
  ],
};

const IN_ROOM = { room: ROOM, isInGroup: true, isHost: true, pendingInvites: [{ userId: "lab-noa", username: "Noa", hasAvatar: false, sentAt: 0 }] };
const ELSEWHERE = { groupId: "g9", hostUsername: "Léa", hostUserId: "lab-lea", itemId: LAB_EPISODE_ID, memberCount: 3, deviceCount: 1 };
const INVITES = [
  { inviteId: "i1", groupId: "g1", fromUserId: "lab-lea", fromUsername: "Léa", itemId: LAB_EPISODE_ID, itemName: "Caminandes — Gran Dillama" },
  { inviteId: "i2", groupId: "g2", fromUserId: "lab-marc", fromUsername: "Marc", itemId: null, itemName: null },
];

function Wt({ value, children }: { value: Partial<WatchTogetherContextValue>; children: ReactNode }) {
  const context = useMemo(() => labWtContext(value), [value]);
  return <WatchTogetherContext.Provider value={context}>{children}</WatchTogetherContext.Provider>;
}

/** Une page d'application factice, sous une feuille ou un avis. */
function Page({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-surface-0 p-10 text-content-primary" data-lab-stage>
      <h1 className="text-display-3">Regarder ensemble</h1>
      <p className="mt-2 max-w-[65ch] text-sm text-content-tertiary">Une page de l'application, sous les surfaces de Watch Together.</p>
      {children}
    </div>
  );
}

function RoomModalAt({ view }: { view: "room" | "invite" }) {
  useEffect(() => {
    openRoomModal(view, { fresh: view === "room" });
    return () => closeRoomModal();
  }, [view]);
  return <WatchTogetherRoomModal />;
}

const now = Date.now();
const CHAT: WtChatApi = {
  state: {
    groupId: "lab-group", unread: 0, open: true, toasts: [],
    messages: [
      { id: "m1", userId: "lab-lea", username: "Léa", text: "Prête ! On lance quand vous voulez.", at: now - 180_000 },
      { id: "m2", userId: LAB_USER_ID, username: "Knaoxtest", text: "C'est parti. Marc, tu charges encore ?", at: now - 120_000 },
      { id: "m3", userId: "lab-marc", username: "Marc", text: "Deux secondes, ma connexion fait des siennes… voilà, c'est bon.", at: now - 60_000 },
      { id: "m4", userId: "lab-lea", username: "Léa", text: "Le lama est incroyable 😂", at: now - 20_000 },
    ],
    reactions: [{ key: "r1", userId: "lab-lea", username: "Léa", emoji: "🔥", count: 3 }],
    typing: [{ userId: "lab-marc", username: "Marc", expiresAt: now + 60_000 }],
  },
  sendChat: () => true, sendReaction: () => true, sendGif: () => true, setOpen: noop, notifyTyping: noop,
};

function PlayerInRoom({ chatOpen }: { chatOpen: boolean }) {
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const chat = chatOpen ? CHAT : { ...CHAT, state: { ...CHAT.state, open: false, unread: 2, toasts: CHAT.state.messages.slice(3) } };
  return (
    <Wt value={IN_ROOM}>
      <LabPlayerWeb />
      <div className="pointer-events-none absolute inset-0 z-30">
        <GroupPlaybackOverlay itemId={LAB_EPISODE_ID} controlsVisible />
      </div>
      {/* Le décompte de saut de la salle : la pilule du lecteur, armée par le serveur. */}
      {!chatOpen && <SkipSegmentButton labelKey="skipIntro" countdownSeconds={3} countdownTotalMs={5000} onSkip={noop} onDismiss={noop} layer="z-50" controlsVisible />}
      <ReactionLayer reactions={chat.state.reactions} />
      <MessageToastLayer toasts={chat.state.toasts} />
      <ChatOverlay chat={chat} dragX={dragX} dragY={dragY} />
    </Wt>
  );
}

const MATCH: WtAffinityMatchDto = { key: "k", itemId: "lab-movie", mediaType: "movie", title: "Sintel", year: 2010, likedBy: [LAB_USER_ID, "lab-lea", "lab-marc"], at: now };
const AFFINITY = { sessionId: 1, seq: 1, kind: "movies", startedBy: LAB_USER_ID, startedAt: now, deckSize: 40, participants: [], matches: [MATCH] } as unknown as WtAffinityStateDto;

/**
 * Watch Together sur toutes ses surfaces, avec une séance FACTICE (`?etat=`) : le panneau de la
 * barre (seul, en groupe, invitations reçues, groupe ailleurs), la salle, l'invitation, la boîte
 * des invitations, le lecteur en séance (avatars, attente, décompte, chat, réactions), les avis
 * (« Rejoindre ici », « Lecture de groupe en cours ») et l'écran d'un match.
 */
export function LabWt() {
  const state = labParam("etat") ?? "salle";
  const panel = (value: Partial<WatchTogetherContextValue>) => (
    <Wt value={value}>
      <Page><div className="ui-menu mt-8 w-96 overflow-hidden !p-0"><WatchTogetherPanel onClose={noop} /></div></Page>
    </Wt>
  );
  switch (state) {
    case "panneau": return panel({});
    case "panneau-groupe": return panel(IN_ROOM);
    case "panneau-invitations": return panel({ invites: INVITES });
    case "panneau-ailleurs": return panel({ elsewhere: ELSEWHERE });
    case "inviter": return <Wt value={IN_ROOM}><Page><RoomModalAt view="invite" /></Page></Wt>;
    case "invitations": return <Wt value={{ invites: INVITES }}><Page><InviteInboxModal onClose={noop} /></Page></Wt>;
    case "lecteur": return <PlayerInRoom chatOpen={false} />;
    case "chat": return <PlayerInRoom chatOpen />;
    case "ailleurs":
      return <Wt value={{ elsewhere: ELSEWHERE }}><Page><ElsewhereNotice /></Page></Wt>;
    case "groupe-en-cours": return <Wt value={IN_ROOM}><Page><GroupPlaybackPill /></Page></Wt>;
    case "match":
      return (
        <Wt value={IN_ROOM}>
          <Page><Modal open onClose={noop} maxWidth={480} labelledBy="lab-match"><AffinityMatchView state={AFFINITY} match={MATCH} titleId="lab-match" /></Modal></Page>
        </Wt>
      );
    default: return <Wt value={IN_ROOM}><Page><RoomModalAt view="room" /></Page></Wt>;
  }
}
