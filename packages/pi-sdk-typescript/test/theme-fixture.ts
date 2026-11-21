/** Concrete wire fixture; intentionally independent of Pi and Mantine. */
export const themeFixture = {
  name: "midnight-plum",
  appearance: "dark" as const,
  colors: {
    accent: "#c7a1f5", text: "#ede7f5", muted: "#b0a5be", border: "#4e425e",
    selectedBg: "#302939", mdLink: "#bdaeff", success: "#91d5ac", warning: "#efce82", error: "#f39caa",
    userMessageBg: "#302939", userMessageText: "#ede7f5", thinkingText: "#baaccb",
    toolDiffAdded: "#91d5ac", toolDiffRemoved: "#f39caa",
  },
  surfaces: { pageBg: "#19161f", cardBg: "#231f2b", infoBg: "#302939" },
};
