// Notifications
export {
  useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, useDeleteNotification, useDeleteNotifications,
  useDeleteAllNotifications, setNotificationsBackendUrl, backendFetch, notificationsBackendRoot, type AppNotification,
} from "../hooks/useNotifications";
export { useNotificationOpener, lookupLibraryTitle } from "../hooks/useNotificationOpener";
export {
  resolveNotificationDestination, immediateTargetRoute, notificationHasDestination, extensionRoute, itemRoute,
  type LibraryTitleLookup, type NotificationPlatform,
} from "../utils/notificationDestination";
export { NOTIFICATION_STATE_META, notificationStateMeta, type NotificationTone } from "../utils/notificationState";
export { groupNotificationsByDay, type NotificationDayGroup } from "../utils/notificationGroups";
export {
  decideNotificationTap, notificationNeedsPlugins, KNOWN_NOTIFICATION_TYPES, LOCAL_NOTIFICATION_TYPES,
  type NotificationTapAction, type KnownNotificationType,
} from "../utils/notificationTap";
export { notificationVisual, notificationAgo, type NotificationGlyph, type NotificationAgo } from "../utils/notificationVisual";

// Notification route resolution
export { resolveNotificationRoute, FAMILY_ROUTE, type NotifPluginMeta } from "../utils/notificationRoute";
export { EXTENSIONS_TAB_PATH, extensionSectionId, parseExtensionSectionId, extensionSectionHref } from "../utils/extensionSection";
export { isPluginActive, isVigieActive, isVigieRecoAvailable, SEER_PLUGIN_ID, type PluginPresence } from "../utils/pluginPresence";
export { formatNotifTitle, notifBodyText, parseTicketNotifBody, type NotifTranslate } from "../utils/notificationText";
export { useNotificationsLive, NOTIFICATION_LIVE_KEYS } from "../hooks/useNotificationsLive";

// Push notifications (mobile)
export {
  useRegisterPushDevice, usePushPreferences, useSetPushPreferences, useSendTestPush, setPushBackendUrl, setPushToken,
  PUSH_PREF_DEFAULTS, type PushPreferences, type TestPushResult,
} from "../hooks/usePushNotifications";
