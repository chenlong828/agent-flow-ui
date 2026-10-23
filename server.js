/**
 * AgentFlow 原型静态服务器（Node 零依赖）
 * 启动: node server.js  →  http://127.0.0.1:3000
 * 只服务 pages/ 与 assets/；拒绝点文件、越界路径与符号链接逃逸。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const ALLOWED = ['/pages/', '/assets/'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function notFound(res, urlPath) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end('<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:48px"><h2>404 · 页面不存在</h2><p>' +
    esc(urlPath) + '</p><p><a href="/pages/workflow-list.html">← 返回工作流列表</a></p></body>');
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400); return res.end('Bad Request');
  }

  // 根路径重定向到首页（工作流列表）
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(302, { Location: '/pages/workflow-list.html' });
    return res.end();
  }

  // 白名单前缀；拒绝点文件、空字节与路径段里的 ..
  const segments = urlPath.split('/');
  if (!ALLOWED.some((prefix) => urlPath.startsWith(prefix)) ||
      urlPath.includes('\0') ||
      segments.some((seg) => seg.startsWith('.') || seg === '..')) {
    return notFound(res, urlPath);
  }

  const filePath = path.resolve(ROOT, '.' + urlPath);
  const relPath = path.relative(ROOT, filePath);
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  // 解析符号链接后再校验一次，避免 pages/ 内软链逃逸
  fs.realpath(filePath, (realErr, realPath) => {
    if (realErr) return notFound(res, urlPath);
    const realRel = path.relative(ROOT, realPath);
    if (!realRel || realRel.startsWith('..') || path.isAbsolute(realRel)) {
      res.writeHead(403); return res.end('Forbidden');
    }

    fs.stat(realPath, (err, st) => {
      if (err || !st.isFile()) return notFound(res, urlPath);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(realPath).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      const stream = fs.createReadStream(realPath);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log('AgentFlow 研发智能体工作流编排原型已启动');
  console.log('➜  http://' + HOST + ':' + PORT);
});
