import { TFile, Vault } from "obsidian";

export function scanWorkoutFolder(vault: Vault, folder: string): TFile[] {
  const trimmed = folder.replace(/\/+$/, "");
  const prefix = trimmed.length > 0 ? `${trimmed}/` : "";
  return vault
    .getMarkdownFiles()
    .filter((f) => (prefix === "" ? true : f.path.startsWith(prefix)));
}

export function isInWorkoutFolder(path: string, folder: string): boolean {
  const trimmed = folder.replace(/\/+$/, "");
  if (trimmed.length === 0) return path.endsWith(".md");
  return path.startsWith(`${trimmed}/`) && path.endsWith(".md");
}
