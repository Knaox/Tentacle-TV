import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LICENSE_TEXT_TITLES, type LicenseTextId } from "@tentacle-tv/shared/licenses";
import { Modal } from "../ui/Modal";
import { ModalHeader } from "../ui/ModalHeader";

/**
 * Le texte complet d'une licence. Les textes (≈ 200 Ko) ne sont chargés qu'à
 * la première ouverture, depuis le bundle : aucun réseau.
 */
export const LicenseTextModal = memo(function LicenseTextModal({ id, onClose }: { id: LicenseTextId | null; onClose: () => void }) {
  const { t } = useTranslation("about");
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setText(null);
    void import("@tentacle-tv/shared/licenses/texts").then((m) => {
      if (alive) setText(m.LICENSE_TEXTS[id]);
    });
    return () => { alive = false; };
  }, [id]);

  return (
    <Modal open={id !== null} onClose={onClose} maxWidth={760} labelledBy="license-text-title">
      <ModalHeader title={id ? LICENSE_TEXT_TITLES[id] : ""} titleId="license-text-title" onClose={onClose} />
      <pre
        className="max-h-[70vh] overflow-auto whitespace-pre-wrap px-6 py-5 font-mono text-xs leading-relaxed text-content-secondary"
        aria-label={t("about:readLicense")}
      >
        {text ?? "…"}
      </pre>
    </Modal>
  );
});
