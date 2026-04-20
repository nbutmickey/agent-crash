import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./tools/sandbox";
import type { RollbackStrategy } from "./types";

export type ExecutionRecord = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: string;
  strategy: RollbackStrategy;
  rollback: (() => Promise<void>) | null;
  sagaCompensation: (() => Promise<string>) | null;
};

export class RollbackManager {
  private history: ExecutionRecord[] = [];

  record(entry: ExecutionRecord): void {
    this.history.push(entry);
  }

  async rollbackLast(n = 1): Promise<string[]> {
    const count = Math.min(n, this.history.length);
    const targets = this.history.splice(-count).reverse();
    const results: string[] = [];

    for (const record of targets) {
      if (record.strategy === "none") {
        results.push(`[${record.toolName}] 只读操作，无需回滚`);
      } else if (record.strategy === "snapshot" && record.rollback) {
        await record.rollback();
        results.push(`[${record.toolName}@${record.timestamp}] 已回滚到执行前状态`);
      } else if (record.strategy === "saga" && record.sagaCompensation) {
        const msg = await record.sagaCompensation();
        results.push(`[${record.toolName}@${record.timestamp}] SAGA 补偿完成：${msg}`);
      }
    }

    return results;
  }

  async rollbackAll(): Promise<string[]> {
    const results: string[] = [];
    while (this.history.length > 0) {
      results.push(...await this.rollbackLast(1));
    }
    return results;
  }

  getHistory(): ExecutionRecord[] {
    return [...this.history];
  }
}

// ── Health-data snapshot helpers (used by bash SAGA) ─────────────────────────

export function snapshotHealthData(): Map<string, string> {
  const snapshot = new Map<string, string>();
  const healthDataPath = path.resolve(ROOT, "health-data");
  if (!fs.existsSync(healthDataPath)) return snapshot;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          snapshot.set(path.relative(ROOT, full), fs.readFileSync(full, "utf-8"));
        } catch { /* skip unreadable */ }
      }
    }
  }
  walk(healthDataPath);
  return snapshot;
}

export function createSagaCompensation(before: Map<string, string>): () => Promise<string> {
  return async () => {
    const after = snapshotHealthData();
    const msgs: string[] = [];

    for (const [rel, content] of before) {
      if (after.get(rel) !== content) {
        const full = path.resolve(ROOT, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, "utf-8");
        msgs.push(`已还原 ${rel}`);
      }
    }

    for (const rel of after.keys()) {
      if (!before.has(rel)) {
        fs.unlinkSync(path.resolve(ROOT, rel));
        msgs.push(`已删除新建文件 ${rel}`);
      }
    }

    return msgs.length > 0 ? msgs.join("；") : "无文件变更，无需补偿";
  };
}
