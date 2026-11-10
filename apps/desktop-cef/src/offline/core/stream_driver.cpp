// La boucle de `node/streamDriver.ts`, en évènements : réponse, blocs, fin.

#include "offline/core/stream_driver.h"

#include "offline/core/files.h"
#include "offline/core/part_file.h"

namespace tentacle::offline {
namespace {

class Transfer final : public StreamSink, public std::enable_shared_from_this<Transfer> {
 public:
  Transfer(TransferRequest request, std::function<void(TransferOutcome)> done)
      : request_(std::move(request)), done_(std::move(done)), total_(request_.resumeFrom) {}

  void start(TransferNet& net) {
    HeaderList headers = request_.headers;
    if (request_.resumeFrom > 0) headers.emplace_back("Range", "bytes=" + std::to_string(request_.resumeFrom) + "-");
    // Un flux figé (serveur muet) ne rend plus la main au prochain bloc : la bascule coupe la
    // lecture elle-même.
    auto weak = weak_from_this();
    unsubscribe_ = request_.signal->subscribe([weak] {
      if (auto self = weak.lock()) {
        if (self->request_.signal->cancel() || self->request_.signal->pause()) self->abort();
      }
    });
    abort_ = net.open(request_.url, headers, shared_from_this());
  }

  void onResponse(int status, HeaderFn header) override {
    if (finished_) return;
    responded_ = true;
    if (request_.onHeaders) request_.onHeaders(status, header);
    // Une erreur HTTP : rien n'est écrit, la politique décide du code.
    if (status >= 400) {
      finish({TransferOutcome::Kind::Done, status, header, "", 0});
      abort();
      return;
    }
    status_ = status;
    header_ = header;
    // 200 alors qu'on demandait une reprise : le serveur a ignoré la plage, on repart de zéro.
    PartFile::Mode mode = total_ > 0 ? PartFile::Mode::Reuse : PartFile::Mode::Truncate;
    if (status == 200 && total_ > 0) {
      total_ = 0;
      mode = PartFile::Mode::Truncate;
    }
    // Le total, dès les en-têtes : sans lui, une barre restait vide jusqu'au bout.
    if (const auto announced = announcedTotal(status, header, total_); announced && request_.onTotal) {
      request_.onTotal(*announced);
    }
    try {
      part_ = PartFile::open(request_.partPath, mode);
    } catch (...) {
      finish({TransferOutcome::Kind::Failed, 0, {}, "io", total_});
      abort();
    }
  }

  void onData(const uint8_t* data, size_t length) override {
    if (finished_ || !part_) return;
    if (request_.signal->cancel()) {
      closeQuietly();
      discard();
      finish({TransferOutcome::Kind::Canceled});
      abort();
      return;
    }
    if (request_.signal->pause()) {
      closeQuietly();
      finish({TransferOutcome::Kind::Paused, 0, {}, "", total_});
      abort();
      return;
    }
    try {
      part_->write(data, length, total_);
    } catch (const std::exception& error) {
      closeQuietly();
      const std::string cause = files::classify(error) == files::ErrorKind::DiskFull ? "disk-full" : "io";
      finish({TransferOutcome::Kind::Failed, 0, {}, cause, total_});
      abort();
      return;
    }
    total_ += static_cast<int64_t>(length);
    if (request_.onBytes) request_.onBytes(total_);
  }

  void onComplete(bool ok) override {
    if (unsubscribe_) std::exchange(unsubscribe_, {})();
    // Le flux est fini : l'annulation (qui tient le flux, qui nous tient) est oubliée — sans
    // quoi le transfert et son flux se garderaient l'un l'autre en vie.
    abort_ = nullptr;
    if (finished_) return;
    if (!responded_) {  // jamais ouvert : le réseau
      finish({TransferOutcome::Kind::Failed, 0, {}, "network", request_.resumeFrom});
      return;
    }
    if (!ok) {
      closeQuietly();
      // La lecture a été coupée par NOTRE bascule, ou par le réseau.
      if (request_.signal->cancel()) {
        discard();
        finish({TransferOutcome::Kind::Canceled});
      } else if (request_.signal->pause()) {
        finish({TransferOutcome::Kind::Paused, 0, {}, "", total_});
      } else {
        finish({TransferOutcome::Kind::Failed, 0, {}, "network", total_});  // pause SYSTÈME
      }
      return;
    }
    try {
      if (part_) part_->sync();
    } catch (...) {
      closeQuietly();
      finish({TransferOutcome::Kind::Failed, 0, {}, "io", total_});
      return;
    }
    closeQuietly();
    finish({TransferOutcome::Kind::Done, status_, header_, "", total_});
  }

 private:
  void abort() {
    if (abort_) std::exchange(abort_, {})();
  }
  void closeQuietly() {
    if (!part_) return;
    try {
      part_->sync();
    } catch (...) {
    }
    part_->close();
    part_.reset();
  }
  void discard() {
    try {
      files::remove(request_.partPath);
    } catch (...) {
      // Un `.part` qui reste sera jeté au prochain passage.
    }
  }
  void finish(TransferOutcome outcome) {
    if (finished_) return;
    finished_ = true;
    if (unsubscribe_) std::exchange(unsubscribe_, {})();
    if (auto done = std::exchange(done_, {})) done(std::move(outcome));
  }

  TransferRequest request_;
  std::function<void(TransferOutcome)> done_;
  std::function<void()> abort_;
  std::function<void()> unsubscribe_;
  std::unique_ptr<PartFile> part_;
  int64_t total_;
  int status_ = 0;
  HeaderFn header_;
  bool responded_ = false;
  bool finished_ = false;
};

}  // namespace

void StreamDriver::download(TransferRequest request, std::function<void(TransferOutcome)> done) {
  auto transfer = std::make_shared<Transfer>(std::move(request), std::move(done));
  transfer->start(net_);
}

}  // namespace tentacle::offline
