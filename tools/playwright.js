/** 解析 Playwright 模块：优先 PLAYWRIGHT_MODULE，其次本机缓存，最后普通模块解析。 */
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    path.join(os.homedir(), '.cache', 'playwright-libs', '1.49.1', 'node_modules', 'playwright-core'),
    'playwright-core'
  ].filter(Boolean);
  let last;
  for (const candidate of candidates) {
    try { return require(candidate); } catch (err) { last = err; }
  }
  throw new Error('找不到 Playwright。请设置 PLAYWRIGHT_MODULE 指向 playwright-core 目录（见 docs/design/dev-environment.md）。' + (last ? ' 最后错误: ' + last.message : ''));
}
