export interface ShowcaseCaptures {
  workspace: string;
  projects: string;
  commands: string;
  light: string;
}

/** Pure assembly: only approved labels and embedded PNGs, never network resources. */
export function assembleShowcaseHtml(captures: ShowcaseCaptures): string {
  for (const value of Object.values(captures)) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Expected base64 PNG image data");
  }
  const image = (key: keyof ShowcaseCaptures, alt: string) => `<img src="data:image/png;base64,${captures[key]}" alt="${alt}">`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pi Chat workspace showcase</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f4f7;color:#262a34;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.showcase{width:1200px;padding:36px 40px 30px;background:#fff;border:1px solid #e1e3e9;border-radius:14px}
h1{margin:0 0 20px;font-size:24px;font-weight:700;letter-spacing:-.5px}figure{margin:0;min-width:0}
.frame{overflow:hidden;border:1px solid #353741;border-radius:10px;background:#202126;box-shadow:0 8px 24px #1619211f}
.hero img{display:block;width:100%;height:auto}.summary{margin:10px 2px 0;font-size:12px;color:#747b88}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:26px}
.grid .frame{height:320px}.grid img{display:block;width:100%;height:100%;object-fit:cover;object-position:top left}
.grid .commands img{object-fit:contain;object-position:center}.grid .light{border-color:#e1e3e9;background:#fafafa}.grid .light img{object-fit:cover;object-position:top center}
figcaption{padding:11px 1px 0;font-size:13px;font-weight:600}
</style></head><body><main class="showcase"><h1>Workspace</h1>
<figure class="hero"><div class="frame">${image("workspace", "Pi Chat conversation with rich Markdown and tool output")}</div></figure>
<p class="summary">Rich responses · tool details · project context</p>
<div class="grid"><figure><div class="frame">${image("projects", "Project and session navigation")}</div><figcaption>Projects &amp; sessions</figcaption></figure>
<figure><div class="frame commands">${image("commands", "Native session actions and Pi commands")}</div><figcaption>Commands Panel</figcaption></figure>
<figure><div class="frame light">${image("light", "Pi Chat conversation in light mode")}</div><figcaption>Light mode</figcaption></figure></div>
</main></body></html>`;
}
