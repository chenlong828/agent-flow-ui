/**
 * 初始资料（图片）暂存队列（CMP-instances 内部模块）
 *
 * 提交前只持有本地 File 与 object URL，不产生任何服务端状态；
 * 点「发起运行」时才调用 uploadAll() 逐张上传（并发 3），失败整体回滚。
 * 不碰 DOM：渲染由 run/views/launch-inputs 负责，onChange 只通知重绘。
 */

export const INPUT_LIMITS = {
  maxFiles: 8,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
};

export const REJECT_TEXT = {
  type: '只支持 PNG/JPEG/WebP/GIF 图片',
  empty: '图片不能为空',
  size: '单张不能超过 8 MiB',
  count: '最多 8 张图片',
  total: '图片合计不能超过 20 MiB'
};

const CONCURRENCY = 3;

function localIdOf() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'li-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function notify(st) {
  if (!st.disposed) st.onChange();
}

function totalBytes(st) {
  return st.items.reduce(function (sum, item) { return sum + item.sizeBytes; }, 0);
}

function addFiles(st, files) {
  const list = Array.prototype.slice.call(files || []);
  const rejected = [];
  let added = 0;
  for (const file of list) {
    if (st.items.length >= st.limits.maxFiles) { rejected.push({ name: file.name, reason: 'count' }); continue; }
    if (!file || typeof file.size !== 'number' || file.size === 0) { rejected.push({ name: file && file.name, reason: 'empty' }); continue; }
    if (file.type && st.limits.mediaTypes.indexOf(file.type) < 0) { rejected.push({ name: file.name, reason: 'type' }); continue; }
    if (file.size > st.limits.maxFileBytes) { rejected.push({ name: file.name, reason: 'size' }); continue; }
    if (totalBytes(st) + file.size > st.limits.maxTotalBytes) { rejected.push({ name: file.name, reason: 'total' }); continue; }
    st.items.push({
      localId: localIdOf(),
      file: file,
      name: file.name || '粘贴图片',
      sizeBytes: file.size,
      mediaType: file.type || '',
      objectUrl: st.createUrl(file),
      state: 'staged',
      progress: 0,
      inputId: null,
      serverName: null,
      error: null
    });
    added++;
  }
  notify(st);
  return { added: added, rejected: rejected };
}

/** 删除本地项；已上传的先尽力删远端（正常提交前不存在）。 */
function removeItem(st, localId) {
  const index = st.items.findIndex(function (item) { return item.localId === localId; });
  if (index < 0) return Promise.resolve(false);
  const item = st.items[index];
  if (item.state === 'uploading') return Promise.resolve(false);
  st.items.splice(index, 1);
  st.revokeUrl(item.objectUrl);
  notify(st);
  if (item.inputId) {
    return st.removeRemote(item.inputId).then(function () { return true; }, function () { return true; });
  }
  return Promise.resolve(true);
}

/** 回滚：删除已上传暂存项，把本地项恢复为 staged，保留 File 供重试。 */
async function rollback(st) {
  const uploaded = st.items.filter(function (item) { return Boolean(item.inputId); });
  await Promise.all(uploaded.map(function (item) {
    return st.removeRemote(item.inputId).catch(function () { /* 失败忽略：暂存项由运维清理 */ });
  }));
  st.items.forEach(function (item) {
    item.state = 'staged';
    item.progress = 0;
    item.inputId = null;
    item.serverName = null;
    item.error = null;
  });
  notify(st);
}

/** 提交时上传全部本地项；返回按列表顺序的 inputId。失败时回滚并抛出首个错误。 */
async function uploadAll(st) {
  const targets = st.items.filter(function (item) { return item.state === 'staged' || item.state === 'failed'; });
  if (!targets.length) return [];
  const controller = new AbortController();
  st.controller = controller;
  let failure = null;
  targets.forEach(function (item) {
    item.state = 'uploading';
    item.progress = 0;
    item.error = null;
  });
  notify(st);

  let cursor = 0;
  async function worker() {
    while (!failure && cursor < targets.length) {
      const item = targets[cursor];
      cursor += 1;
      try {
        const view = await st.upload(item.file, {
          signal: controller.signal,
          onProgress: function (percent) {
            if (item.inputId || failure) return;
            item.progress = percent;
            notify(st);
          }
        });
        item.inputId = view && typeof view.inputId === 'string' ? view.inputId : null;
        item.serverName = view && typeof view.name === 'string' ? view.name : item.name;
        item.state = 'uploaded';
        item.progress = 100;
        notify(st);
      } catch (error) {
        if (!failure) failure = error;
        item.state = 'failed';
        item.error = error;
        notify(st);
        controller.abort();
      }
    }
  }
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i += 1) workers.push(worker());
  await Promise.all(workers);
  st.controller = null;

  if (failure) {
    await rollback(st);
    throw failure;
  }
  return targets.map(function (item) { return item.inputId; });
}

/** 启动成功：已绑定项不再允许删除，关闭时只释放 URL。 */
function markBound(st) {
  st.items.forEach(function (item) { if (item.inputId) item.state = 'bound'; });
  notify(st);
}

function uploadProgress(st) {
  const total = st.items.length;
  const uploaded = st.items.filter(function (item) { return item.state === 'uploaded' || item.state === 'bound'; }).length;
  return { uploaded: uploaded, total: total };
}

/** 关闭弹窗：中止在途上传、尽力删除未绑定的已上传项、释放全部预览 URL。 */
function dispose(st) {
  st.disposed = true;
  if (st.controller) st.controller.abort();
  st.items.forEach(function (item) {
    if (item.inputId && item.state !== 'bound') {
      st.removeRemote(item.inputId).catch(function () { /* 失败忽略：暂存项由运维清理 */ });
    }
    st.revokeUrl(item.objectUrl);
  });
  st.items.length = 0;
}

/**
 * @param {object} options
 * @param {(file: File, opts: {onProgress: (p:number)=>void, signal: AbortSignal}) => Promise<object>} options.upload
 * @param {(inputId: string) => Promise<unknown>} [options.remove]      回滚/删除已上传暂存项
 * @param {(file: File) => string} [options.createUrl]
 * @param {(url: string) => void} [options.revokeUrl]
 * @param {() => void} [options.onChange]
 * @param {object} [options.limits]
 */
export function createInputStaging(options) {
  const opts = options || {};
  if (typeof opts.upload !== 'function') throw new Error('createInputStaging 需要 upload');
  const st = {
    upload: opts.upload,
    removeRemote: typeof opts.remove === 'function' ? opts.remove : function () { return Promise.resolve(); },
    createUrl: typeof opts.createUrl === 'function' ? opts.createUrl : function (file) { return URL.createObjectURL(file); },
    revokeUrl: typeof opts.revokeUrl === 'function' ? opts.revokeUrl : function (url) { URL.revokeObjectURL(url); },
    onChange: typeof opts.onChange === 'function' ? opts.onChange : function () {},
    limits: Object.assign({}, INPUT_LIMITS, opts.limits || {}),
    items: [],
    controller: null,
    disposed: false
  };
  return {
    addFiles: function (files) { return addFiles(st, files); },
    remove: function (localId) { return removeItem(st, localId); },
    items: function () { return st.items.slice(); },
    uploadAll: function () { return uploadAll(st); },
    rollback: function () { return rollback(st); },
    markBound: function () { return markBound(st); },
    uploadProgress: function () { return uploadProgress(st); },
    dispose: function () { dispose(st); }
  };
}
