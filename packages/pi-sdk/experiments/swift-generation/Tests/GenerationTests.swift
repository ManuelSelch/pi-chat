import Foundation
import XCTest
@testable import ContractGenerationProbe

final class GenerationTests: XCTestCase {
    private var fixtureDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("protocol/fixtures/v2")
    }

    private func fixtures(_ file: String) throws -> [[String: Any]] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: fixtureDirectory.appendingPathComponent(file))) as? [[String: Any]])
    }

    private func data(_ input: Any) throws -> Data {
        try JSONSerialization.data(withJSONObject: input, options: [.fragmentsAllowed, .sortedKeys])
    }

    private func decode(_ schema: String, _ data: Data) throws {
        let decoder = JSONDecoder()
        switch schema {
        case "ChatMessage": _ = try decoder.decode(ChatMessage.self, from: data)
        case "ThinkingLevel": _ = try decoder.decode(ThinkingLevel.self, from: data)
        case "ExtensionContributions": _ = try decoder.decode(ExtensionContributions.self, from: data)
        case "FooterItem": _ = try decoder.decode(FooterItem.self, from: data)
        case "PromptResult": _ = try decoder.decode(PromptResult.self, from: data)
        default: XCTFail("Unknown probe schema: \(schema)")
        }
    }

    func testGeneratedModelsDecodeAllRepresentativeValidFixtures() throws {
        let supported = Set(["ChatMessage", "ThinkingLevel", "ExtensionContributions", "FooterItem", "PromptResult"])
        var count = 0
        for fixture in try fixtures("domain-valid.json") {
            let schema = try XCTUnwrap(fixture["schema"] as? String)
            if supported.contains(schema) {
                XCTAssertNoThrow(try decode(schema, data(try XCTUnwrap(fixture["input"]))), fixture["name"] as? String ?? "")
                count += 1
            }
            if fixture["name"] as? String == "snapshot with rich state" {
                let snapshot = try XCTUnwrap(fixture["input"] as? [String: Any])
                for message in try XCTUnwrap(snapshot["messages"] as? [[String: Any]]) {
                    XCTAssertNoThrow(try decode("ChatMessage", data(message)))
                    count += 1
                }
            }
        }
        XCTAssertEqual(count, 15)
    }

    func testExtensionJSONRoundTripPreservesNestedValues() throws {
        let fixture = try XCTUnwrap(try fixtures("domain-valid.json").first { $0["name"] as? String == "extension JSON values" })
        let input = try XCTUnwrap(fixture["input"] as? [String: Any])
        let decoded = try JSONDecoder().decode(ExtensionContributions.self, from: data(input))
        let roundTrip = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(decoded)) as? [String: Any])
        XCTAssertEqual(try data(try XCTUnwrap(roundTrip["state"])), try data(try XCTUnwrap(input["state"])))
        XCTAssertNil(roundTrip["future"])
    }

    func testUnknownEnumsAreRejected() throws {
        XCTAssertThrowsError(try decode("ThinkingLevel", data("future")))
        XCTAssertThrowsError(try decode("ChatMessage", data(["id": "x", "role": "future", "text": "x"])))
    }

    // These passing assertions record generator gaps, not acceptable SDK semantics.
    // Swift v2 must reject these just as Zod/JSON Schema do.
    func testCodableAcceptsNullForOmittedOptionalTimestamp() throws {
        let fixture = try XCTUnwrap(try fixtures("invalid.json").first { $0["name"] as? String == "null optional timestamp" })
        XCTAssertNoThrow(try decode("ChatMessage", data(try XCTUnwrap(fixture["input"]))))
    }

    func testGeneratorFlattensDiscriminatedUnions() throws {
        for name in ["tool missing payload", "non-string boolean prompt result"] {
            let fixture = try XCTUnwrap(try fixtures("invalid.json").first { $0["name"] as? String == name })
            let schema = try XCTUnwrap(fixture["schema"] as? String)
            if name == "tool missing payload" {
                // All role-specific payloads become optional in a single struct.
                XCTAssertNoThrow(try decode(schema, data(try XCTUnwrap(fixture["input"]))))
            } else {
                XCTAssertThrowsError(try decode(schema, data(try XCTUnwrap(fixture["input"]))))
            }
        }
        XCTAssertNoThrow(try decode("PromptResult", data(["cancelled": false])))
    }

    func testV2PresentationRequiredFieldsAreNotV1Defaults() throws {
        XCTAssertThrowsError(try JSONDecoder().decode(FooterItem.self, from: data(["key": "mode", "text": "Ready"])))
        XCTAssertThrowsError(try JSONDecoder().decode(ExtensionContributions.self, from: data([String: String]())))
    }
}
