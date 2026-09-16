export function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string[]> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "_");
    (out[k] ??= []).push(i.message);
  }
  return out;
}
