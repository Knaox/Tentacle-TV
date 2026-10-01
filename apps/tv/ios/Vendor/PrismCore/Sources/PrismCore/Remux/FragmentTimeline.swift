import Foundation
import Libavcodec
import Libavformat
import Libavutil

// Modified for Tentacle TV, 2026-10-01 (LGPL-2.1 §2a notice).
//
// Keeps every fragment of a session on ONE media timeline per track, whichever
// muxer wrote it.
//
// movenc places a fragment at `tfdt = dts − start_dts`. The session's first
// muxer takes `start_dts` from its first packet, and the init segment it mints
// carries the matching edit list: a video that starts two frames into its
// composition offset gets `media_time = 83 ms`, an Opus track that starts at
// 153 ms gets a 138 ms empty edit. That init is the one AVPlayer keeps (the
// variant's is first-write-wins, and a rendition's is cached the moment it is
// fetched). A re-anchored muxer, though, is opened with `frag_discont`, which
// makes movenc take `start_dts = dts − pts` of ITS first packet instead: its
// fragments sit `start_dts` away from where the first muxer would have put
// them, and the served edit list no longer cancels it. Measured on an x265
// episode with an Opus track: after every seek the audio played 138 ms late,
// and the video another 0 to 84 ms late depending on the anchor keyframe's
// composition offset (a CRA followed by leading pictures has a larger one).
//
// So a replacing writer inherits the origins and re-bases its packets on them
// (`dts − origin`), with `use_editlist` off: movenc then takes `start_dts = 0`
// and `tfdt` is exactly what the first muxer would have written.
struct FragmentTimeline {
    /// Output stream index → the DTS (output time base) the session's media
    /// timeline starts at.
    typealias Origins = [Int32: Int64]

    /// What this writer inherited; `nil` when it starts the timeline itself.
    let inherited: Origins?
    /// Whether movenc runs this writer under `frag_discont` (a re-anchor).
    let restart: Bool
    /// Inherited origins cover every stream of this writer: it re-bases.
    let rebases: Bool
    private var firstDTS: Origins = [:]
    private var firstPTS: Origins = [:]

    init(inherited: Origins?, restart: Bool, streamCount: Int) {
        self.inherited = inherited
        self.restart = restart
        rebases = restart && streamCount > 0 && (0..<streamCount).allSatisfy { inherited?[Int32($0)] != nil }
    }

    /// Before muxing: re-bases the packet when inheriting, records the first
    /// one otherwise. `false` for a packet that would land before the
    /// timeline's origin — movenc writes `tfdt` unsigned, so it is dropped.
    mutating func place(_ packet: UnsafeMutablePointer<AVPacket>, stream: Int32) -> Bool {
        let none = swift_AV_NOPTS_VALUE()
        if rebases, let origin = inherited?[stream] {
            if packet.pointee.dts != none { packet.pointee.dts -= origin }
            if packet.pointee.pts != none { packet.pointee.pts -= origin }
            let decode = packet.pointee.dts != none ? packet.pointee.dts : packet.pointee.pts
            return decode == none || decode >= 0
        }
        if firstDTS[stream] == nil, packet.pointee.dts != none {
            firstDTS[stream] = packet.pointee.dts
            firstPTS[stream] = packet.pointee.pts
        }
        return true
    }

    /// The origins the next writer inherits: the ones this writer was given,
    /// else the `start_dts` movenc took for each stream it wrote.
    var origins: Origins {
        var result = inherited ?? [:]
        for (stream, dts) in firstDTS where result[stream] == nil {
            guard restart else { result[stream] = dts; continue }
            // `frag_discont` + edit list: movenc took `dts − pts`.
            if let pts = firstPTS[stream], pts != swift_AV_NOPTS_VALUE() { result[stream] = dts - pts }
        }
        return result
    }
}
