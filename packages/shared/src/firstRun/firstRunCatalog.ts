import type { ServerCapability } from "../serverCapabilities/serverCapabilities";

/**
 * Le CATALOGUE du premier lancement hors TV — mobile, iPad, web étroit : ce
 * que chaque client REND, dans cet ordre, d'après les mêmes données (décision
 * de Damien, 20/10 : la structure est un catalogue pur, partagé). Rien n'y est
 * dessiné ; les clés i18n vivent dans l'espace `familyMobile` (`launch`,
 * `firstRun`) et `profilePicker`. Testé : `firstRunCatalog.test.ts`.
 *
 * 1. La PORTE « Qui regarde ? » (`whoIsWatching`) : plein écran, seulement si
 *    le serveur ouvre les sessions de profil à la plateforme (capacité), la
 *    famille compte au moins deux profils et aucun choix retenu ne vaut
 *    (shared `mobileProfileLaunch`). Son code PIN est vérifié par le serveur
 *    sur la même page. Jamais « Gérer les profils » sur cette page.
 * 2. Les ÉTAPES du premier lancement du profil, l'ordre de la TV (tv-core
 *    `nav/startupWindows` : code, barre, photo — le mobile n'a pas de barre :
 *    les rangées de l'accueil) : chacune due ou non (`firstRunPlan`), une seule
 *    surface à la fois (`firstRunFlow`), une fois par profil et par appareil
 *    (`FIRST_RUN_SEEN_KEY`), rouvertes par « Reproposer » du serveur
 *    (`honorFirstRunPromptsReset`).
 */

/** Les étapes, dans leur ordre. */
export const FIRST_RUN_STEP_IDS = ["pinSetup", "homeRows", "photoSetup"] as const;
export type FirstRunStep = (typeof FIRST_RUN_STEP_IDS)[number];

/** La feuille qu'une étape ouvre par son action principale (rendue par le client). */
export type FirstRunSheet = "ownPin" | "avatarGallery" | null;

export interface FirstRunStepDescriptor {
  id: FirstRunStep;
  /** Le signe de l'étape (nom d'icône Feather / Lucide équivalent). */
  icon: "lock" | "layout" | "smile";
  titleKey: string;
  bodyKey: string;
  /** L'action principale ; `homeRows` : « Continuer » ou, en dernière étape, « Terminer ». */
  primaryKey: string;
  /** « Passer » est offert (l'accueil n'en a pas : « Continuer » ne change rien de force). */
  skippable: boolean;
  sheet: FirstRunSheet;
  /** Le contenu dans la page (l'éditeur des rangées), sinon rien. */
  inline: "homeRowsEditor" | null;
  /** Qui la rend due — la règle (`firstRunPlan`) reçoit ces faits, l'adaptateur les lit. */
  dueWhen: string;
}

export const FIRST_RUN_STEPS: readonly FirstRunStepDescriptor[] = [
  {
    id: "pinSetup",
    icon: "lock",
    titleKey: "familyMobile:firstRun.pinTitle",
    bodyKey: "familyMobile:firstRun.pinBody",
    primaryKey: "familyMobile:firstRun.pinSet",
    skippable: true,
    sheet: "ownPin",
    inline: null,
    // Session PERSONNELLE seulement (`setOwnPin`), règle partagée `familyPinReminder` (startup).
    dueWhen: "familyPinReminder.startup",
  },
  {
    id: "homeRows",
    icon: "layout",
    titleKey: "familyMobile:firstRun.homeTitle",
    bodyKey: "familyMobile:firstRun.homeBody",
    primaryKey: "familyMobile:firstRun.next",
    skippable: false,
    sheet: null,
    inline: "homeRowsEditor",
    // La préférence d'accueil du COMPTE a répondu (`/api/preferences/home-layout`) et les bibliothèques.
    dueWhen: "homeLayout.readable",
  },
  {
    id: "photoSetup",
    icon: "smile",
    titleKey: "familyMobile:firstRun.photoTitle",
    bodyKey: "familyMobile:firstRun.photoBody",
    primaryKey: "familyMobile:firstRun.photoChoose",
    skippable: true,
    sheet: "avatarGallery",
    inline: null,
    // Règle partagée `shouldInviteToAvatars` (sujet sans photo, en ligne, pas encore invité ici).
    dueWhen: "avatarInvite",
  },
];

export const FIRST_RUN_SKIP_KEY = "familyMobile:firstRun.skip";
export const FIRST_RUN_FINISH_KEY = "familyMobile:firstRun.finish";
export const FIRST_RUN_PROGRESS_KEY = "familyMobile:firstRun.step";

export function firstRunStepOf(id: FirstRunStep): FirstRunStepDescriptor {
  return FIRST_RUN_STEPS.find((step) => step.id === id)!;
}

/** L'action principale d'une étape à sa place : l'accueil en dernière étape « Termine ». */
export function firstRunPrimaryKey(id: FirstRunStep, last: boolean): string {
  return id === "homeRows" && last ? FIRST_RUN_FINISH_KEY : firstRunStepOf(id).primaryKey;
}

/** La porte « Qui regarde ? », par plateforme : la capacité qui l'ouvre. */
export const WHO_IS_WATCHING_GATE: Readonly<Record<"mobile", { capability: ServerCapability; titleKey: string; captionKey: string }>> = {
  mobile: { capability: "family.mobileProfiles", titleKey: "profilePicker:whoIsWatching", captionKey: "familyMobile:launch.caption" },
};
