import Foundation
import PrismCore

/// Table d'erreurs du pont : une session refusée se traduit en un CODE lisible
/// dans les journaux JS (`plog("prism", …)`). Le JS n'a qu'un comportement —
/// le repli PlaybackInfo serveur — sauf `masterRejectedByPlayer`, qui rejoue
/// d'abord la forme muxée. Un code par cas plutôt qu'un fourre-tout : c'est ce
/// qui permettra de décider plus tard si un cas mérite un traitement propre.
enum PrismErrorCode {
    static func of(_ error: Error) -> String {
        if let own = error as? PrismBridgeError {
            switch own {
            case .superseded: return "superseded"
            }
        }
        switch PrismCoreError.classify(error) {
        case .originRefused: return "originRefused"
        case .originRateLimited: return "originRateLimited"
        case .originUnreachable: return "originUnreachable"
        case .noVideoStream: return "noVideoStream"
        case .videoCodecNotRemuxable: return "videoCodecNotRemuxable"
        case .videoCodecUnplayable: return "videoCodecUnplayable"
        case .startupBudgetExpired: return "startupBudgetExpired"
        case .masterRejectedByPlayer: return "masterRejectedByPlayer"
        case .workDirectoryOutOfSpace: return "workDirectoryOutOfSpace"
        case .ffmpeg: return "ffmpeg"
        case .unknown: return "unknown"
        }
    }
}
