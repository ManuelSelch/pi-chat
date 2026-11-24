import type { ChangedFile } from "../diff-viewer-polish/data";
export type ReviewFile = ChangedFile & { kind: string; area: string };
function file(path:string,kind:string,area:string,before:string[],after:string[],status:"M"|"A"|"D"="M"):ReviewFile {
  return {path,kind,area,status,added:after.length,removed:before.length,hunk:"@@ -12,4 +12,6 @@",lines:[
    {kind:"context",old:12,next:12,text:""},
    ...before.map((text,i)=>({kind:"remove" as const,old:13+i,text})),
    ...after.map((text,i)=>({kind:"add" as const,next:13+i,text})),
    {kind:"context",old:18,next:20,text:""}
  ]};
}
export const files:ReviewFile[] = [
  file("src/features/checkout/Checkout.tsx","Source","Checkout",['  return <Button onClick={submit}>Pay now</Button>;'],['  return <Button loading={pending} disabled={!valid}', '    onClick={submit}>Pay now</Button>;']),
  file("src/features/checkout/use-checkout.ts","Source","Checkout",['  const submit = () => charge(cart);'],['  const [pending, setPending] = useState(false);','  const submit = async () => {','    if (pending) return;','    setPending(true);','    try { await charge(cart); }','    finally { setPending(false); }','  };']),
  file("src/features/checkout/checkout.css","Source","Checkout",['.checkout { gap: 12px; }'],['.checkout { gap: 16px; }','.checkout-actions { display: flex; justify-content: end; }']),
  file("src/features/checkout/__tests__/Checkout.test.tsx","Tests","Checkout",[],['it("disables payment while submitting", async () => {','  render(<Checkout />);','  await user.click(screen.getByRole("button"));','  expect(screen.getByRole("button")).toBeDisabled();','});'],"A"),
  file("src/features/checkout/__tests__/use-checkout.test.ts","Tests","Checkout",['  expect(charge).toHaveBeenCalled();'],['  expect(charge).toHaveBeenCalledTimes(1);']),
  file("src/styles/global.css","Source","Shared styles",['  --control-radius: 4px;'],['  --control-radius: 6px;','  --focus-ring: 0 0 0 2px var(--accent);']),
  file("tests/e2e/checkout.spec.ts","Tests","Checkout",[],['test("completes checkout", async ({ page }) => {','  await page.goto("/checkout");','  await page.getByRole("button", { name: "Pay now" }).click();','  await expect(page.getByText("Order confirmed")).toBeVisible();','});'],"A"),
  file("docs/checkout.md","Docs","Checkout",['Payment submits the current cart.'],['Payment submits the current cart once.','The payment button is disabled while a request is pending.']),
  file("package.json","Config","Project config",['    "version": "1.4.0",'],['    "version": "1.5.0",'])
];
