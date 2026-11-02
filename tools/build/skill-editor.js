/**
 * AgentFlow · Skill 编辑器运行时（Milkdown 7.7.0 单包）
 *
 * 只读与编辑共用一套装配：commonmark + gfm + history + listener + prism + clipboard + trailing。
 * 对外只暴露 mount()，不把 Milkdown / ProseMirror 的类型泄漏给页面。
 *
 * 4 空格列表序列化参考 md_preview（MIT License, Copyright (c) 2024 md_preview authors）
 * 的 list-indent.js，按本页需要裁剪。
 */
import {
    Editor,
    rootCtx,
    defaultValueCtx,
    editorViewCtx,
    editorViewOptionsCtx,
    remarkStringifyOptionsCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm, insertTableCommand } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { prism } from '@milkdown/plugin-prism';
import { clipboard } from '@milkdown/plugin-clipboard';
import { getMarkdown, replaceAll } from '@milkdown/utils';

/** 任务列表复选框 + 每级 4 空格缩进的 listItem 序列化。 */
function fourSpaceListItem(node, parent, state, info) {
    const head = node.children && node.children[0];
    const checkable = typeof node.checked === 'boolean' && head && head.type === 'paragraph';
    const checkbox = '[' + (node.checked ? 'x' : ' ') + '] ';
    const tracker = state.createTracker(info);
    if (checkable) tracker.move(checkbox);
    let value = indentFourSpaces(node, parent, state, checkable ? { ...info, ...tracker.current() } : info);
    if (checkable) {
        value = value.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, ($0) => $0 + checkbox);
    }
    return value;
}

function indentFourSpaces(node, parent, state, info) {
    let bullet = state.bulletCurrent === undefined ? '-' : state.bulletCurrent;
    if (parent && parent.type === 'list' && parent.ordered) {
        const start = typeof parent.start === 'number' && parent.start > -1 ? parent.start : 1;
        const step = state.options.incrementListMarker === false ? 0 : parent.children.indexOf(node);
        bullet = String(start + step) + bullet;
    }
    const size = Math.max(4, bullet.length + 1);
    const tracker = state.createTracker(info);
    tracker.move(bullet + ' ');
    tracker.shift(size);
    const exit = state.enter('listItem');
    const value = state.indentLines(
        state.containerFlow(node, tracker.current()),
        (line, index, blank) => {
            if (index === 0) return (blank ? bullet : bullet + ' ') + line;
            return (blank ? '' : ' '.repeat(size)) + line;
        },
    );
    exit();
    return value;
}

export async function mount(el, options) {
    if (!el) throw new Error('缺少挂载容器');
    const opts = options || {};
    const editable = opts.editable !== false;
    const editor = await Editor.make()
        .config((ctx) => {
            ctx.set(rootCtx, el);
            ctx.set(defaultValueCtx, String(opts.markdown == null ? '' : opts.markdown));
            ctx.update(editorViewOptionsCtx, (prev) => ({
                ...prev,
                editable: () => editable,
                attributes: {
                    ...(prev.attributes || {}),
                    class: 'sk-editor-view',
                    spellcheck: 'false',
                },
            }));
            ctx.update(remarkStringifyOptionsCtx, (prev) => ({
                ...prev,
                bullet: '-',
                emphasis: '*',
                strong: '*',
                handlers: { ...(prev.handlers || {}), listItem: fourSpaceListItem },
            }));
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(prism)
        .use(clipboard)
        .create();

    editor.action((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            if (typeof opts.onChange === 'function') opts.onChange(markdown);
        });
    });

    return {
        getMarkdown: () => editor.action(getMarkdown()),
        setMarkdown: (markdown) => { editor.action(replaceAll(String(markdown == null ? '' : markdown))); },
        insertTable: (size) => { editor.action(insertTableCommand(size || { row: 3, col: 3 })); },
        focus: () => { editor.action((ctx) => ctx.get(editorViewCtx).focus()); },
        destroy: () => { const done = editor.destroy(); return done && done.then ? done : Promise.resolve(); },
    };
}
