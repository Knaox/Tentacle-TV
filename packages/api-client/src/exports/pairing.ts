// Device pairing (local/backend)
export {
  useGeneratePairingCode, usePairingStatus, useClaimPairingCode, usePairedDevices, useRevokePairedDevice, useGenerateTvToken,
  useMyPairedDevices, useRevokeMyDevice, useDevicePairGenerate, useDevicePairStatus, useDevicePairConfirm,
  setPairingBackendUrl, setPairingToken, type PairingCodeResponse, type PairingStatusResponse, type ClaimResponse,
  type PairedDevice, type TvTokenResponse, type DevicePairGenerateResponse, type DevicePairStatusResponse,
} from "../hooks/usePairing";
export {
  useAutoSubmitPairingCode, shouldAutoSubmitPairingCode, PAIRING_CODE_LENGTH, type PairingEntryStatus,
} from "../hooks/usePairingAutoSubmit";

// Device pairing (relay)
export {
  useRelayGenerate, useRelayStatus, useRelayConfirm,
  type RelayGenerateResponse, type RelayStatusResponse, type RelayConfirmPayload,
} from "../hooks/useRelayPairing";
