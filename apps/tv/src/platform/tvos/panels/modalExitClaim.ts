import type { FocusStore } from "../focus/focusStore";

/**
 * Une Modal vient de se retirer et le focus doit aller à `key`. Apple TV :
 * rien ici — UIKit rend le focus en l'ANNONÇANT, et l'appelant réclame alors
 * (`railMenuReturnOnFocus`). Android TV a sa variante
 * (`modalExitClaim.android.ts`).
 */
export function claimAfterModalExit(_focus: FocusStore, _key: string | null): void {}
