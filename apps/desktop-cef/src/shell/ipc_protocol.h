#pragma once
// Noms des messages CefProcessMessage entre le processus navigateur (B) et le rendu (R).
// Partagé par les deux côtés ; les charges utiles JSON voyagent en chaînes (JSON.stringify
// côté page, nlohmann::json côté natif) : une seule sérialisation, aucune conversion V8.

namespace tentacle::ipc::proto {

// R → B : [id:int, channel:string, payload:json-string]
inline constexpr char kInvoke[] = "tentacle.invoke";
// B → R : [id:int, ok:bool, result:json-string, code:string, message:string]
inline constexpr char kReply[] = "tentacle.reply";
// B → R : [event:string, payload:json-string]
inline constexpr char kEvent[] = "tentacle.event";
// extra_info de CreateBrowser : liste des scripts injectés (string), dans l'ordre.
inline constexpr char kExtraScripts[] = "tentacle.scripts";

}  // namespace tentacle::ipc::proto
