import Foundation
import Libavcodec
import Libavformat
import Libavutil

// Modified for Tentacle TV, 2026-10-01 (LGPL-2.1 §2a notice).
//
// Gives a decode timestamp to the video packets libavformat hands out without
// one at the start of a run — the session's first packets, and the first ones
// after every demand-driven re-anchor.
//
// After a seek libavformat's reorder buffer is empty: it cannot derive a DTS
// until it has seen `has_b_frames + 1` packets, so the first ones arrive with
// `dts == AV_NOPTS_VALUE` and movenc invents one from the PTS. Its guess
// assumes the pictures after a keyframe display AFTER it, which an open GOP
// breaks: a CRA keyframe is followed, in decode order, by leading (RASL)
// pictures that display BEFORE it. Measured on an x265 episode (Matroska,
// 1/1000 time base): CRA pts 84 675, then 84 633 and 84 592. movenc guessed
// 84 633 for the second packet, the demuxer's first real DTS was 84 592, and
// `av_interleaved_write_frame` refused it (-22, "non monotonically increasing
// dts"). That error ends the producer: nothing is produced again, and AVPlayer
// waits on the seek target for good — every seek outside the produced window
// of such a title, and every resume, stalled.
//
// libavformat's DTS advance one frame per packet, so the missing ones are the
// first real DTS minus one frame per held packet — what a sequential read of
// the same packets gives (84 508, 84 550, then 84 592 above).
final class DecodeTimestampRepair {

    /// More packets than any reorder depth libavformat tracks
    /// (`MAX_REORDER_DELAY` is 16). Past it, the held packets go out as they
    /// came and movenc guesses, as it did before this repair.
    static let maxHeldPackets = 16

    /// One frame, in the stream's time base — `nil` when the stream declares
    /// no frame rate (the first real packet's duration stands in then).
    private let frameTicks: Double?
    private var held: [UnsafeMutablePointer<AVPacket>] = []
    /// The run's first real DTS went by: everything after passes untouched.
    private var settled = false

    init(stream: UnsafeMutablePointer<AVStream>) {
        let average = stream.pointee.avg_frame_rate
        let rate = average.num > 0 && average.den > 0 ? average : stream.pointee.r_frame_rate
        let base = stream.pointee.time_base
        if rate.num > 0, rate.den > 0, base.num > 0, base.den > 0 {
            frameTicks = Double(rate.den) * Double(base.den) / (Double(rate.num) * Double(base.num))
        } else {
            frameTicks = nil
        }
    }

    deinit { discard() }

    /// A re-anchor starts a new run: the demuxer's reorder buffer went with the
    /// seek, and whatever is still held belonged to the abandoned fragment.
    func restart() {
        discard()
        settled = false
    }

    /// Hands `packet` to `write`, holding the first DTS-less packets of a run
    /// until the demuxer's first real DTS tells what theirs were.
    func submit(
        _ packet: UnsafeMutablePointer<AVPacket>,
        write: (UnsafeMutablePointer<AVPacket>) throws -> Void
    ) throws {
        if settled {
            try write(packet)
            return
        }
        if packet.pointee.dts == swift_AV_NOPTS_VALUE() {
            if held.count < Self.maxHeldPackets, let copy = av_packet_clone(packet) {
                held.append(copy)
                return
            }
            // No real DTS in sight: give up on this run, as before the repair.
            settled = true
            try flush(write: write)
            try write(packet)
            return
        }
        backfill(before: packet.pointee.dts, frameDuration: packet.pointee.duration)
        settled = true
        try flush(write: write)
        try write(packet)
    }

    /// Writes whatever is still held, as it is — before a cut, so the packets
    /// land in their own segment, and before the final one.
    func flush(write: (UnsafeMutablePointer<AVPacket>) throws -> Void) throws {
        let pending = held
        held = []
        for (index, packet) in pending.enumerated() {
            var owned: UnsafeMutablePointer<AVPacket>? = packet
            do {
                try write(packet)
            } catch {
                // The writer gave up: the rest are freed, not leaked.
                for rest in pending[(index + 1)...] {
                    var leftover: UnsafeMutablePointer<AVPacket>? = rest
                    av_packet_free(&leftover)
                }
                av_packet_free(&owned)
                throw error
            }
            av_packet_free(&owned)
        }
    }

    /// One frame back per held packet from `firstKnown`. All or nothing: a
    /// result that would put a DTS after its own PTS, or out of order, is not
    /// a decode order this repair understands — movenc keeps the guess.
    private func backfill(before firstKnown: Int64, frameDuration: Int64) {
        guard !held.isEmpty else { return }
        let step = frameTicks ?? (frameDuration > 0 ? Double(frameDuration) : 0)
        guard step > 0 else { return }
        var stamps: [Int64] = []
        var previous = Int64.min
        for (index, packet) in held.enumerated() {
            let dts = firstKnown - Int64((Double(held.count - index) * step).rounded())
            let pts = packet.pointee.pts
            guard dts > previous, dts < firstKnown,
                  pts == swift_AV_NOPTS_VALUE() || dts <= pts else { return }
            stamps.append(dts)
            previous = dts
        }
        for (packet, dts) in zip(held, stamps) {
            packet.pointee.dts = dts
        }
    }

    private func discard() {
        for packet in held {
            var owned: UnsafeMutablePointer<AVPacket>? = packet
            av_packet_free(&owned)
        }
        held = []
    }
}
