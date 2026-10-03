import { Clipboard, LogBox } from "react-native";

// React Native garde son presse-papiers natif (iOS `RCTClipboard`, Android
// `ClipboardModule`) mais annonce son départ à la première lecture, en
// développement seulement. Aucune dépendance native de plus pour copier une
// ligne de détails : l'avertissement est tu ici, au seul endroit qui l'emploie.
LogBox.ignoreLogs(["Clipboard has been extracted"]);

/** Copie un texte ; faux si le module natif manque (rien ne doit casser pour autant). */
export function copyToClipboard(text: string): boolean {
  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
}
