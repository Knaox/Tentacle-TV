/**
 * La mise à jour du paquet par le Microsoft Store, vue de l'hôte : chercher,
 * télécharger sans rien installer, installer. Reprise de
 * `apps/desktop-electron/src/main/msixUpdate.ts`, avec la voie SILENCIEUSE en
 * plus (`IStoreContext3`, Windows 10 1803) : un serveur tourne souvent sans
 * personne devant l'écran.
 *
 * `StoreContext` n'existe que pour une app à identité de paquet : hors paquet,
 * tout rend `null` ou `unavailable`, sans erreur.
 *
 * Fentes relevées dans `windows.services.store.h` (SDK 10.0.26100) :
 * `IStoreContextStatics::GetDefault` = 6 ;
 * `IStoreContext::GetAppAndOptionalStorePackageUpdatesAsync` = 23,
 * `RequestDownloadAndInstallStorePackageUpdatesAsync` = 25 ;
 * `IStoreContext3::get_CanSilentlyDownloadStorePackageUpdates` = 6,
 * `TrySilentDownloadStorePackageUpdatesAsync` = 7,
 * `TrySilentDownloadAndInstallStorePackageUpdatesAsync` = 8 ;
 * `IStorePackageUpdate::get_Mandatory` = 7 ;
 * `IStorePackageUpdateResult::get_OverallState` = 6 ;
 * `IInitializeWithWindow::Initialize` = 3 (dérive d'`IUnknown`, PAS d'`IInspectable`).
 *
 * ⚠️ Ne se charge que sous Windows.
 */
import {
  activationFactory,
  awaitOperation,
  callForBoolean,
  callForInt32,
  callForPointer,
  callTakingPointer,
  callWithPointer,
  queryInterface,
  release,
  vectorGetAt,
  vectorSize,
  type ComPtr,
} from "../winrt/com";
import { IID, IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE, parameterizedIid } from "../winrt/guid";
import { installOutcome, type InstallOutcome, type StoreUpdateInfo } from "./updateTypes";

const SLOT = {
  getDefault: 6,
  getUpdates: 23,
  requestInstall: 25,
  canSilent: 6,
  silentDownload: 7,
  silentInstall: 8,
  mandatory: 7,
  overallState: 6,
  initializeWithWindow: 3,
  results: 8,
  resultsWithProgress: 10,
} as const;

const SEARCH_MS = 60_000;
const INSTALL_MS = 60 * 60_000;

function storeContext(): ComPtr | null {
  const factory = activationFactory("Windows.Services.Store.StoreContext", IID.storeContextStatics);
  if (factory === null) return null;
  try {
    return callForPointer(factory, SLOT.getDefault);
  } finally {
    release(factory);
  }
}

async function withContext<T>(fallback: T, run: (context: ComPtr) => Promise<T>): Promise<T> {
  const context = storeContext();
  if (context === null) return fallback;
  try {
    return await run(context);
  } finally {
    release(context);
  }
}

async function pendingUpdates(context: ComPtr): Promise<ComPtr | null> {
  const operation = callForPointer(context, SLOT.getUpdates);
  if (operation === null) return null;
  try {
    return await awaitOperation(operation, SLOT.results, SEARCH_MS);
  } finally {
    release(operation);
  }
}

function canSilently(context: ComPtr): boolean {
  const context3 = queryInterface(context, IID.storeContext3);
  if (context3 === null) return false;
  try {
    return callForBoolean(context3, SLOT.canSilent) ?? false;
  } finally {
    release(context3);
  }
}

/** Y a-t-il une mise à jour ? `null` hors paquet ou si le Store ne répond pas. */
export function checkStoreUpdate(): Promise<StoreUpdateInfo | null> {
  return withContext<StoreUpdateInfo | null>(null, async (context) => {
    const updates = await pendingUpdates(context);
    if (updates === null) return null;
    try {
      const size = vectorSize(updates) ?? 0;
      if (size === 0) return { available: false, mandatory: false, canSilent: canSilently(context) };
      const first = vectorGetAt(updates, 0);
      const mandatory = first === null ? false : (callForBoolean(first, SLOT.mandatory) ?? false);
      release(first);
      return { available: true, mandatory, canSilent: canSilently(context) };
    } finally {
      release(updates);
    }
  });
}

/**
 * Lance une opération du Store sur les mises à jour en attente et rend son état final.
 * `mode` : télécharger seulement (silencieux), installer en silence, ou par le dialogue du Store.
 */
async function runOnUpdates(mode: "download" | "silent" | "dialog", window: unknown): Promise<InstallOutcome> {
  return withContext<InstallOutcome>("unavailable", async (context) => {
    if (mode === "dialog" && window) {
      // Sans fenêtre propriétaire, le dialogue du Store rend aussitôt `OtherError`.
      const initializer = queryInterface(context, IID.initializeWithWindow);
      if (initializer !== null) callTakingPointer(initializer, SLOT.initializeWithWindow, window);
      release(initializer);
    }
    const updates = await pendingUpdates(context);
    if (updates === null) return "failed";
    const iterable = queryInterface(updates, parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE));
    release(updates);
    if (iterable === null) return "failed";
    const target = mode === "dialog" ? context : queryInterface(context, IID.storeContext3);
    try {
      if (target === null) return "unavailable";
      const slotIndex = mode === "dialog" ? SLOT.requestInstall : mode === "silent" ? SLOT.silentInstall : SLOT.silentDownload;
      const operation = callWithPointer(target, slotIndex, iterable);
      if (operation === null) return "failed";
      try {
        const result = await awaitOperation(operation, SLOT.resultsWithProgress, INSTALL_MS);
        if (result === null) return "failed";
        const state = callForInt32(result, SLOT.overallState);
        release(result);
        return installOutcome(state);
      } finally {
        release(operation);
      }
    } finally {
      if (target !== context) release(target);
      release(iterable);
    }
  });
}

/** Télécharge sans installer (le serveur tourne pendant ce temps). */
export function downloadStoreUpdate(): Promise<InstallOutcome> {
  return runOnUpdates("download", null);
}

/** Installe : en silence si Windows le permet, sinon par le dialogue du Store rattaché à `window`. */
export function installStoreUpdate(silent: boolean, window: unknown): Promise<InstallOutcome> {
  return runOnUpdates(silent ? "silent" : "dialog", window);
}
