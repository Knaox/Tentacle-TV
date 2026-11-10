// Contrôle d'éditeur Authenticode (voir update_signature_windows.h). ⚠️ Écrit et compilé à
// blanc depuis macOS, jamais exécuté : à éprouver avec un vrai paquet signé (lot de livraison).
#include "platform/windows/update_signature_windows.h"

#include <windows.h>
#include <softpub.h>
#include <wincrypt.h>
#include <wintrust.h>

#include <cstdio>

namespace tentacle::update::win {

std::wstring authenticodeSigner(const std::wstring& exe, long* status) {
  WINTRUST_FILE_INFO file{};
  file.cbStruct = sizeof file;
  file.pcwszFilePath = exe.c_str();
  WINTRUST_DATA data{};
  data.cbStruct = sizeof data;
  data.dwUIChoice = WTD_UI_NONE;
  // Pas de révocation en ligne : une mise à jour ne doit pas pendre sur un serveur de CRL ; la
  // chaîne jusqu'à une racine de confiance du système reste exigée.
  data.fdwRevocationChecks = WTD_REVOKE_NONE;
  data.dwProvFlags = WTD_CACHE_ONLY_URL_RETRIEVAL;
  data.dwUnionChoice = WTD_CHOICE_FILE;
  data.pFile = &file;
  data.dwStateAction = WTD_STATEACTION_VERIFY;
  GUID action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  const HWND noUi = static_cast<HWND>(INVALID_HANDLE_VALUE);
  const LONG st = WinVerifyTrust(noUi, &action, &data);
  std::wstring subject;
  if (st == ERROR_SUCCESS) {
    CRYPT_PROVIDER_DATA* prov = WTHelperProvDataFromStateData(data.hWVTStateData);
    CRYPT_PROVIDER_SGNR* signer = prov ? WTHelperGetProvSignerFromChain(prov, 0, FALSE, 0) : nullptr;
    if (signer && signer->csCertChain > 0 && signer->pasCertChain && signer->pasCertChain[0].pCert) {
      CERT_NAME_BLOB* name = &signer->pasCertChain[0].pCert->pCertInfo->Subject;
      const DWORD n = CertNameToStrW(X509_ASN_ENCODING, name, CERT_X500_NAME_STR, nullptr, 0);
      if (n > 1) {
        subject.resize(n);
        CertNameToStrW(X509_ASN_ENCODING, name, CERT_X500_NAME_STR, subject.data(), n);
        subject.resize(n - 1);  // le zéro final
      }
    }
  }
  data.dwStateAction = WTD_STATEACTION_CLOSE;
  WinVerifyTrust(noUi, &action, &data);
  if (status) *status = st;
  return subject;
}

std::string checkPublisher(const std::wstring& current, const std::wstring& candidate) {
  long st = 0;
  const std::wstring mine = authenticodeSigner(current, &st);
  if (mine.empty()) {
    std::fprintf(stderr, "[maj] app en cours non signée (0x%08lx) : contrôle d'éditeur sauté\n",
                 static_cast<unsigned long>(st));
    return {};
  }
  const std::wstring theirs = authenticodeSigner(candidate, &st);
  if (theirs.empty()) {
    char code[16];
    std::snprintf(code, sizeof code, "%08lx", static_cast<unsigned long>(st));
    return std::string("signature:") + code;
  }
  return theirs == mine ? std::string() : std::string("signature-publisher");
}

}  // namespace tentacle::update::win
