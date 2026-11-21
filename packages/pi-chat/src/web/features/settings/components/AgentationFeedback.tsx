import { lazy, Suspense } from "react";
import { useAgentation } from "../preferences/hooks/use-agentation.js";

const Agentation = lazy(() => import("agentation").then((module) => ({ default: module.Agentation })));

export function AgentationFeedback() {
  const { enabled } = useAgentation();
  if (!enabled) return null;

  return <Suspense fallback={null}><Agentation /></Suspense>;
}
