/**
 * AgentFlow 原型静态服务器（Node 零依赖）
 * 启动: node server.js  →  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2'
};

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

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:48px"><h2>404 · 页面不存在</h2><p>' +
        urlPath + '</p><p><a href="/pages/workflow-list.html">← 返回工作流列表</a></p></body>');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('AgentFlow 研发智能体工作流编排原型已启动');
  console.log('➜  http://localhost:' + PORT);
});
