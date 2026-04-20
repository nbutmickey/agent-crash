import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../tools/sandbox";
import type { ToolContext } from "../tools/context";

export type PreHookResult = { allowed: true } | { allowed: false; reason: string };
export type PreHook = (name: string, args: Record<string, unknown>, ctx: ToolContext) => PreHookResult;

const writeScope: PreHook = (name, args) => {
  if (name !== "write" && name !== "edit") return { allowed: true };
  const p = args.path as string;
  if (!p.startsWith("health-data/") && p !== "health-data") {
    return { allowed: false, reason: `写入路径 "${p}" 不在 health-data/ 目录内，已拦截。` };
  }
  return { allowed: true };
};

const BASH_BLACKLIST = ["rm ", "rm\t", "curl", "wget", "chmod", "chown", "sudo", "dd ", "mkfs", "pkill", "killall", "shutdown", "reboot"];
const bashGuard: PreHook = (name, args) => {
  if (name !== "bash") return { allowed: true };
  const cmd = args.command as string;
  for (const keyword of BASH_BLACKLIST) {
    if (cmd.includes(keyword)) {
      return { allowed: false, reason: `命令包含受限关键词 "${keyword.trim()}"，已拦截。` };
    }
  }
  return { allowed: true };
};

const readBeforeWrite: PreHook = (name, args, ctx) => {
  if (name !== "write") return { allowed: true };
  const p = args.path as string;
  const full = path.resolve(ROOT, p);
  if (fs.existsSync(full) && !ctx.readFiles.has(p)) {
    return { allowed: false, reason: `文件 "${p}" 已存在但尚未读取，请先调用 read 工具。` };
  }
  return { allowed: true };
};

export const PRE_HOOKS: PreHook[] = [writeScope, bashGuard, readBeforeWrite];

export function runPreHooks(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): PreHookResult {
  for (const hook of PRE_HOOKS) {
    const result = hook(name, args, ctx);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
