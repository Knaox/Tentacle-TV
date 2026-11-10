#pragma once
// `tentacle://plugin/<id>` — le document d'un greffon déposé par `plugin_document_set`
// (net/plugin_documents.h), servi sous son origine avec SA politique (`buildPluginCsp`) :
// 200 `text/html; charset=utf-8`, ou 404 « greffon inconnu » (`appProtocol.ts`).

namespace tentacle::schemes {

/// Processus principal, après CefInitialize.
void registerPluginScheme();

}  // namespace tentacle::schemes
