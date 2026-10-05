// @vitest-environment jsdom
import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommandMenu } from "../../../../../src/web/chat/composer/CommandMenu.js";
import { QuickOpen } from "../../../../../src/web/sessions/quick-open/QuickOpen.js";

afterEach(cleanup);

function Commands() {
  const [active, setActive] = useState(0);
  return <div onKeyDown={() => setActive(0)}><CommandMenu commands={[
    { kind: "command", name: "first" }, { kind: "command", name: "second" },
  ]} activeIndex={active} onHover={setActive} onSelect={vi.fn()} /></div>;
}

for (const kind of ["commands", "quick open"] as const) {
  it(`${kind}: ignores enter and stationary movement; hover does not scroll`, () => {
    render(<MantineProvider>{kind === "commands" ? <Commands /> : <QuickOpen
      opened onClose={vi.fn()} tabs={[]} onOpenSession={vi.fn()} onOpenProject={vi.fn()}
      catalogue={{ projects: ["first", "second"].map((name) => ({
        path: `/${name}`, displayPath: `/${name}`, name, exists: true,
        modified: 0, sessionCount: 1, sessions: [{
          path: `/sessions/${name}`, id: name, title: name, nameSource: "manual",
          modified: 0, created: 0, messageCount: 1,
        }],
      })) }}
    />}</MantineProvider>);
    const [first, second] = screen.getAllByRole("option");
    const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView);
    scroll.mockClear();
    fireEvent.mouseEnter(second!);
    expect(first!.getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseMove(second!, { clientX: 20, clientY: 30 });
    expect(second!.getAttribute("aria-selected")).toBe("true");
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.keyDown(kind === "commands" ? first! : screen.getByRole("textbox"), { key: "ArrowUp" });
    expect(first!.getAttribute("aria-selected")).toBe("true");
    expect(scroll).toHaveBeenCalled();
    fireEvent.mouseMove(second!, { clientX: 20, clientY: 30 });
    expect(first!.getAttribute("aria-selected")).toBe("true");
  });
}
