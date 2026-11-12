/**
 * Milkdown 7.7.0 编辑器适配层（共享）
 *
 * 只向页面暴露 `mountMarkdown(target, options)` / `destroyMarkdown(handle)`；
 * Milkdown 与 ProseMirror 的类型、上下文、错误不越过本层。
 * 运行时包走 assets/vendor 准入清单（见 docs/design/dependencies.md），不依赖 CDN。
 * 测试可通过 window.__AGENTFLOW_SKILL_MD__ 注入替身。
 */

const VENDOR_URL = '/assets/vendor/milkdown/7.7.0/skill-editor.esm.js';
let vendorPromise = null;

function loadVendor() {
  if (!vendorPromise) {
    vendorPromise = import(VENDOR_URL).then(function (mod) {
      if (!mod || typeof mod.mount !== 'function') throw new Error('Milkdown 编辑器模块不可用');
      return mod;
    }).catch(function (err) {
      vendorPromise = null;
      throw err;
    });
  }
  return vendorPromise;
}

export function mountMarkdown(target, options) {
  if (!target) return Promise.reject(new Error('缺少渲染容器'));
  const opts = options || {};
  const injected = window.__AGENTFLOW_SKILL_MD__;
  if (injected && typeof injected.mount === 'function') {
    return Promise.resolve(injected.mount(target, opts));
  }
  return loadVendor().then(function (mod) {
    return mod.mount(target, {
      markdown: opts.markdown == null ? '' : String(opts.markdown),
      editable: opts.editable === true,
      onChange: typeof opts.onChange === 'function' ? opts.onChange : null
    });
  });
}

export function destroyMarkdown(handle) {
  if (handle && typeof handle.destroy === 'function') return Promise.resolve(handle.destroy());
  return Promise.resolve();
}
