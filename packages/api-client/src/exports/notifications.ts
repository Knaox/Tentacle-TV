// Notifications
export {
  useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, useDeleteNotification, useDeleteNotifications,
  useDeleteAllNotifications, setNotificationsBackendUrl, type AppNotification,
} from "../hooks/useNotifications";

// Notification route resolution
export { resolveNotificationRoute, type NotifPluginMeta } from "../utils/notificationRoute";
export { EXTENSIONS_TAB_PATH, extensionSectionId, parseExtensionSectionId, extensionSectionHref } from "../utils/extensionSection";
export { isPluginActive, isVigieActive, isVigieRecoAvailable, SEER_PLUGIN_ID, type PluginPresence } from "../utils/pluginPresence";
export { formatNotifTitle, notifBodyText, parseTicketNotifBody, type NotifTranslate } from "../utils/notificationText";
export { useNotificationsLive, NOTIFICATION_LIVE_KEYS } from "../hooks/useNotificationsLive";

// Push notifications (mobile)
export {
  useRegisterPushDevice, usePushPreferences, useSetPushPreferences, useSendTestPush, setPushBackendUrl, setPushToken,
  PUSH_PREF_DEFAULTS, type PushPreferences, type TestPushResult,
} from "../hooks/usePushNotifications";
