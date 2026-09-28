import { Redirect } from "expo-router";

/**
 * Ancien onglet « Affiner » : la pile vit désormais dans l'onglet Pour vous.
 * Le lien profond `tentacle://swipe` reste valable — il y mène, section Affiner.
 */
export default function SwipeRedirect() {
  return <Redirect href={{ pathname: "/for-you", params: { section: "refine" } }} />;
}
