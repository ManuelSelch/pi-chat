import { z } from "zod";
import { requestSchema, responseSchema, eventSchema, serverMessageSchema, snapshotSchema, initializeResultSchema, operationSchemas } from "../src/contract/v2.js";
import { filePathSchema } from "../src/contract/files.js";
import { directoryBrowseSchema } from "../src/contract/directories.js";

export const v2SchemaSources = {
  Request: requestSchema, Response: responseSchema, Event: eventSchema, ServerMessage: serverMessageSchema,
  SessionSnapshot: snapshotSchema, Initialization: initializeResultSchema,
  ...Object.fromEntries(Object.entries(operationSchemas).map(([method, spec]) => [`result.${method}`, spec.result])),
};
export function generateV2Schemas() {
  return Object.fromEntries(Object.entries(v2SchemaSources).map(([name, source]) => [name, z.toJSONSchema(source, {
    target: "draft-2020-12", io: "input",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema === filePathSchema) jsonSchema.pattern = "^(?![a-zA-Z][a-zA-Z0-9+.-]*:)(?![\\\\/]{2})(?=[\\s\\S]*\\S)[^\\u0000-\\u001f\\u007f-\\u009f]*$";
      else if (zodSchema === directoryBrowseSchema.shape.path) jsonSchema.pattern = "^[^\\u0000]*$";
      if (zodSchema instanceof z.ZodString && zodSchema.def.checks?.some((check) => check._zod.def.check === "overwrite")) {
        jsonSchema.pattern = "\\S";
        jsonSchema["x-pi-normalization"] = "trim";
      }
    },
  })]));
}
