// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Slot } from "../src/web/extensions/Slot.js";

afterEach(cleanup);

describe("Slot", () => {
  it("renders buttons for the named slot and dispatches their actions", async () => {
    const onAction = vi.fn();
    render(
      <MantineProvider>
      <Slot
        name="composer.right"
        buttons={[
          { id: "demo", slot: "composer.right", label: "Demo", actionId: "demo.sayHello" },
          { id: "header", slot: "session.header.right", label: "Header", actionId: "demo.header" },
        ]}
        onAction={onAction}
      />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Demo" }));

    expect(screen.queryByRole("button", { name: "Header" })).toBeNull();
    expect(onAction).toHaveBeenCalledWith("demo.sayHello");
  });
});
