/**
 * Le pavé du code PIN — la règle vit dans shared (`family/familyPinEntry.ts`),
 * commune à la TV et au bureau ; ré-exportée ici pour les importeurs de tv-core.
 */
export {
  PIN_DIGITS,
  PIN_ENTRY_START,
  erasePinDigit,
  pinEntryFor,
  pinLockLapsed,
  pinLockRemainingMs,
  pinRefused,
  pressPinDigit,
  type PinDigit,
  type PinEntry,
  type PinPhase,
} from "@tentacle-tv/shared";
