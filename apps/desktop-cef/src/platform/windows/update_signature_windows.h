#pragma once
// Windows : le contrôle d'éditeur d'une mise à jour (Authenticode) — pendant de checkSignature
// de macOS (update_bundle_mac.mm : même équipe que l'app en cours, comme Sparkle). Utilisé à la
// préparation (update_windows.cpp) et refait par l'assistant juste avant l'échange.

#include <string>

namespace tentacle::update::win {

// Le sujet X.500 du certificat qui signe `exe` si sa signature Authenticode est valide (chaîne
// de confiance du système, sans révocation en ligne), sinon "" ; `status` : le code de
// WinVerifyTrust (0 = valide).
std::wstring authenticodeSigner(const std::wstring& exe, long* status = nullptr);

// Si `current` est signé, `candidate` doit l'être aussi, validement, par le MÊME sujet. Une app
// en cours non signée (build de développement) n'exige rien de plus : le manifeste signé en
// ed25519 et l'empreinte de l'archive restent la garde. "" si accepté, sinon
// « signature:<code hexadécimal> » ou « signature-publisher ».
std::string checkPublisher(const std::wstring& current, const std::wstring& candidate);

}  // namespace tentacle::update::win
