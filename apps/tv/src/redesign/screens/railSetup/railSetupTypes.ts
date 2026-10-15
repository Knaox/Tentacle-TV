import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { IconName } from "../../icons/Icon";

/**
 * Le contrat de la préconfiguration de la barre : ce que l'intégration résout
 * avant de monter la vue. Les libellés FIXES sont traduits par la vue ; les
 * noms (bibliothèques, profils) arrivent résolus.
 */

/** Une bibliothèque de la liste, à sa case dans l'ordre EN COURS. */
export interface RailSetupLibrary {
  key: string;
  label: string;
  icon: IconName;
  /** Épinglée : elle paraît dans la barre. */
  pinned: boolean;
}

/** Une entrée de l'aperçu : la barre telle qu'elle sera (Rechercher, Accueil, puis ce qui est affiché). */
export interface RailPreviewEntry {
  key: string;
  label: string;
  icon: IconName;
}

/** Un autre profil de la famille sur cette TV, que le propriétaire peut cocher. */
export interface RailSetupTarget {
  userId: string;
  name: string;
  color: FamilyProfileColor | null;
  avatarUri?: string;
  /** Il a déjà sa barre sur cette TV : appliquer la remplace. */
  setupDone: boolean;
  selected: boolean;
}

export type RailSetupModel =
  /** Le socle ne sait pas encore : rien ne paraît (ni la page, ni l'accueil). */
  | { kind: "waiting" }
  | {
      kind: "libraries";
      /** Le prénom du profil ouvert (« La barre de Léa ») ; null sans famille. */
      profileName: string | null;
      libraries: RailSetupLibrary[];
      /** La bibliothèque soulevée, ou null. */
      movingKey: string | null;
      preview: RailPreviewEntry[];
    }
  | {
      kind: "apply";
      /** `setup` : après « Continuer » (« Non merci ») ; `settings` : depuis Réglages › Navigation (« Annuler »). */
      origin: "setup" | "settings";
      targets: RailSetupTarget[];
      /** Le geste part (les dispositions s'écrivent) : les cibles se taisent. */
      busy: boolean;
    };

export interface RailSetupViewProps {
  model: RailSetupModel;
  onTogglePin?: (key: string) => void;
  /** OK sur « Déplacer » : soulève la bibliothèque, ou pose celle qui l'est. */
  onMove?: (key: string) => void;
  onContinue?: () => void;
  onSkip?: () => void;
  onToggleTarget?: (userId: string) => void;
  onApply?: () => void;
  onDecline?: () => void;
}
