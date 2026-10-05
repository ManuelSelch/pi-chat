const LOCAL_LINK_SCHEMES = /^(?:[a-z][a-z\d+.-]*:)/i;

/** Markdown links that refer to the local machine rather than a web resource. */
export function localPathFromHref(href: string): string | undefined {
  if (href.startsWith("file:")) {
    try {
      const url = new URL(href);
      if (url.hostname && url.hostname !== "localhost") return undefined;
      return decodeURIComponent(url.pathname);
    } catch {
      return undefined;
    }
  }
  if (href.startsWith("#") || LOCAL_LINK_SCHEMES.test(href)) return undefined;
  return href;
}

/** Quote a path for the existing server-side bash command. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function openLocalLinkCommand(path: string): string {
  return `!!open -- ${shellQuote(path)}`;
}
