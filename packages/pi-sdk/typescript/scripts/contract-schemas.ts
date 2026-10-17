import { z } from "zod";
import {
  clientMessageSchema, serverMessageSchema, chatMessageSchema, thinkingLevelSchema,
  piChatExtensionsSchema, uiPromptResultSchema, footerItemSchema, filePathSchema,
  fileRequestIdSchema, directoryBrowseSchema,
} from "../src/contract/index.js";

export const contractSchemaSources = {
  ClientMessage: clientMessageSchema,
  ServerMessage: serverMessageSchema,
  ChatMessage: chatMessageSchema,
  ThinkingLevel: thinkingLevelSchema,
  ExtensionContributions: piChatExtensionsSchema,
  PromptResult: uiPromptResultSchema,
  FooterItem: footerItemSchema,
};

export function generateContractSchemas() {
  return Object.fromEntries(Object.entries(contractSchemaSources).map(([name, source]) => [name, z.toJSONSchema(source, {
    target: "draft-2020-12",
    io: "input", // Wire inputs allow omitted defaults and additive unknown fields.
    override: ({ zodSchema, jsonSchema }) => {
      // Custom refinements are otherwise invisible to JSON Schema export. Keep
      // these mirrors checked against the unchanged Zod validators via fixtures.
      if (zodSchema === filePathSchema) {
        jsonSchema.pattern = "^(?![a-zA-Z][a-zA-Z0-9+.-]*:)(?![\\\\/]{2})(?=[\\s\\S]*\\S)[^\\u0000-\\u001f\\u007f-\\u009f]*$";
      } else if (zodSchema === fileRequestIdSchema) {
        jsonSchema.pattern = "^(?=[\\s\\S]*\\S)[^\\u0000-\\u001f\\u007f-\\u009f]*$";
      } else if (zodSchema === directoryBrowseSchema.shape.path) {
        jsonSchema.pattern = "^[^\\u0000]*$";
      }
      if (zodSchema instanceof z.ZodString && zodSchema.def.checks?.some((check) => check._zod.def.check === "overwrite")) {
        // v1 prompt trimming is a parser normalization, not a JSON mutation.
        jsonSchema.pattern = "\\S";
        jsonSchema["x-pi-normalization"] = "trim";
      }
    },
  })]));
}
