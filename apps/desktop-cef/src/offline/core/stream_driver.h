#pragma once
// Le pilote de transfert du bureau : un flux HTTP lu bloc par bloc et écrit dans le `.part`
// à mesure — `node/streamDriver.ts`. Le réseau entre par `TransferNet` (CefURLRequest dans
// l'app, `glue/cef_transfer_net.cpp` ; un flux simulé dans les tests), le disque par `PartFile`.

#include <functional>
#include <memory>
#include <string>

#include "offline/core/transfer.h"

namespace tentacle::offline {

/// Ce qu'un flux ouvert rapporte, dans l'ordre : la réponse (une fois), des blocs, la fin.
/// Tous les rappels arrivent sur le fil hors ligne.
class StreamSink {
 public:
  virtual ~StreamSink() = default;
  virtual void onResponse(int status, HeaderFn header) = 0;
  virtual void onData(const uint8_t* data, size_t length) = 0;
  /// `ok` faux : coupé (réseau, ou notre annulation). Toujours appelé, une fois, en dernier.
  virtual void onComplete(bool ok) = 0;
};

/// Le réseau du transfert (`transferNet.ts`) : ouvrir un flux, arrêter un transcodage.
class TransferNet {
 public:
  virtual ~TransferNet() = default;
  /// Ouvre ; rend l'annulation (sûre à tout moment, `onComplete(false)` suit). Le `sink` vit
  /// jusqu'à `onComplete`.
  virtual std::function<void()> open(const std::string& url, const HeaderList& headers, std::shared_ptr<StreamSink> sink) = 0;
  /// DELETE best-effort (arrêt de transcodage, libération d'une préparation) : ne lève jamais.
  virtual void killTranscode(const std::string& url, const HeaderList& headers, std::function<void()> done) = 0;
};

class StreamDriver final : public TransferDriver {
 public:
  explicit StreamDriver(TransferNet& net) : net_(net) {}
  void download(TransferRequest request, std::function<void(TransferOutcome)> done) override;
  void stopTranscode(std::string url, HeaderList headers, std::function<void()> done) override {
    net_.killTranscode(url, headers, std::move(done));
  }

 private:
  TransferNet& net_;
};

}  // namespace tentacle::offline
