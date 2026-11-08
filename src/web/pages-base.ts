export function pagesBase(raw: string | undefined): string {
  const trimmed = (raw ?? "/").trim();
  if (trimmed === "" || trimmed === "/") {
    return "/";
  }
  const withLead = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
  return withLead.endsWith("/") ? withLead : withLead + "/";
}
