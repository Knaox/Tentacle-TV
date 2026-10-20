// Watch Together partagé (web, bureau, mobile) — la plateforme ne rend que
// l'interface et son lecteur (le PORT `WtPlayerPort`) ; le reste vit ici.

// La séance d'un appareil : contexte, session, messages, invitations envoyées.
export {
  WatchTogetherContext, useWatchTogether, useWatchTogetherOptional, useWatchTogetherOrIdle, WT_IDLE_CONTEXT,
  type WatchTogetherContextValue,
} from "../watchTogether/context";
export { useWatchTogetherSession, type WtPlatformPort } from "../watchTogether/session/useWatchTogetherSession";
export { handleWtServerMessage, type WtEventHelpers } from "../watchTogether/session/wtMessages";
export { usePendingInvites, type WtPendingInvite } from "../watchTogether/session/usePendingInvites";

// Le lecteur : son port, le moteur de synchronisation, la session de lecture.
export type { WtPlayerPort, WtPlayerPortRef, PlayerTransport, PlayerTransportRef } from "../watchTogether/playerPort";
export { useGroupSyncEngine } from "../watchTogether/engine/useGroupSyncEngine";
export { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
export { useGroupSkipCountdown } from "../watchTogether/useGroupSkipCountdown";
export {
  announceLocalRefusal, reportRemoteRefusal, useGroupIntroSkip, useIntroSkipRefusal, type RemoteRefusal,
} from "../watchTogether/introSkipRefusal";
export { setWtLogger, type WtLogger } from "../watchTogether/wtLog";

// Le chat de groupe.
export {
  useWtChat, WT_CHAT_TOAST_TTL_MS, WT_GIF_TTL_MS, WT_REACTION_TTL_MS, type WtChatApi, type WtGifPayload,
} from "../watchTogether/chat/useWtChat";
export {
  chatReducer, initialChatState, WT_CHAT_TOAST_MAX, WT_FLOAT_MAX,
  type WtChatAction, type WtChatState, type WtFloatingReaction,
} from "../watchTogether/chat/chatState";
export { useGifSearch, type GifItem, type GifsPayload } from "../watchTogether/chat/useGifSearch";

// L'affinité (swipe de groupe) : magasin, effets des messages, mots.
export * from "../watchTogether/affinity/affinityStore";
export { handleAffinityMessage, reconcileAffinity, type AffinityEventContext } from "../watchTogether/affinity/affinityEvents";
export { useAffinitySession } from "../watchTogether/affinity/useAffinitySession";
export { AFFINITY_KINDS, KIND_LABEL_KEY, formatNames, memberName } from "../watchTogether/affinity/affinityText";
