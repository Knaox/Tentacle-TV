// Notifications — le catalogue pur vit dans shared (`notifications/`) ; réexporté ici pour les clients.
export {
  useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, useDeleteNotification, useDeleteNotifications,
  useDeleteAllNotifications, setNotificationsBackendUrl, backendFetch, notificationsBackendRoot, type AppNotification,
} from "../hooks/useNotifications";
export { useNotificationOpener, lookupLibraryTitle } from "../hooks/useNotificationOpener";
export {
  resolveNotificationDestination, immediateTargetRoute, notificationHasDestination, extensionRoute, itemRoute,
  type LibraryTitleLookup, type NotificationPlatform,
} from "@tentacle-tv/shared";
export { NOTIFICATION_STATE_META, notificationStateMeta, type NotificationTone } from "@tentacle-tv/shared";
export { groupNotificationsByDay, type NotificationDayGroup } from "@tentacle-tv/shared";
export {
  decideNotificationTap, notificationNeedsPlugins, KNOWN_NOTIFICATION_TYPES, LOCAL_NOTIFICATION_TYPES,
  type NotificationTapAction, type KnownNotificationType,
} from "@tentacle-tv/shared";
export { notificationVisual, notificationAgo, type NotificationGlyph, type NotificationAgo } from "@tentacle-tv/shared";

// Notification route resolution
export { resolveNotificationRoute, FAMILY_ROUTE, type NotifPluginMeta } from "@tentacle-tv/shared";
export { EXTENSIONS_TAB_PATH, extensionSectionId, parseExtensionSectionId, extensionSectionHref } from "@tentacle-tv/shared";
export { isPluginActive, isVigieActive, isVigieRecoAvailable, SEER_PLUGIN_ID, type PluginPresence } from "../utils/pluginPresence";
export { formatNotifTitle, notifBodyText, parseTicketNotifBody, type NotifTranslate } from "../utils/notificationText";
export { useNotificationsLive, NOTIFICATION_LIVE_KEYS } from "../hooks/useNotificationsLive";

// Push notifications (mobile)
export {
  useRegisterPushDevice, usePushPreferences, useSetPushPreferences, useSendTestPush, setPushBackendUrl, setPushToken,
  PUSH_PREF_DEFAULTS, type PushPreferences, type TestPushResult,
} from "../hooks/usePushNotifications";
