import { useLocalStorage } from "@mantine/hooks";

export type TranscriptDensity = "comfortable" | "compact";
export const TRANSCRIPT_DENSITY_STORAGE_KEY = "pi-chat:transcriptDensity";

/** Transcript presentation preference, stored per browser. */
export function useTranscriptDensity(): {
  density: TranscriptDensity;
  setDensity: (density: TranscriptDensity) => void;
} {
  const [density, setDensity] = useLocalStorage<TranscriptDensity>({
    key: TRANSCRIPT_DENSITY_STORAGE_KEY,
    defaultValue: "comfortable",
    getInitialValueInEffect: false,
  });
  return { density, setDensity };
}
