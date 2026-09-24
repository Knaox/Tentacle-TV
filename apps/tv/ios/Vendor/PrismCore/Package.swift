// swift-tools-version: 6.0
// Copie de PrismCore 3.2.2 modifiée pour Tentacle TV (2026-09-24) : seules la
// bibliothèque et ses sources sont reprises — tests et fuzzer restent en amont.
// Voir ../README.md.
import PackageDescription

let package = Package(
    name: "PrismCore",
    platforms: [
        // Matches Aether's floors.
        .iOS(.v16),
        .tvOS(.v17),
        .macOS(.v14),
        .visionOS(.v1),
    ],
    products: [
        .library(name: "PrismCore", targets: ["PrismCore"]),
    ],
    dependencies: [
        // FFmpeg (LGPL) as prebuilt xcframeworks — the same package Aether
        // already ships for the Prism (libmpv) engine, so integrating apps add
        // ZERO new binary dependencies. Aether overrides this with its local
        // Vendor/MPVKitLocal fork (same package identity) at integration time.
        .package(url: "https://github.com/mpvkit/MPVKit.git", .upToNextMinor(from: "1.0.0")),
    ],
    targets: [
        .target(
            name: "PrismCore",
            dependencies: [
                .product(name: "MPVKit", package: "MPVKit"),
            ],
            swiftSettings: [
                // v0 pragmatism for the C interop layer; the goal is .v6 once
                // the remux session's ownership story has settled.
                .swiftLanguageMode(.v5),
            ]
        ),
    ]
)
