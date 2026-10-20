import { useTranslation } from "react-i18next";
import { useFamilyLibraries, useSetFamilyLibraries } from "@tentacle-tv/api-client";
import { parentalLibraryRows, toggleParentalLibrary, type FamilyProfileDto } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";

/**
 * Les bibliothèques autorisées d'un profil — la règle de la TV, partagée
 * (`familyParentalLibraries`) : une case par bibliothèque de son plafond, tout
 * coché = toutes (celles d'après comprises), la dernière ne se décoche pas.
 * C'est Jellyfin qui applique, aussitôt, sur tous les appareils du profil.
 */
export function LibrariesSection({ profile }: { profile: FamilyProfileDto }) {
  const { t } = useTranslation("parentalTv");
  const { errorText } = useFamilyText();
  const libraries = useFamilyLibraries(profile.userId);
  const save = useSetFamilyLibraries();
  const data = libraries.data;
  if (!data) return null;
  if (data.available.length === 0) return <SettingsSection title={t("libraries.title")} caption={t("libraries.empty")}>{null}</SettingsSection>;
  // Le geste en vol fait foi le temps de la réponse.
  const allowed = save.isPending ? save.variables?.allowed ?? null : data.allowed;
  const rows = parentalLibraryRows(data.available, allowed);

  const toggle = (id: string) => {
    const next = toggleParentalLibrary(data.available, allowed, id);
    if (next.kind === "last") {
      showToast({ title: t("libraries.keepOne") });
      return;
    }
    save.mutate(
      { userId: profile.userId, allowed: next.allowed },
      { onSuccess: () => showToast({ title: t("saved"), tone: "success" }), onError: (e) => showToast({ title: errorText(e) }) },
    );
  };

  return (
    <SettingsSection title={t("libraries.title")}>
      {rows.map((row, index) => (
        <SettingsRow
          key={row.id}
          icon="folder"
          label={row.name}
          checked={row.checked}
          disabled={save.isPending}
          last={index === rows.length - 1}
          onPress={() => toggle(row.id)}
          accessibilityLabel={`${row.name} — ${row.checked ? t("libraries.allowed") : t("libraries.hidden")}`}
        />
      ))}
    </SettingsSection>
  );
}
