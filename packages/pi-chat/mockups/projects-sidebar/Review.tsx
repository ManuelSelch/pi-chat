import { useEffect, useRef, useState } from "react";
import { Badge, Button, SegmentedControl } from "@mantine/core";

const sizes = { wide: [1680, 900], compact: [1024, 820], phone: [390, 780] } as const;
export function Review() {
  const params = new URLSearchParams(location.search);
  const initial = params.get("size");
  const [size, setSize] = useState<keyof typeof sizes>(initial === "compact" || initial === "phone" ? initial : "wide");
  const [mobile, setMobile] = useState("stacked");
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1200);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setAvailable(entries[0].contentRect.width));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const [width, height] = sizes[size];
  const scale = Math.min(1, available / width);
  const descriptions = {
    wide: "Use the spare left margin. The chat stays in exactly the same position when Projects opens or closes.",
    compact: "Once the spare margin runs out, shift and narrow the chat. Projects and the composer remain usable together.",
    phone: mobile === "stacked" ? "Option A: a short, independently scrollable projects pane above the chat. Both stay usable; less space for the transcript." : "Option B: a familiar modal drawer. More space for browsing, but you must close it to use the chat.",
  };
  return <div className="review">
    <header className="review-heading"><div><Badge variant="light">UX mockup · revision 1</Badge><h1>Projects, without leaving the conversation</h1></div>
      <Button component="a" href={`?canvas=1&mobile=${mobile}`} variant="default" target="_blank">Open actual-size layout</Button></header>
    <div className="review-controls"><SegmentedControl value={size} onChange={value => setSize(value as keyof typeof sizes)} data={[{label:"Wide · 1680",value:"wide"},{label:"Compact · 1024",value:"compact"},{label:"Phone · 390",value:"phone"}]} />
      {size === "phone" && <SegmentedControl value={mobile} onChange={setMobile} data={[{label:"A · Stacked",value:"stacked"},{label:"B · Modal drawer",value:"drawer"}]} />}
      <span className="scale-label">{Math.round(scale * 100)}% preview</span></div>
    <p className="review-description">{descriptions[size]}</p>
    <div ref={host} className="preview-host"><div className="preview-box" style={{width:width * scale,height:height * scale}}>
      <iframe title={`${size} interactive Pi Chat mockup`} key={size + mobile} src={`?canvas=1&mobile=${mobile}`} style={{width,height,transform:`scale(${scale})`}} />
    </div></div>
    <p className="review-footnote">Try closing Projects, choosing a session, adding one with +, and sending a message. Fake data only; no backend or saved changes.</p>
  </div>;
}
