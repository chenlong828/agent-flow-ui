/**
 * Skill 专门页面 · 编辑器适配层
 *
 * 只向页面暴露 `SKILL_MD.mount(target, { markdown, editable, onChange })`；
 * 实际加载与窗口注入钩子统一在 shared/markdown-editor.js，只读与编辑共用同一个 7.7.0 运行时包。
 */

import { mountMarkdown, destroyMarkdown } from '../shared/markdown-editor.js';

export const SKILL_MD = {
  mount: function (target, opts) {
    return mountMarkdown(target, opts);
  },
  destroy: function (handle) {
    return destroyMarkdown(handle);
  }
};
