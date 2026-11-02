#!/usr/bin/env node
/**
 * 仓外构建：把 Milkdown 7.7.0 编辑器运行时打成单文件 ESM，输出到 assets/vendor。
 *
 * 依赖 md_preview 的 node_modules（默认 ~/productive/md_preview/web/node_modules，
 * 可用 MD_PREVIEW 覆盖）。本脚本只在本地构建时使用，不进入页面运行时。
 */
import path from 'node:path';
import os from 'node:os';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mdPreview = process.env.MD_PREVIEW || path.join(os.homedir(), 'productive', 'md_preview');
const nodeModules = path.join(mdPreview, 'web', 'node_modules');
const outfile = path.join(root, 'assets', 'vendor', 'milkdown', '7.7.0', 'skill-editor.esm.js');

const esbuild = await import(pathToFileURL(path.join(nodeModules, 'esbuild', 'lib', 'main.js')).href);

mkdirSync(path.dirname(outfile), { recursive: true });
await esbuild.build({
    entryPoints: [path.join(root, 'tools', 'build', 'skill-editor.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['safari16.4'],
    outfile,
    nodePaths: [nodeModules],
    minify: true,
    legalComments: 'none',
    logLevel: 'info',
});

const bytes = readFileSync(outfile);
const sha = createHash('sha256').update(bytes).digest('hex');
const gzipKb = gzipSync(bytes).length / 1024;
console.log('out   :', path.relative(root, outfile));
console.log('bytes :', statSync(outfile).size);
console.log('gzip  :', gzipKb.toFixed(1) + ' KiB');
console.log('sha256:', sha);
