import { useMemo } from "react";
import { FadingModal } from "../../redesign/motion/FadingModal";
import { ChoiceSheet } from "../../redesign/screens/settings/ChoiceSheet";
import type { ChoiceListModel } from "../../redesign/screens/settings/settingsTypes";
import { useBackLayer } from "../back/BackScope";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "./settingsFocus";

/**
 * La liste de choix d'un réglage, dans une `Modal` : sur tvOS elle a son
 * propre contrôleur, le focus ne peut pas en sortir, et Menu la referme
 * (`onRequestClose`, sa couche « menu » du Retour) — le focus retrouve alors
 * la tuile qui l'avait ouverte. La feuille garde son voile et son fondu
 * d'entrée, s'efface d'un seul fondu avant que la Modal ne se retire
 * (`FadingModal`), et s'ouvre sur la valeur retenue (`useChoiceEntry`).
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
  useBackLayer("menu", list !== null, onClose);
  return (
    <FadingModal value={shown} onRequestClose={onClose}>
      {(list, leaving) => <ChoiceSheet list={list} onChoose={leaving ? undefined : onChoose} />}
    </FadingModal>
  );
}
