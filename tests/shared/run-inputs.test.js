import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunData, errorText, uploadErrorText } from '../../assets/js/run/data.js';

class FakeXHR {
  constructor() {
    this.upload = {};
    this.timeout = 0;
    this.status = 0;
    this.responseText = '';
    FakeXHR.last = this;
  }
  open(method, url) { this.method = method; this.url = url; }
  send(body) { this.sent = body; }
  abort() { if (this.onabort) this.onabort(); }
  progress(loaded, total) { if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: loaded, total: total }); }
  respond(status, body) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    if (this.onload) this.onload();
  }
  fail() { if (this.onerror) this.onerror(); }
  timeoutNow() { if (this.ontimeout) this.ontimeout(); }
}

function withXHR(fn) {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  return Promise.resolve().then(fn).finally(function () { globalThis.XMLHttpRequest = original; });
}

function pngFile(name) {
  return new File([new Uint8Array([137, 80, 78, 71])], name || 'a.png', { type: 'image/png' });
}

test('uploadInput 以 multipart POST /run-inputs 上传并回传进度', async () => {
  await withXHR(async function () {
    const runs = createRunData();
    const progress = [];
    const pending = runs.uploadInput(pngFile('a.png'), { onProgress: function (p) { progress.push(p); } });
    const xhr = FakeXHR.last;
    assert.equal(xhr.method, 'POST');
    assert.equal(xhr.url, '/api/v1/run-inputs');
    assert.equal(xhr.timeout, 120000);
    assert.ok(xhr.sent instanceof FormData, '必须提交 FormData');
    xhr.progress(5, 10);
    xhr.respond(201, { inputId: 'in-1', name: 'a.png', mediaType: 'image/png', sizeBytes: 4, sha256: 'ab', createdAt: '2026-11-19T00:00:00Z' });
    const view = await pending;
    assert.equal(view.inputId, 'in-1');
    assert.deepEqual(progress, [50]);
  });
});

test('uploadInput 把 413/超时/断网/取消归一为可识别错误', async () => {
  await withXHR(async function () {
    const runs = createRunData();
    const limited = runs.uploadInput(pngFile());
    FakeXHR.last.respond(413, { error: { code: 'payload_too_large', message: '请求内容超过限制', details: { limit: 'run_input_file_bytes' } } });
    await assert.rejects(limited, function (err) {
      assert.equal(err.status, 413);
      assert.equal(err.code, 'payload_too_large');
      assert.equal(uploadErrorText(err), '单张图片不能超过 8 MiB');
      return true;
    });

    const timedOut = runs.uploadInput(pngFile());
    FakeXHR.last.timeoutNow();
    await assert.rejects(timedOut, function (err) {
      assert.equal(err.code, 'timeout');
      assert.equal(uploadErrorText(err), '上传超时，请重试');
      return true;
    });

    const offline = runs.uploadInput(pngFile());
    FakeXHR.last.fail();
    await assert.rejects(offline, function (err) {
      assert.equal(err.status, 0);
      assert.equal(uploadErrorText(err), '上传失败，请检查网络后重试');
      return true;
    });

    const controller = new AbortController();
    const aborted = runs.uploadInput(pngFile(), { signal: controller.signal });
    controller.abort();
    await assert.rejects(aborted, function (err) {
      assert.equal(err.code, 'aborted');
      return true;
    });
  });
});

test('deleteInput / listInputs / inputContentUrl 走同源端点并编码 ID', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async function (url, init) {
    calls.push({ url: String(url), method: init && init.method });
    if (init && init.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  };
  try {
    const runs = createRunData();
    await runs.deleteInput('in/1');
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].url, '/api/v1/run-inputs/in%2F1');
    const page = await runs.listInputs('r 1');
    assert.deepEqual(page, { items: [] });
    assert.equal(calls[1].url, '/api/v1/runs/r%201/inputs');
    assert.equal(runs.inputContentUrl('r/1', 'in 1'), '/api/v1/runs/r%2F1/inputs/in%201/content');
  } finally {
    globalThis.fetch = original;
  }
});

test('errorText 增加图片初始资料的错误分支', function () {
  assert.match(errorText({ status: 409, code: 'client_unsupported' }), /暂不支持图片/);
  assert.match(errorText({ status: 413, details: { limit: 'run_input_bytes' } }), /20 MiB/);
  assert.match(errorText({ status: 413, details: { limit: 'run_input_count' } }), /最多 8 张/);
  assert.match(errorText({ status: 400, details: { field: 'inputs' } }), /已失效/);
});
