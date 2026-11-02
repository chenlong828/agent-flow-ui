/** DSL 只读视图。 */
import { DF } from '../../ui.js';

const { esc, icon } = DF;

export function dslHtml(text) {
  return '<div class="card we-dsl">' +
    '<div class="card-h">DSL 只读预览（本地未保存图）<span style="flex:1"></span>' +
    '<button class="btn sm" id="dsl-copy">' + icon('copy', 12) + '复制</button>' +
    '<button class="btn sm" id="dsl-json">' + icon('download', 12) + '导出 JSON</button>' +
    '<button class="btn sm" id="dsl-yaml">' + icon('download', 12) + '导出 YAML</button></div>' +
    '<div class="code-block" style="border:none;border-radius:0;max-height:none">' + esc(text) + '</div></div>';
}
