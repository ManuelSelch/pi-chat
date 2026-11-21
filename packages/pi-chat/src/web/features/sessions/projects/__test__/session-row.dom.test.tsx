// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionRow } from "../components/SessionRow.js";

afterEach(cleanup);

function mount(label?: string, title = "Conversation title") {
  render(<MantineProvider><SessionRow session={{
    path: "/saved", id: "saved", title, nameSource: "manual", modified: 0, created: 0, messageCount: 1,
  }} label={label} active={false} disabled={false} onOpen={vi.fn()} /></MantineProvider>);
}

it.each(["feature", "feat", "fix", "bugfix"])("removes the %s prefix but keeps the issue and description", prefix => {
  const branch = `${prefix}/csmm-123-improve-session-labels`;

  mount(branch);

  expect(screen.getByRole("button").textContent).toBe("csmm-123-improve-session-labels");
  expect(screen.getByRole("button").querySelector("[title]")).toBeNull();
});

it.each(["team/csmm-123-description", "feature-description", "feature/", "main", "feature/team/description"])("preserves meaningful branch content in %s", branch => {
  mount(branch);

  expect(screen.getByRole("button").textContent).toBe(branch === "feature/team/description" ? "team/description" : branch);
});

it("does not shorten conversation titles", () => {
  mount(undefined, "feature/csmm-123-description");

  expect(screen.getByRole("button").textContent).toBe("feature/csmm-123-description");
});
