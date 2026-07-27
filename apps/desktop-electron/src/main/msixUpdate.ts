/**
 * Mise à jour du paquet MSIX par le Microsoft Store.
 *
 * Portage de `apps/desktop/src-tauri/src/msix_update.rs`, qui s'appuyait sur la
 * caisse `windows`. Ici, WinRT est atteint par koffi — voir `winrt/com.ts` pour
 * le comment, et `winrt/guid.ts` pour l'unique identifiant qu'il faut calculer.
 *
 * # Ce qui ne fonctionne que dans un paquet installé
 *
 * `StoreContext.GetDefault()` n'a de sens que pour une application ayant une
 * IDENTITÉ de paquet. En développement, la recherche échoue proprement : la
 * commande répond « aucune mise à jour », et l'interface n'affiche rien. C'est
 * le comportement voulu, mais cela signifie que ce fichier ne peut être éprouvé
 * qu'installé — depuis le Store, ou par un MSIX posé à la main.
 *
 * # Le repli, et pourquoi il existe
 *
 * L'installation demande une interface générique dont l'identifiant est
 * CALCULÉ. Le calcul est validé à l'exécution par un `QueryInterface` ; s'il
 * échouait — ou si n'importe quelle étape échouait — l'appelant ouvre la page
 * de mises à jour du Store. L'utilisateur obtient sa mise à jour dans tous les
 * cas ; seule l'élégance du chemin change.
 */

import {
  activationFactory,
  awaitOperation,
  callForBoolean,
  callForInt32,
  callForPointer,
  callForUint32,
  callWithHandle,
  callWithPointer,
  queryInterface,
  release,
  vectorGetAt,
  type ComPtr,
} from "./winrt/com";
import { IID, IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE, parameterizedIid } from "./winrt/guid";

const CLASSE = "Windows.Services.Store.StoreContext";

/* Fentes de vtable, relevées dans les en-têtes du SDK Windows — jamais devinées. */
/** `IStoreContextStatics::GetDefault`. */
const SLOT_GET_DEFAULT = 6;
/** `IStoreContext::GetAppAndOptionalStorePackageUpdatesAsync`. */
const SLOT_GET_UPDATES = 23;
/** `IStoreContext::RequestDownloadAndInstallStorePackageUpdatesAsync`. */
const SLOT_INSTALL_UPDATES = 25;
/** `IStorePackageUpdate::get_Mandatory`. */
const SLOT_MANDATORY = 7;
/** `IStorePackageUpdateResult::get_OverallState`. */
const SLOT_OVERALL_STATE = 6;
/** `IVectorView<T>::get_Size`. */
const SLOT_SIZE = 7;
/** `IInitializeWithWindow::Initialize`. */
const SLOT_INITIALIZE = 6;
/** `IAsyncOperation<T>::GetResults`, puis celui de la variante à progression. */
const SLOT_RESULTS = 8;
const SLOT_RESULTS_WITH_PROGRESS = 10;

/** `StorePackageUpdateState::Completed`. */
const ETAT_TERMINE = 0;

/** La recherche est rapide ; l'installation passe par le Store et l'utilisateur. */
const DELAI_RECHERCHE_MS = 30_000;
const DELAI_INSTALLATION_MS = 30 * 60_000;

export interface MsixUpdateInfo {
  /**
   * Toujours vide, et volontairement.
   *
   * `StorePackageUpdate.Package` désigne le paquet INSTALLÉ, pas la mise à
   * jour : en rendre la version afficherait la version courante comme si
   * c'était la nouvelle. La page lit la vraie dans le manifeste du dépôt — le
   * commentaire de `checkMsixUpdate` (`lib/updateCheckers.ts`) dit exactement
   * cela, et c'est déjà le contrat côté Tauri.
   */
  version: string;
  mandatory: boolean;
}

/** Le `StoreContext` par défaut, ou `null` hors paquet installé. */
function storeContext(): ComPtr | null {
  const factory = activationFactory(CLASSE, IID.storeContextStatics);
  if (factory === null) return null;
  try {
    return callForPointer(factory, SLOT_GET_DEFAULT);
  } finally {
    release(factory);
  }
}

/** Les mises à jour en attente. À libérer par l'appelant. */
async function pendingUpdates(context: ComPtr): Promise<ComPtr | null> {
  const operation = callForPointer(context, SLOT_GET_UPDATES);
  if (operation === null) return null;
  try {
    return await awaitOperation(operation, SLOT_RESULTS, DELAI_RECHERCHE_MS);
  } finally {
    release(operation);
  }
}

/** Y a-t-il une mise à jour en attente pour ce paquet ? */
export async function checkMsixUpdate(): Promise<MsixUpdateInfo | null> {
  const context = storeContext();
  if (context === null) return null;
  try {
    const updates = await pendingUpdates(context);
    if (updates === null) return null;
    try {
      const taille = callForUint32(updates, SLOT_SIZE);
      if (taille === null || taille === 0) return null;

      const premiere = vectorGetAt(updates, 0);
      if (premiere === null) return { version: "", mandatory: false };
      try {
        return { version: "", mandatory: callForBoolean(premiere, SLOT_MANDATORY) ?? false };
      } finally {
        release(premiere);
      }
    } finally {
      release(updates);
    }
  } finally {
    release(context);
  }
}

/**
 * Lance le téléchargement et l'installation par le Store.
 *
 * Lève avec un code lisible en cas d'échec : la page l'affiche et n'enchaîne
 * PAS sur un redémarrage — sans ce contrôle, l'application se fermerait alors
 * que rien n'a été téléchargé.
 */
export async function downloadAndInstallMsixUpdate(hwnd: bigint): Promise<void> {
  const context = storeContext();
  if (context === null) throw new Error("store-unavailable");
  try {
    // Sans ce rattachement, la boîte de dialogue du Store n'a pas de fenêtre
    // propriétaire et l'appel rend immédiatement `OtherError`.
    const initializer = queryInterface(context, IID.initializeWithWindow);
    if (initializer !== null) {
      try {
        callWithHandle(initializer, SLOT_INITIALIZE, hwnd);
      } finally {
        release(initializer);
      }
    }

    const updates = await pendingUpdates(context);
    if (updates === null) throw new Error("no-update");
    try {
      // L'identifiant est CALCULÉ : c'est ce `QueryInterface` qui le valide.
      const iid = parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE);
      const iterable = queryInterface(updates, iid);
      if (iterable === null) throw new Error("iterable-unavailable");
      try {
        await lancerInstallation(context, iterable);
      } finally {
        release(iterable);
      }
    } finally {
      release(updates);
    }
  } finally {
    release(context);
  }
}

async function lancerInstallation(context: ComPtr, iterable: ComPtr): Promise<void> {
  const operation = callWithPointer(context, SLOT_INSTALL_UPDATES, iterable);
  if (operation === null) throw new Error("install-refused");
  try {
    const resultat = await awaitOperation(
      operation,
      SLOT_RESULTS_WITH_PROGRESS,
      DELAI_INSTALLATION_MS,
    );
    if (resultat === null) throw new Error("install-failed");
    try {
      const etat = callForInt32(resultat, SLOT_OVERALL_STATE);
      // `GetResults` peut réussir alors que l'installation a échoué : refus de
      // l'utilisateur, réseau, batterie faible.
      if (etat !== ETAT_TERMINE) throw new Error(`install-state-${String(etat)}`);
    } finally {
      release(resultat);
    }
  } finally {
    release(operation);
  }
}
