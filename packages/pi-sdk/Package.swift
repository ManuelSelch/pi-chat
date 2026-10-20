// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PiSDK",
    platforms: [.iOS("26.1"), .macOS(.v15)],
    products: [.library(name: "PiSDK", targets: ["PiSDK"])],
    targets: [
        .target(name: "PiSDK", resources: [.copy("Contract")]),
        .testTarget(name: "PiSDKTests", dependencies: ["PiSDK"]),
        // A feasibility experiment only; not part of the public PiSDK product.
        .target(name: "ContractGenerationProbe", path: "experiments/swift-generation/Sources"),
        .testTarget(name: "ContractGenerationProbeTests", dependencies: ["ContractGenerationProbe"], path: "experiments/swift-generation/Tests")
    ]
)
