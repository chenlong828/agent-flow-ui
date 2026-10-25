'use strict';

/** 单独运行 CMP-bff，便于组件验证；生产由 node server.js 同进程挂载。 */
const http = require('http');
const { createBff } = require('./index');

const PORT = Number(process.env.PORT || 3001);
const HOST = '127.0.0.1';

const bff = createBff();
const server = http.createServer((req, res) => bff.handle(req, res));

server.listen(PORT, HOST, () => {
  console.log('CMP-bff 已启动');
  console.log('➜  http://' + HOST + ':' + PORT + '  →  ' + bff.config.apiBase);
});
