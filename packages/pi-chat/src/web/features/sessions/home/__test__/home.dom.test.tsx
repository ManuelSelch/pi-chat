// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Home } from "../components/Home.js";

afterEach(cleanup);

it("keeps the home search and activity together", () => {
  render(<MantineProvider><Home search={<input aria-label="Search sessions and projects" />}><section aria-label="Ready">Ready conversations</section></Home></MantineProvider>);
  expect(screen.getByRole("textbox", { name: "Search sessions and projects" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Ready" })).toBeTruthy();
});
