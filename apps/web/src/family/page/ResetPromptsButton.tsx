import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { useResetFamilyPrompts } from "@tentacle-tv/api-client";
import type { FamilyProfileDto, PromptsResetOffer } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyText } from "../useFamilyText";
import { SMALL_BUTTON } from "./familyUi";

interface ResetPromptsButtonProps {
  profile: FamilyProfileDto;
  /** Ce qui sera reproposé (`promptsResetOffer`, shared) : le libellé en dépend. */
  offer: PromptsResetOffer;
}

/**
 * « Reproposer le code PIN et la photo » (serveur 1.30.0, `family.promptsReset`) :
 * le premier passage de ce profil revient à sa prochaine ouverture, sur
 * n'importe quelle TV et sur le bureau, pour ce qui manque toujours. Rien ne
 * change à l'écran : le geste est dit par un message.
 */
export const ResetPromptsButton = memo(function ResetPromptsButton({ profile, offer }: ResetPromptsButtonProps) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const { mutate, isPending } = useResetFamilyPrompts();
  const label = t(offer === "photo" ? "prompts.resetPhoto" : "prompts.reset");

  const onClick = useCallback(() => {
    mutate(profile.userId, {
      onSuccess: () => toast.show("success", t("prompts.done", { name: profile.name })),
      onError: (error: unknown) => toast.show("error", errorText(error)),
    });
  }, [mutate, profile.userId, profile.name, toast, t, errorText]);

  return (
    <button type="button" onClick={onClick} disabled={isPending} className={SMALL_BUTTON} aria-label={`${label} — ${profile.name}`}>
      <RotateCcw size={13} aria-hidden="true" />
      {label}
    </button>
  );
});
