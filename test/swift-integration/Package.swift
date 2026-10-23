// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PiServerIntegration",
    platforms: [.macOS(.v15)],
    dependencies: [.package(path: ".sdk/pi-sdk-swift")],
    targets: [.testTarget(name: "PiServerIntegrationTests", dependencies: [.product(name: "PiSDK", package: "pi-sdk-swift")])]
)
