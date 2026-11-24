// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewComment } from "../ReviewComment.js";

afterEach(cleanup);
const comment={id:"one",path:"test.ts",side:"additions" as const,line:5,excerpt:"code",body:"Saved",patch:"patch",baseCommit:"base"};
it("uses in-editor icons, keyboard shortcuts and no line/draft labels",()=>{
  const save=vi.fn(),cancel=vi.fn(),draft=vi.fn();
  render(<MantineProvider><ReviewComment comment={comment} editor={{id:"one",body:"Fix this"}} disabled={false} onSave={save} onCancel={cancel} onDraft={draft} onEdit={vi.fn()} onDelete={vi.fn()}/></MantineProvider>);
  expect(screen.queryByText("Draft")).toBeNull();
  expect(screen.queryByText("New line 5")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Save comment"}));
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  fireEvent.keyDown(screen.getByRole("textbox"),{key:"Enter"});
  expect(save).toHaveBeenCalledTimes(2);
  expect(fireEvent.keyDown(screen.getByRole("textbox"),{key:"Enter",shiftKey:true})).toBe(true);
  fireEvent.keyDown(screen.getByRole("textbox"),{key:"Enter",isComposing:true});
  expect(save).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(screen.getByRole("textbox"),{key:"Escape"});
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole("textbox"),{target:{value:"Changed"}});
  expect(draft).toHaveBeenCalledWith("Changed");
});
it("disables saving empty drafts and shows saved edit/delete actions",()=>{
  const props={comment,disabled:false,onSave:vi.fn(),onCancel:vi.fn(),onDraft:vi.fn(),onEdit:vi.fn(),onDelete:vi.fn()};
  const view=render(<MantineProvider><ReviewComment {...props} editor={{id:"one",body:" "}}/></MantineProvider>);
  expect(screen.getByRole("button",{name:"Save comment"}).hasAttribute("disabled")).toBe(true);
  fireEvent.keyDown(screen.getByRole("textbox"),{key:"Enter"});
  expect(props.onSave).not.toHaveBeenCalled();
  view.rerender(<MantineProvider><ReviewComment {...props} editor={null}/></MantineProvider>);
  expect(screen.getByText("Saved")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Edit comment"}));
  fireEvent.click(screen.getByRole("button",{name:"Delete comment"}));
  expect(props.onEdit).toHaveBeenCalledOnce();
  expect(props.onDelete).toHaveBeenCalledOnce();
});
