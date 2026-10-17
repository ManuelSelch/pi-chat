// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PiSDK",
    products: [.library(name: "PiSDK", targets: ["PiSDK"])],
    targets: [
        .target(name: "PiSDK"),
        // A feasibility experiment only; not part of the public PiSDK product.
        .target(name: "ContractGenerationProbe", path: "experiments/swift-generation/Sources"),
        .testTarget(name: "ContractGenerationProbeTests", dependencies: ["ContractGenerationProbe"], path: "experiments/swift-generation/Tests")
    ]
)
