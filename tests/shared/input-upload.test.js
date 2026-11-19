import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputStaging, REJECT_TEXT } from '../../assets/js/run/input-upload.js';

function imageFile(name, size, type) {
  return new File([new Uint8Array(size === undefined ? 4 : size)], name || 'a.png', { type: type || 'image/png' });
}

function fakeEnv(overrides) {
  const env = {
    revoked: [],
    removed: [],
    upload: async function (file) { return { inputId: 'in-' + file.name, name: file.name }; },
    createUrl: function (file) { return 'blob:' + file.name; },
    revokeUrl: function (url) { env.revoked.push(url); },
    remove: async function (inputId) { env.removed.push(inputId); }
  };
  return Object.assign(env, overrides || {});
}

test('addFiles 本地校验类型/空文件/单张/数量/合计，重复文件允许', function () {
  const env = fakeEnv({ limits: { maxFileBytes: 10 } });
  const staging = createInputStaging(env);
  const result = staging.addFiles([
    imageFile('a.png', 10),
    imageFile('b.txt', 10, 'text/plain'),
    imageFile('empty.png', 0),
    imageFile('big.png', 11),
    imageFile('a.png', 10)
  ]);
  assert.equal(result.added, 2, '同文件重复添加应允许');
  assert.deepEqual(result.rejected.map(function (item) { return item.reason; }), ['type', 'empty', 'size']);
  assert.equal(staging.items()[0].objectUrl, 'blob:a.png');

  const sized = createInputStaging(fakeEnv({ limits: { maxTotalBytes: 15 } }));
  const total = sized.addFiles([imageFile('c.png', 10), imageFile('d.png', 10)]);
  assert.equal(total.added, 1);
  assert.equal(total.rejected[0].reason, 'total');
  assert.equal(REJECT_TEXT.total, '图片合计不能超过 20 MiB');

  const capped = createInputStaging(fakeEnv({ limits: { maxFiles: 2 } }));
  const count = capped.addFiles([imageFile('1.png'), imageFile('2.png'), imageFile('3.png')]);
  assert.equal(count.added, 2);
  assert.equal(count.rejected[0].reason, 'count');
});

test('提交前删除只改本地：不发远端请求，释放 object URL', async function () {
  const env = fakeEnv();
  const staging = createInputStaging(env);
  staging.addFiles([imageFile('a.png')]);
  const id = staging.items()[0].localId;
  const ok = await staging.remove(id);
  assert.equal(ok, true);
  assert.deepEqual(env.removed, []);
  assert.deepEqual(env.revoked, ['blob:a.png']);
  assert.equal(staging.items().length, 0);
});

test('uploadAll 并发不超过 3、返回顺序与列表一致', async function () {
  let active = 0;
  let maxActive = 0;
  const env = fakeEnv({
    upload: function (file) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise(function (resolve) {
        setTimeout(function () { active -= 1; resolve({ inputId: 'in-' + file.name, name: file.name }); }, 5);
      });
    }
  });
  const staging = createInputStaging(env);
  staging.addFiles([imageFile('a.png'), imageFile('b.png'), imageFile('c.png'), imageFile('d.png')]);
  const ids = await staging.uploadAll();
  assert.equal(maxActive, 3);
  assert.deepEqual(ids, ['in-a.png', 'in-b.png', 'in-c.png', 'in-d.png']);
  assert.deepEqual(staging.uploadProgress(), { uploaded: 4, total: 4 });
});

test('任一项上传失败：中止其余、删除已上传项、本地恢复 staged 可重试', async function () {
  let impl = function (file) {
    if (file.name === 'b.png') return Promise.reject(new Error('boom'));
    return Promise.resolve({ inputId: 'in-' + file.name, name: file.name });
  };
  const env = fakeEnv({
    upload: function (file) { return impl(file); }
  });
  const staging = createInputStaging(env);
  staging.addFiles([imageFile('a.png'), imageFile('b.png'), imageFile('c.png')]);
  await assert.rejects(staging.uploadAll(), /boom/);
  assert.deepEqual(env.removed.slice().sort(), ['in-a.png', 'in-c.png']);
  staging.items().forEach(function (item) {
    assert.equal(item.state, 'staged');
    assert.equal(item.inputId, null);
    assert.equal(item.progress, 0);
  });
  assert.equal(staging.items().length, 3, '本地 File 必须保留供重试');
  impl = function (file) { return Promise.resolve({ inputId: 'retry-' + file.name, name: file.name }); };
  const ids = await staging.uploadAll();
  assert.deepEqual(ids, ['retry-a.png', 'retry-b.png', 'retry-c.png']);
});

test('markBound 后 dispose 不删除已绑定项；未绑定上传项关闭时尽力删除', async function () {
  const boundEnv = fakeEnv();
  const bound = createInputStaging(boundEnv);
  bound.addFiles([imageFile('a.png')]);
  await bound.uploadAll();
  bound.markBound();
  bound.dispose();
  assert.deepEqual(boundEnv.removed, []);
  assert.deepEqual(boundEnv.revoked, ['blob:a.png']);

  const looseEnv = fakeEnv();
  const loose = createInputStaging(looseEnv);
  loose.addFiles([imageFile('b.png')]);
  await loose.uploadAll();
  loose.dispose();
  assert.deepEqual(looseEnv.removed, ['in-b.png']);
});
