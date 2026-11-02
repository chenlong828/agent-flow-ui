/**
 * 同源 HTTP 传输层（L0）
 *
 * 只做 fetch、JSON 编解码、If-Match 与错误归一；不承载业务规则、不做重试、不吞错。
 * B3 工作流数据层复用本模块；B1 资产页仍走 assets/js/api.js 的 ETag/文档缓存逻辑。
 */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || ('HTTP ' + status));
    this.name = 'ApiError';
    this.status = status;
    this.code = code || (status === 0 ? 'network_error' : 'http_error');
    this.details = details || null;
    this.issues = normalizeIssues(details);
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIssues(details) {
  if (!isObject(details)) return [];
  if (Array.isArray(details.issues)) return details.issues.slice();
  if (isObject(details.fieldErrors)) {
    return Object.keys(details.fieldErrors).map(function (path) {
      return { code: 'field_error', path: path, message: String(details.fieldErrors[path]) };
    });
  }
  return [];
}

function parse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (err) { return null; }
}

function errorFrom(status, data) {
  const body = isObject(data) && isObject(data.error) ? data.error : data;
  const details = isObject(body) && isObject(body.details) ? body.details : null;
  return new ApiError(
    status,
    isObject(body) && typeof body.code === 'string' ? body.code : undefined,
    isObject(body) && typeof body.message === 'string' ? body.message : undefined,
    details
  );
}

function headersFor(opts) {
  const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
  if (opts.body !== undefined && !(typeof FormData !== 'undefined' && opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.ifMatch !== undefined && opts.ifMatch !== null) {
    const raw = String(opts.ifMatch).replace(/^"|"$/g, '');
    headers['If-Match'] = '"' + raw + '"';
  }
  return headers;
}

async function send(opts) {
  if (typeof fetch !== 'function') {
    throw new ApiError(0, 'network_error', '当前环境不支持 fetch');
  }
  const init = {
    method: opts.method || 'GET',
    headers: headersFor(opts),
    signal: opts.signal
  };
  if (opts.body !== undefined) {
    init.body = (typeof FormData !== 'undefined' && opts.body instanceof FormData)
      ? opts.body
      : JSON.stringify(opts.body);
  }
  try {
    return await fetch(opts.path, init);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', '无法连接后端');
  }
}

/** 发请求并返回解析后的 JSON；204 返回 null。 */
export async function request(opts) {
  const res = await send(opts);
  const text = await res.text();
  const data = parse(text);
  if (!res.ok) throw errorFrom(res.status, data);
  return data;
}

/** 发请求并返回原始文本 + 响应头；用于 DSL 导出等非 JSON 响应。 */
export async function requestText(opts) {
  const res = await send(opts);
  const text = await res.text();
  if (!res.ok) throw errorFrom(res.status, parse(text));
  return { text: text, headers: res.headers };
}
