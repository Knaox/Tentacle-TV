// WebSocket real-time home updates
export { useHomeWebSocket, setWsBackendUrl } from "../hooks/useHomeWebSocket";

// Socket Tentacle partagé (multiplexé : home, notifications, Watch Together)
export {
  acquireSocket, sendSocketMessage, subscribeSocket, onSocketStatus,
  getSocketStatus, sampleClock, setClockSampling, resetSocketSession, resumeSocketSession, type SocketStatus,
} from "../socket/tentacleSocket";
export { getClockOffsetMs, getClockRttMs } from "../socket/clockSync";

// Canal de session : la télémétrie de lecture et la télécommande Jellyfin
// passent par le backend (opt-in de l'hôte — web, bureau, mobile et TV)
export {
  configureSessionChannel, getChannelStatus, isChannelReporting, onChannelStatus,
  onSessionCommand, onSessionGeneral, onSessionMessage,
  type ChannelStatus, type SessionChannelApp, type SessionCommand, type SessionGeneral, type SessionMessage,
} from "../socket/sessionChannel";

// L'état de Jellyfin dit par le backend (`server:jellyfin`) et ce qu'un lecteur
// en fait pendant une panne : bandeau, détecteurs muets, reprise au retour.
export { getJellyfinHealth, onJellyfinHealth, receiveJellyfinHealth, type JellyfinHealth } from "../socket/jellyfinHealth";
export {
  outageView, veilYieldsToPlayer, LONG_OUTAGE_MS, RECOVERY_GRACE_MS, type OutagePhase, type OutageView,
} from "../playback/jellyfinOutage";
export { useJellyfinOutage, playbackErrorsSuppressed } from "../playback/useJellyfinOutage";
export { createOutageGate, type OutageGate, type OutageGateDeps } from "../playback/outageGate";
export { useOutageGate, type OutageGateHandle } from "../playback/useOutageGate";
export { useOutageNotice, type OutageNotice } from "../playback/useOutageNotice";

// La télécommande appliquée au lecteur (commande Jellyfin → geste), la même
// traduction pour le web, le bureau et le mobile.
export {
  useSessionRemoteTarget, REMOTE_REWIND_SECONDS, REMOTE_FAST_FORWARD_SECONDS, type SessionRemoteTarget,
} from "../hooks/useSessionRemote";

// Le retour d'une commande du tableau de bord des sessions, de l'appui à
// l'effet constaté — le même pour le web et le mobile.
export { useCommandFeedback, type CommandFeedbackApi } from "../hooks/useCommandFeedback";
