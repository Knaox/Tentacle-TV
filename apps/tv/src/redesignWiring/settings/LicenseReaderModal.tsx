import { useMemo } from "react";
import { settingsLicenseBlockKey } from "@tentacle-tv/tv-core";
import { withMenuIntent } from "../../platform/input";
import { useChoiceEntry } from "../../platform/tvos/panels/useChoiceEntry";
import { FadingModal } from "../../redesign/motion/FadingModal";
import { LicenseReader } from "../../redesign/screens/settings/LicenseReader";
import type { LicenseReaderModel } from "../../redesign/screens/settings/settingsTypes";
import { useBackLayer } from "../back/BackScope";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";

/**
 * Le lecteur d'un document de licence, dans une `Modal`, comme la liste de
 * choix (`ChoiceModal`) : le focus ne peut pas en sortir, il s'ouvre sur le
 * premier bloc (`useChoiceEntry`), et Retour / Menu le referment — le focus
 * retrouve la ligne qui l'avait ouvert.
 */
export function LicenseReaderModal({ reader, focus, onClose }: {
  reader: LicenseReaderModel | null;
  focus: FocusStore;
  onClose: () => void;
}) {
  const keys = useMemo(() => (reader ? reader.blocks.map((_, index) => settingsLicenseBlockKey(index)) : []), [reader]);
  const releases = useChoiceEntry(focus, keys, reader ? keys[0] ?? null : null);
  // Une nouvelle identité à la libération : le lecteur relit ses liaisons.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (reader ? { ...reader } : null), [reader, releases]);
  useBackLayer("menu", reader !== null, onClose);
  return (
    <FadingModal value={shown} onRequestClose={withMenuIntent(onClose)}>
      {(model) => <LicenseReader reader={model} />}
    </FadingModal>
  );
}
