import { useMemo } from "react";
import { Modal } from "react-native";
import { ChoiceSheet } from "../../redesign/screens/settings/ChoiceSheet";
import type { ChoiceListModel } from "../../redesign/screens/settings/settingsTypes";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "./settingsFocus";

/**
 * La liste de choix d'un réglage, dans une `Modal` : sur tvOS elle a son
 * propre contrôleur, le focus ne peut pas en sortir, et Menu la referme
 * (`onRequestClose`) sans passer par l'écran — le focus retrouve alors la
 * tuile qui l'avait ouverte. La feuille garde son voile et son fondu ; elle
 * s'ouvre sur la valeur retenue (`useChoiceEntry`).
 */
export function ChoiceModal({ list, focus, onChoose, onClose }: {
  list: ChoiceListModel | null;
  /** Le magasin de focus de l'écran (le port passe la Modal). */
  focus: FocusStore;
  onChoose: (value: string) => void;
  onClose: () => void;
}) {
  const keys = useMemo(() => (list ? list.options.map((_, index) => `settings:choice:${index}`) : []), [list]);
  const selected = list ? Math.max(0, list.options.findIndex((option) => option.value === list.selected)) : -1;
  const releases = useChoiceEntry(focus, keys, list ? keys[selected] : null);
  // Une nouvelle identité à la libération : la feuille (mémoïsée) redessine
  // ses lignes, qui relisent leur liaison. `releases` n'est lu que pour ça.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (list ? { ...list } : null), [list, releases]);
  return (
    <Modal visible={shown !== null} transparent animationType="none" onRequestClose={onClose}>
      {shown ? <ChoiceSheet list={shown} onChoose={onChoose} /> : null}
    </Modal>
  );
}
