import path from "node:path";

export const ROOT = process.cwd();

export function sandboxPath(p: string): string {
  const resolved = path.resolve(ROOT, p);
  if (!resolved.startsWith(ROOT)) {
    throw new Error(`Path "${p}" is outside project root`);
  }
  return resolved;
}
