/**
 * Skill 专门页面 · 编辑器适配层
 *
 * 只向页面暴露 `SKILL_MD.mount(target, { markdown, editable, onChange })`；
 * 不把 Milkdown / ProseMirror 的类型、上下文泄漏给业务代码。
 * 只读与编辑共用同一个 7.7.0 运行时包。
 */

  var VENDOR_URL = '/assets/vendor/milkdown/7.7.0/skill-editor.esm.js';
  var vendorPromise = null;

  function loadVendor() {
    if (!vendorPromise) {
      vendorPromise = import(VENDOR_URL).then(function (mod) {
        if (!mod || typeof mod.mount !== 'function') {
          throw new Error('Milkdown 编辑器模块不可用');
        }
        return mod;
      }).catch(function (err) {
        vendorPromise = null;
        throw err;
      });
    }
    return vendorPromise;
  }

  export const SKILL_MD = {
    mount: function (target, opts) {
      if (!target) return Promise.reject(new Error('缺少渲染容器'));
      var options = opts || {};
      if (window.__AGENTFLOW_SKILL_MD__ && typeof window.__AGENTFLOW_SKILL_MD__.mount === 'function') {
        return Promise.resolve(window.__AGENTFLOW_SKILL_MD__.mount(target, options));
      }
      return loadVendor().then(function (mod) {
        return mod.mount(target, {
          markdown: options.markdown == null ? '' : String(options.markdown),
          editable: options.editable === true,
          onChange: typeof options.onChange === 'function' ? options.onChange : null
        });
      });
    },
    destroy: function (handle) {
      if (handle && typeof handle.destroy === 'function') return Promise.resolve(handle.destroy());
      return Promise.resolve();
    }
  };
