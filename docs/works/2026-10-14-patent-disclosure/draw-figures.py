# 工序工件：绘制专利交底书 6 张附图（Pillow，中文字体 Hiragino Sans GB / STHeiti）
# 运行：python3 draw-figures.py  → 输出 figures/fig1..fig6
import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)

FONT_REG = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
_fc = {}


def F(sz, bold=False):
    key = (sz, bold)
    if key not in _fc:
        _fc[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REG, sz, index=0)
    return _fc[key]


# 语义色（与 design/ui-shell.md §5 一致）
BLUE, BLUE_D, BLUE_L = "#1d4ed8", "#1e3a8a", "#dbeafe"
GREEN, GREEN_D, GREEN_L = "#15803d", "#14532d", "#dcfce7"
RED, RED_D, RED_L = "#dc2626", "#7f1d1d", "#fee2e2"
ORANGE, ORANGE_D, ORANGE_L = "#ea580c", "#7c2d12", "#ffedd5"
PURPLE, PURPLE_D, PURPLE_L = "#7c3aed", "#4c1d95", "#ede9fe"
GRAY, GRAY_D, GRAY_L = "#64748b", "#334155", "#e2e8f0"
INK, SLATE, LINE, PAPER = "#0f172a", "#475569", "#cbd5e1", "#ffffff"


def center_text(d, cx, y, s, font, fill=INK):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)


def box(d, x, y, w, h, title, sub=None, fill=BLUE_L, outline=BLUE_D, lw=2,
        radius=10, tsize=22, ssize=17, tfill=None, subfill=SLATE, bold=True):
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill, outline=outline, width=lw)
    tfill = tfill or outline
    if sub:
        tl, sl = F(tsize, bold), F(ssize)
        lh = ssize + 7
        total = tsize + 10 + lh * len(sub)
        ty = y + (h - total) / 2
        center_text(d, x + w / 2, ty, title, tl, tfill)
        yy = ty + tsize + 10
        for sline in sub:
            center_text(d, x + w / 2, yy, sline, sl, subfill)
            yy += lh
    elif title:
        tl = F(tsize, bold)
        th = tsize + 8
        center_text(d, x + w / 2, y + (h - th) / 2, title, tl, tfill)
    return (x, y, w, h)


def chip(d, x, y, s, fill, outline, tsize=16, pad=10, h=30, fill_text=None):
    tf = F(tsize)
    w = d.textlength(s, font=tf) + pad * 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=8, fill=fill, outline=outline, width=1)
    center_text(d, x + w / 2, y + (h - tsize) / 2 - 1, s, tf, fill_text or outline)
    return w


def arrow(d, p1, p2, color=SLATE, lw=3, dashed=False, head=11):
    x1, y1 = p1
    x2, y2 = p2
    if dashed:
        seg_dash(d, x1, y1, x2, y2, color, lw)
    else:
        d.line([x1, y1, x2, y2], fill=color, width=lw)
    ang = math.atan2(y2 - y1, x2 - x1)
    a1 = (x2 - head * math.cos(ang - 0.42), y2 - head * math.sin(ang - 0.42))
    a2 = (x2 - head * math.cos(ang + 0.42), y2 - head * math.sin(ang + 0.42))
    d.polygon([(x2, y2), a1, a2], fill=color)


def seg_dash(d, x1, y1, x2, y2, color, lw, dash=9, gap=6):
    L = math.hypot(x2 - x1, y2 - y1)
    if L == 0:
        return
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    t = 0
    while t < L:
        t2 = min(t + dash, L)
        d.line([x1 + ux * t, y1 + uy * t, x1 + ux * t2, y1 + uy * t2], fill=color, width=lw)
        t = t2 + gap


def elbow(d, pts, color=SLATE, lw=3, dashed=False, head=11):
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        if dashed:
            seg_dash(d, x1, y1, x2, y2, color, lw)
        else:
            d.line([x1, y1, x2, y2], fill=color, width=lw)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    ang = math.atan2(y2 - y1, x2 - x1)
    a1 = (x2 - head * math.cos(ang - 0.42), y2 - head * math.sin(ang - 0.42))
    a2 = (x2 - head * math.cos(ang + 0.42), y2 - head * math.sin(ang + 0.42))
    d.polygon([(x2, y2), a1, a2], fill=color)


def curve_arrow(d, p1, p2, bulge=70, color=PURPLE, lw=3, dashed=True, head=11, label=None, lsz=16):
    """二次贝塞尔弧线箭头；bulge 正负控制凸向（垂直于连线方向）"""
    x1, y1 = p1
    x2, y2 = p2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    cx, cy = mx + nx * bulge, my + ny * bulge
    pts = []
    N = 90
    for i in range(N + 1):
        t = i / N
        bx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2
        by = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2
        pts.append((bx, by))
    seg_acc(d, pts, color, lw, dashed)
    (ax, ay), (bx2, by2) = pts[-3], pts[-1]
    ang = math.atan2(by2 - ay, bx2 - ax)
    a1 = (bx2 - head * math.cos(ang - 0.42), by2 - head * math.sin(ang - 0.42))
    a2 = (bx2 - head * math.cos(ang + 0.42), by2 - head * math.sin(ang + 0.42))
    d.polygon([(bx2, by2), a1, a2], fill=color)
    if label:
        mid = pts[N // 2]
        center_text(d, mid[0], mid[1] - lsz - 4, label, F(lsz), color)


def seg_acc(d, pts, color, lw, dashed, dash=9, gap=6):
    if not dashed:
        d.line(pts, fill=color, width=lw)
        return
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        seg_dash(d, x1, y1, x2, y2, color, lw, dash, gap)


def parallel_band(d, x1, y1, x2, y2, color=GREEN, lw=3, label=None, lsz=16, gapv=7):
    dy = gapv + lw
    for off in (-dy, dy):
        d.line([x1, y1 + off, x2 - 12, y2 + off], fill=color, width=lw)
    d.polygon([(x2, y2 - dy), (x2 - 13, y2 - dy - 9), (x2 - 13, y2 - dy + 9)], fill=color)
    d.polygon([(x2, y2 + dy), (x2 - 13, y2 + dy - 9), (x2 - 13, y2 + dy + 9)], fill=color)
    if label:
        center_text(d, (x1 + x2) / 2, (y1 + y2) / 2 - dy - lsz - 4, label, F(lsz), color)


def note(d, x, y, w, lines, lsz=16, fill="#f8fafc", outline=LINE, title=None, tsize=19, pad=16):
    lh = lsz + 6
    h = pad * 2 + (tsize + 10 if title else 0) + lh * len(lines)
    d.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=fill, outline=outline, width=1)
    yy = y + pad
    if title:
        center_text(d, x + w / 2, yy, title, F(tsize, True), INK)
        yy += tsize + 10
    for s in lines:
        center_text(d, x + w / 2, yy, s, F(lsz), SLATE)
        yy += lh
    return h


def stage_container(d, x, y, w, h, title, note_s=None, outline=BLUE_D, fill="#fbfdff"):
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, outline=outline, width=2, fill=fill)
    d.text((x + 16, y + 10), title, font=F(20, True), fill=outline)
    if note_s:
        nw = d.textlength(note_s, font=F(16))
        d.text((x + w - nw - 16, y + 12), note_s, font=F(16), fill=SLATE)


def node_box(d, x, y, w, h, kind, name, sub=None, expert=None):
    kinds = {
        "start": (GRAY_L, GRAY_D, "◯"),
        "end": (GRAY_L, GRAY_D, "◉"),
        "agent": (BLUE_L, BLUE_D, "▣"),
        "review": (PURPLE_L, PURPLE_D, "✓"),
        "confirm": (ORANGE_L, ORANGE_D, "◇"),
        "fanout": (GREEN_L, GREEN_D, "⇉"),
        "fanin": (GREEN_L, GREEN_D, "◉"),
    }
    fill, outline, icon = kinds[kind]
    d.rounded_rectangle([x, y, x + w, y + h], radius=9, fill=fill, outline=outline, width=2)
    ty = y + 12
    center_text(d, x + w / 2, ty, f"{icon} {name}", F(19, True), outline)
    yy = ty + 27
    if expert:
        center_text(d, x + w / 2, yy, expert, F(15), SLATE)
        yy += 21
    if sub:
        for s in sub:
            center_text(d, x + w / 2, yy, s, F(14), SLATE)
            yy += 19


def lane(d, x, y, w, h, title):
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill="#fbfdff", outline=LINE, width=2)
    d.text((x + 20, y + 14), title, font=F(23, True), fill=INK)


def new_canvas(w, h):
    img = Image.new("RGB", (w, h), PAPER)
    return img, ImageDraw.Draw(img)


def save(img, name):
    img.save(os.path.join(OUT, name))
    print("saved", name)


# ============ 图1 系统总体架构 ============
def fig1():
    W, H = 1900, 1220
    img, d = new_canvas(W, H)

    box(d, 640, 30, 620, 96, "人工用户", ["方案确认 · 校准 · 审视（经工作区文档预览）"],
        fill=ORANGE_L, outline=ORANGE_D)
    arrow(d, (950, 126), (950, 190), color=ORANGE_D, lw=3)
    center_text(d, 1080, 140, "批准 · 驳回 · 意见", F(17), ORANGE_D)

    d.rounded_rectangle([170, 190, 1730, 700], radius=18, fill="#f6f9ff", outline=BLUE_D, width=3)
    center_text(d, 950, 212, "编排服务（代码侧 · 无 LLM 调用）", F(26, True), BLUE_D)
    bw, bh = 730, 200
    box(d, 220, 270, bw, bh, "工作流定义",
        ["节点（绑定专家）+ 有向边", "顺序边 / 评审回退边 / 并行网关", "五类节点 · 阶段分组与准出 · DSL（JSON/YAML）"],
        tsize=23)
    box(d, 950, 270, bw, bh, "编排器",
        ["顺序调度 · 评审指令判定", "不通过 → 固定回退 · 意见经工作区传递", "fan-out 清单拆分与并发调度 · fan-in 聚合"],
        tsize=23)
    box(d, 220, 480, bw, bh, "注册中心（四类资产）",
        ["专家库 · Skill 库", "Harness 池 · 确定性工具库", "Workspace 配置 · 按用途绑定的 Key"],
        fill=PURPLE_L, outline=PURPLE_D, tsize=23)
    box(d, 950, 480, bw, bh, "实例管理",
        ["运行轨迹（状态着色 + 回退弧线）", "控制：终止 / 暂停恢复 / 重试 / 从节点重跑", "三级状态机 · 留痕查询"],
        tsize=23)

    box(d, 130, 860, 760, 300, "Harness 执行设施池",
        ["容器 / 服务器 / 台式机 / 笔记本", "能力标签 · 心跳健康 · 并发配额"],
        fill=GREEN_L, outline=GREEN_D, tsize=24)
    xx = 170
    for s in ["容器", "服务器", "台式机", "笔记本"]:
        xx += chip(d, xx, 992, s, PAPER, GREEN_D) + 12
    box(d, 170, 1040, 680, 96, "", fill=PAPER, outline=LINE)
    center_text(d, 510, 1056, "运行专家 Agent", F(20, True), INK)
    center_text(d, 510, 1086, "Skill 组合 + 工具 + 参考知识（独立上下文）", F(17), SLATE)

    box(d, 1010, 860, 760, 300, "Workspace 工作区（git / 共享文件）",
        ["节点间唯一的信息交互与传递通道", "工作数据全程留痕"],
        fill=BLUE_L, outline=BLUE_D, tsize=23)
    xx = 1050
    for s in ["Agents.md", "知识库索引", "专家/Skill 库目录"]:
        xx += chip(d, xx, 992, s, PAPER, BLUE_D) + 10
    xx = 1050
    for s in ["并行任务目录", "工作留痕 / 产物"]:
        xx += chip(d, xx, 1028, s, PAPER, BLUE_D) + 10
    box(d, 1050, 1072, 680, 64, "", fill=PAPER, outline=LINE)
    center_text(d, 1390, 1082, "标准目录模板 + worktree 隔离（task/{instanceId}/{seq}）", F(17, True), INK)

    elbow(d, [(510, 700), (510, 860)], color=GREEN_D, lw=3)
    center_text(d, 700, 742, "分发任务（按能力标签 / 手动指定）", F(17), GREEN_D)
    arrow(d, (900, 1010), (1010, 1010), color=SLATE, lw=3)
    center_text(d, 955, 972, "读写", F(16), SLATE)
    elbow(d, [(1390, 700), (1390, 860)], color=BLUE_D, lw=3)
    center_text(d, 1560, 742, "读写（唯一信息通道）", F(17), BLUE_D)
    arrow(d, (1200, 700), (620, 852), color=GRAY, lw=2, dashed=True)
    center_text(d, 900, 792, "产物回传 / 执行环境", F(15), GRAY)

    save(img, "fig1-architecture.png")


# ============ 图2 工作流定义模型 ============
def fig2():
    W, H = 1900, 1200
    img, d = new_canvas(W, H)

    stage_container(d, 60, 40, 1480, 420, "阶段分组 · 阶段 01 业务需求分析", "准出：需求完整性符合规范、人工审视达标")
    nw, nh = 190, 92
    y1 = 170
    node_box(d, 100, y1, 130, nh, "start", "开始")
    node_box(d, 280, y1, nw, nh, "agent", "需求获取", expert="专家 e1", sub=["读 /inbox/issues/", "写 draft.md"])
    node_box(d, 520, y1, nw, nh, "agent", "意图识别", expert="专家 e1", sub=["先分类再展开"])
    node_box(d, 760, y1, nw, nh, "review", "需求评审", expert="评审专家 e6", sub=["要点：完整性/粒度/格式"])
    arrow(d, (230, y1 + nh / 2), (280, y1 + nh / 2), color=SLATE)
    arrow(d, (470, y1 + nh / 2), (520, y1 + nh / 2), color=SLATE)
    arrow(d, (710, y1 + nh / 2), (760, y1 + nh / 2), color=SLATE)
    curve_arrow(d, (855, y1 + nh), (375, y1 + nh), bulge=-85, color=PURPLE, dashed=True,
                label="不通过 · 携带评审意见回退（唯一固定目标）· 意见经工作区留痕")
    elbow(d, [(930, y1 + nh), (930, 590), (375, 590), (375, 660)], color=SLATE, lw=3)
    center_text(d, 700, 562, "评审通过 · 顺序下行", F(17), SLATE)

    stage_container(d, 60, 620, 1480, 320, "阶段分组 · 阶段 02 方案设计", "准出：方案完整可落地、核心专家交叉审视")
    y2 = 700
    node_box(d, 280, y2, nw, nh, "agent", "方案设计", expert="专家 e2", sub=["写 design/spec.md"])
    node_box(d, 520, y2, nw, nh, "review", "方案评审", expert="评审专家 e6", sub=["交叉审视：完整/可落地"])
    node_box(d, 760, y2, 200, nh, "confirm", "方案确认 ◇ 人工", sub=["挂起 · 批准下行/驳回回退"])
    node_box(d, 1010, y2, 190, nh, "fanout", "开发任务展开", sub=["清单 task-list.json", "并发上限 50"])
    node_box(d, 1250, y2, 190, nh, "fanin", "开发结果聚合", sub=["聚合策略（三选一）"])
    arrow(d, (470, y2 + nh / 2), (520, y2 + nh / 2), color=SLATE)
    arrow(d, (710, y2 + nh / 2), (760, y2 + nh / 2), color=SLATE)
    arrow(d, (960, y2 + nh / 2), (1010, y2 + nh / 2), color=SLATE)
    parallel_band(d, 1200, y2 + nh / 2, 1250, y2 + nh / 2, color=GREEN, label="N 子任务", lsz=14)
    arrow(d, (1440, y2 + nh / 2), (1580, y2 + nh / 2), color=SLATE)
    node_box(d, 1580, y2, 130, nh, "end", "结束")

    box(d, 1590, 40, 270, 540, "", fill="#fbfdff", outline=LINE)
    center_text(d, 1725, 84, "配置扮演", F(22, True), INK)
    center_text(d, 1725, 116, "（最小节点集）", F(16), GRAY)
    yy = 160
    for t, s1, s2 in [("Re-act 迭代循环", "专家节点 + 评审回退边", "+ 人工确认节点"),
                      ("意图路由", "入口专家节点（意图识别）", "+ 分支工作流配置"),
                      ("人工审批门禁", "人工确认节点挂起", "批准下行 / 驳回回退"),
                      ("大规模并行", "fan-out / fan-in 网关", "清单驱动 · 代码化拆分")]:
        d.rounded_rectangle([1612, yy, 1838, yy + 92], radius=8, fill=PAPER, outline=BLUE_D, width=1)
        center_text(d, 1725, yy + 10, t, F(18, True), BLUE_D)
        center_text(d, 1725, yy + 40, s1, F(14), SLATE)
        center_text(d, 1725, yy + 60, s2, F(14), SLATE)
        yy += 104

    d.rounded_rectangle([1570, 620, 1860, 900], radius=12, fill="#f8fafc", outline=LINE)
    center_text(d, 1715, 640, "三类边", F(20, True), INK)
    d.line([1600, 700, 1700, 700], fill=SLATE, width=3)
    d.polygon([(1710, 700), (1697, 693), (1697, 707)], fill=SLATE)
    d.text((1600, 716), "顺序边（单一后继）", font=F(15), fill=SLATE)
    seg_dash(d, 1600, 760, 1700, 760, PURPLE, 3)
    d.polygon([(1710, 760), (1697, 753), (1697, 767)], fill=PURPLE)
    d.text((1600, 776), "回退边（唯一 · 仅前序）", font=F(15), fill=PURPLE_D)
    d.line([1600, 812, 1700, 805], fill=GREEN, width=3)
    d.line([1600, 819, 1700, 826], fill=GREEN, width=3)
    d.text((1600, 836), "并行带（fan-out→fan-in）", font=F(15), fill=GREEN_D)
    d.text((1600, 866), "执行=蓝 · 评审=紫 · 人工=橙", font=F(13), fill=GRAY)

    note(d, 60, 990, 1800, [
        "五类节点：开始/结束（边界）· 阶段分组（容器）· 专家执行节点（主角色）· 评审/校验节点（独立否决视角）· 人工确认节点（挂起点）· fan-out / fan-in 网关（并行）",
        "静态校验：孤立节点 · 缺开始/结束 · 评审节点缺回退目标 · fan-out 缺清单来源 · 专家节点未绑定专家 · 多出边冲突 —— 发布需校验通过",
        "DSL（JSON/YAML）同源定义：nodes[{id,type,name,expertId,config}] · edges[{from,to,kind:seq|rollback|par}] · stages[...] —— 画布 / DSL 视图同源切换",
    ], lsz=18, title="图注：最小完备集与配置扮演", tsize=22)

    save(img, "fig2-node-model.png")


# ============ 图3 清单驱动的大规模并行 ============
def fig3():
    W, H = 1900, 1150
    img, d = new_canvas(W, H)

    box(d, 60, 380, 360, 240, "上游产物 · 任务清单",
        ["清单来源：design/task-list.json", "按调用链 / 模块 / 文件拆分", "审视套件：魔法数清理、内存释放、", "锁与事务、入口参数校验 ……"],
        fill=BLUE_L, outline=BLUE_D, tsize=22)
    box(d, 490, 400, 250, 200, "fan-out 网关",
        ["代码化拆分（无 LLM）", "分片规则：按清单项 / 表达式", "子任务模板：专家 + Skill", "+ 独立 worktree"],
        fill=GREEN_L, outline=GREEN_D, tsize=22)
    arrow(d, (420, 500), (490, 500), color=SLATE, lw=4)

    box(d, 800, 120, 320, 180, "并发调度队列",
        ["并发上限（默认 50）", "Harness 能力标签 / 配额匹配", "达上限排队（FIFO / 优先级）", "失败自动重试"],
        fill="#f8fafc", outline=GRAY_D, tsize=21)
    elbow(d, [(615, 400), (615, 210), (800, 210)], color=SLATE, lw=3)
    center_text(d, 700, 182, "拆分入队", F(16), SLATE)

    d.rounded_rectangle([800, 360, 1180, 1060], radius=14, fill="#fbfdff", outline=GREEN_D, width=2)
    center_text(d, 990, 378, "子任务（独立上下文 + 独立 worktree）", F(21, True), GREEN_D)
    yy = 425
    tasks = [("子任务 0001", "order/OrderService.java · 魔法数清理", "成功"),
             ("子任务 0002", "quote/QuotePush.java · 内存释放审视", "成功"),
             ("子任务 0003", "clearing/ClearingJob.java · 锁与事务", "重试中"),
             ("子任务 ……", "按清单逐项 ……", "运行中 / 成功 / 失败"),
             ("子任务 2048", "common/MoneyUtil.java · 入口参数", "失败 → 重试")]
    for name, path, st in tasks:
        d.rounded_rectangle([825, yy, 1155, yy + 92], radius=9, fill=PAPER, outline=LINE, width=1)
        center_text(d, 990, yy + 10, name, F(19, True), INK)
        center_text(d, 990, yy + 40, path, F(15), SLATE)
        center_text(d, 990, yy + 63, f"状态：{st} · 结果以 Patch 写回工作区", F(13), GRAY)
        yy += 104
    center_text(d, 990, yy + 8, "示例规模：2,048 子任务 · 执行于 Harness 池（容器/服务器/台式机/笔记本）", F(16), GRAY)
    elbow(d, [(960, 300), (960, 360)], color=SLATE, lw=4)
    center_text(d, 1050, 318, "按配额出队", F(16), SLATE)

    box(d, 1260, 400, 290, 220, "fan-in 网关",
        ["聚合策略（三选一）：", "① 全部完成", "② 失败阈值（如 95%）", "③ 抽样人工审核（抽样数）"],
        fill=GREEN_L, outline=GREEN_D, tsize=22)
    arrow(d, (1180, 500), (1260, 500), color=SLATE, lw=4)

    box(d, 1600, 420, 250, 180, "聚合报告",
        ["写入工作区", "（如 dev/summary.md）", "进入下一节点"],
        fill=BLUE_L, outline=BLUE_D, tsize=22)
    arrow(d, (1550, 500), (1600, 500), color=SLATE, lw=4)

    note(d, 1260, 700, 590, [
        "状态分组统计卡（总数 / 成功 / 失败 / 运行中 / 重试中）",
        "状态分组表 + 抽样明细 50 条分页（ID / 输入摘要 / 状态 / 耗时）",
        "单条子任务详情抽屉：所属 worktree · 日志 · Patch 文件列表",
    ], lsz=17, title="数千规模聚合视图（不逐条平铺）", tsize=20)
    arrow(d, (1480, 620), (1480, 700), color=SLATE, lw=2, dashed=True)

    note(d, 60, 700, 590, [
        "编排器代码化：拆分 / 调度 / 聚合全部确定性代码，",
        "无 LLM 调用 —— 数千级并行不退化（对应缺陷 P-1）",
        "子任务独立上下文 + worktree 隔离，互不污染（P-5）",
        "失败重试与失败阈值兜底，聚合门禁质量可控",
    ], lsz=17, title="设计要点", tsize=20)

    save(img, "fig3-parallel.png")


# ============ 图4 三级状态机 ============
def fig4():
    W, H = 1900, 1380
    img, d = new_canvas(W, H)

    lane(d, 60, 40, 1780, 560, "实例状态（Instance）")
    y0 = 220
    nw, nh = 170, 84
    box(d, 120, y0, nw, nh, "排队", fill=GRAY_L, outline=GRAY_D, tsize=21)
    box(d, 380, y0, nw, nh, "运行中", fill=BLUE_L, outline=BLUE_D, tsize=21)
    box(d, 700, 100, 220, 84, "等待人工确认", fill=ORANGE_L, outline=ORANGE_D, tsize=20)
    box(d, 700, 350, 220, 84, "回退重跑中", fill=PURPLE_L, outline=PURPLE_D, tsize=20)
    box(d, 700, 480, 220, 84, "已暂停", fill=GRAY_L, outline=GRAY_D, tsize=20)
    box(d, 1020, 140, 160, 84, "成功", fill=GREEN_L, outline=GREEN_D, tsize=21)
    box(d, 1020, 300, 160, 84, "失败", fill=RED_L, outline=RED_D, tsize=21)
    box(d, 1020, 480, 160, 84, "已终止", fill=GRAY_L, outline=GRAY_D, tsize=21)

    arrow(d, (290, y0 + nh / 2), (380, y0 + nh / 2), color=SLATE, lw=3)
    arrow(d, (465, y0), (760, 184), color=ORANGE_D, lw=3)
    center_text(d, 600, 140, "挂起", F(16), ORANGE_D)
    arrow(d, (860, 184), (530, y0), color=ORANGE_D, lw=3)
    center_text(d, 970, 160, "批准下行", F(16), ORANGE_D)
    arrow(d, (900, 184), (880, 350), color=ORANGE_D, lw=3)
    center_text(d, 955, 265, "驳回", F(16), ORANGE_D)
    arrow(d, (530, y0 + 86), (700, 380), color=PURPLE, lw=3)
    center_text(d, 545, 345, "评审不通过", F(16), PURPLE_D)
    elbow(d, [(700, 392), (490, 392), (490, y0 + 84)], color=PURPLE, lw=3)
    center_text(d, 600, 364, "重跑完成", F(16), PURPLE_D)
    elbow(d, [(440, y0 + 84), (440, 512), (700, 512)], color=GRAY_D, lw=3)
    center_text(d, 395, 460, "暂停", F(16), GRAY_D)
    elbow(d, [(700, 532), (480, 532), (480, y0 + 84)], color=GRAY_D, lw=3)
    center_text(d, 515, 460, "恢复", F(16), GRAY_D)
    arrow(d, (550, y0 + 25), (1020, 182), color=GREEN, lw=3)
    arrow(d, (550, y0 + 60), (1020, 342), color=RED, lw=3)
    arrow(d, (920, 522), (1020, 522), color=GRAY_D, lw=3)
    center_text(d, 1215, 175, "到结束节点 → 成功", F(16), GREEN_D)
    center_text(d, 1215, 335, "门禁未过 → 失败", F(16), RED_D)
    center_text(d, 1215, 515, "超时 / 人工异常终止（进行中子任务取消）", F(16), GRAY_D)

    lane(d, 60, 640, 1780, 220, "节点状态（Node）")
    yy = 700
    xx = 120
    for s, f, o in [("待执行", GRAY_L, GRAY_D), ("运行中", BLUE_L, BLUE_D), ("成功", GREEN_L, GREEN_D),
                    ("失败", RED_L, RED_D), ("等待人工", ORANGE_L, ORANGE_D), ("已跳过", GRAY_L, GRAY_D),
                    ("触发回退", PURPLE_L, PURPLE_D)]:
        xx += chip(d, xx, yy, s, f, o, tsize=18, h=40) + 16
    d.text((120, yy + 58), "节点按状态着色渲染于只读轨迹图（复用编辑器画布）：运行中蓝+脉冲 / 等待人工橙 / 成功绿 / 失败红 / 已跳过灰斜纹 / 触发回退紫描边；回退弧线标注「回退×N」",
           font=F(16), fill=SLATE)

    lane(d, 60, 900, 1780, 220, "子任务状态（fan-out Subtask）")
    yy = 960
    xx = 120
    for s, f, o in [("待调度", GRAY_L, GRAY_D), ("运行中", BLUE_L, BLUE_D), ("成功", GREEN_L, GREEN_D),
                    ("失败", RED_L, RED_D), ("重试中", ORANGE_L, ORANGE_D)]:
        xx += chip(d, xx, yy, s, f, o, tsize=18, h=40) + 16
    d.text((120, yy + 58), "子任务由编排器按并发上限与 Harness 配额排队调度；失败自动重试；fan-in 按「全部完成 / 失败阈值 / 抽样人工审核」聚合",
           font=F(16), fill=SLATE)

    lane(d, 60, 1160, 1780, 180, "运行控制（实例列表 + 详情）")
    yy = 1212
    xx = 120
    for s, f, o in [("暂停 / 恢复", BLUE_L, BLUE_D), ("异常终止（二次确认）", RED_L, RED_D),
                    ("失败节点重试", GREEN_L, GREEN_D), ("从指定节点重跑（警示后续作废）", PURPLE_L, PURPLE_D),
                    ("留痕查看（IO / 日志 / diff）", GRAY_L, GRAY_D)]:
        xx += chip(d, xx, yy, s, f, o, tsize=17, h=40) + 14

    save(img, "fig4-state-machine.png")


# ============ 图5 资产注册体系 ============
def fig5():
    W, H = 1900, 1120
    img, d = new_canvas(W, H)

    box(d, 640, 40, 620, 130, "工作流节点（编排时绑定）",
        ["绑定专家 · Skill 组合继承/增删", "Harness 按能力标签自动 / 手动指定", "授权工具清单 · 注入分层知识索引"],
        fill=BLUE_L, outline=BLUE_D, tsize=23)

    d.rounded_rectangle([80, 280, 640, 720], radius=14, fill=PURPLE_L, outline=PURPLE_D, width=2)
    center_text(d, 360, 302, "专家模板（固化专家模板）", F(24, True), PURPLE_D)
    d.rounded_rectangle([110, 356, 610, 506], radius=10, fill=PAPER, outline=LINE)
    center_text(d, 360, 368, "固定部分", F(20, True), INK)
    center_text(d, 360, 402, "角色 / 性格描述 · 关注视角 · 性格标签", F(17), SLATE)
    center_text(d, 360, 430, "色块头像标识色（画布 / 实例复用）", F(17), SLATE)
    center_text(d, 360, 466, "任务变动部分（见下）", F(16), GRAY)
    d.rounded_rectangle([110, 520, 610, 690], radius=10, fill=PAPER, outline=LINE)
    center_text(d, 360, 532, "任务变动部分", F(20, True), INK)
    for i, s in enumerate(["Skill 组合（有序 · 可增删排序）", "工具清单（只读引用）", "主要工作内容（渐进披露）",
                           "参考知识（含运行期经工作区注入）"]):
        center_text(d, 360, 566 + i * 26, s, F(16), SLATE)
    center_text(d, 360, 700, "评审复用：绑定到评审节点即承担独立否决视角", F(16), PURPLE_D)

    box(d, 80, 820, 560, 250, "Skill 资产（渐进式披露）",
        ["① 常驻摘要 ≤200 字（路由触发）", "② 工作内容折叠章节：总述 / 步骤 / 案例 /",
         "　　脚本指南 / 完成验证方案（按需加载）", "③ 踩坑禁令（红色警示·置顶）④ 参考引用 ⑤ 版本"],
        fill="#fbfdff", outline=SLATE, tsize=22, ssize=16)

    d.rounded_rectangle([700, 280, 1240, 720], radius=14, fill=GREEN_L, outline=GREEN_D, width=2)
    center_text(d, 970, 302, "Harness 执行设施", F(24, True), GREEN_D)
    for i, s in enumerate(["四类：容器 / 服务器 / 台式机 / 笔记本", "接入方式：常驻 Agent / SSH / 容器注册（连接测试）",
                           "能力标签 chips —— 节点「按标签自动」调度匹配", "心跳健康：超时 60s 判离线 · 高负载=负载≥80%",
                           "并发配额：上限 + 排队策略（FIFO / 优先级）", "当前任务表（子任务 / 所属实例与节点 / 耗时）"]):
        center_text(d, 970, 356 + i * 38, s, F(17), SLATE)
    box(d, 740, 636, 460, 56, "", fill=PAPER, outline=LINE)
    center_text(d, 970, 648, "专家以独立上下文运行于 Harness 上", F(17, True), GREEN_D)

    box(d, 700, 820, 540, 250, "确定性工具资产（MCP / CLI / 脚本）",
        ["注册：调用模板（{} 参数占位）+ 参数定义 + 超时", "生命周期：未验证 → 调试抽屉运行 → 可用",
         "　　（终端样式输出 + 退出码 + 最近 5 次记录）", "原则：能用工具解决的不依赖模型 · 被引用禁删"],
        fill="#fbfdff", outline=SLATE, tsize=22, ssize=16)

    box(d, 1330, 280, 520, 250, "Workspace 工作区",
        ["标准目录模板：Agents.md · knowledge/", "experts/ · skills/ · tasks/2025-*/",
         "worktree 命名模板 {instanceId}/{seq}", "节点间唯一信息通道 · 全程留痕"],
        fill=BLUE_L, outline=BLUE_D, tsize=22, ssize=16)
    box(d, 1330, 590, 520, 220, "按用途绑定的 Key",
        ["git ssh-key（SHA256 指纹掩码）", "LLM API Key（多供应商 · 掩码后 4 位）",
         "绑定：工作区 ×N / Harness ×N / 专家调用 ×N", "有效性校验 · 完整值加密不可回显"],
        fill=ORANGE_L, outline=ORANGE_D, tsize=22, ssize=16)

    elbow(d, [(360, 280), (360, 170), (640, 105)], color=PURPLE_D, lw=3)
    center_text(d, 470, 190, "节点绑定专家", F(17), PURPLE_D)
    elbow(d, [(970, 280), (970, 170), (1260, 105)], color=GREEN_D, lw=3)
    center_text(d, 1090, 190, "节点分配 Harness", F(17), GREEN_D)
    arrow(d, (560, 820), (400, 722), color=PURPLE_D, lw=3)
    center_text(d, 580, 770, "Skill 组合引用", F(16), PURPLE_D)
    elbow(d, [(700, 900), (660, 900), (660, 760), (640, 760)], color=SLATE, lw=2, dashed=True)
    center_text(d, 780, 790, "工具清单引用", F(15), SLATE)
    arrow(d, (1240, 620), (1330, 480), color=SLATE, lw=2, dashed=True)
    center_text(d, 1300, 540, "产物落盘", F(15), SLATE)
    arrow(d, (1590, 590), (1590, 532), color=ORANGE_D, lw=2)
    center_text(d, 1700, 556, "凭证关联 / 按用途绑定", F(15), ORANGE_D)
    arrow(d, (1590, 810), (970, 722), color=ORANGE_D, lw=2, dashed=True)
    center_text(d, 1310, 780, "Harness 专用 Key（如波谷批量审视）", F(15), ORANGE_D)

    note(d, 1330, 900, 520, [
        "四类资产统一注册、组合复用、引用计数治理；",
        "专家 / Skill / 工具被引用时禁删并提示；",
        "知识索引分层：业务域 → 价值流 → 场景 → 代码入口，",
        "节点运行期注入 + SVO 锚点（防大海捞针）。",
    ], lsz=17, title="复用与治理", tsize=20)

    save(img, "fig5-assets.png")


# ============ 图6 编排方法主流程 ============
def fig6():
    W, H = 1500, 1260
    img, d = new_canvas(W, H)

    cx = 750
    bw, bh = 900, 96

    def step(y, title, sub, fill=BLUE_L, outline=BLUE_D):
        box(d, cx - bw / 2, y, bw, bh, title, sub, fill=fill, outline=outline, tsize=22, ssize=16)
        return (y, y + bh)

    y0 = 30
    box(d, cx - 430, y0, 860, 96, "发起运行",
        ["已发布工作流版本 + 已初始化工作区 + 备注（三元组绑定，保证可复现）"],
        fill=GREEN_L, outline=GREEN_D, tsize=24, ssize=17)
    arrow(d, (cx, y0 + 96), (cx, y0 + 150), color=SLATE, lw=3)

    yy = y0 + 150
    step(yy, "S1 装载与建实例", ["装载工作流 DSL（nodes / edges / stages）· 静态校验 · 创建实例（排队 → 运行中）"])
    arrow(d, (cx, yy + bh), (cx, yy + bh + 40), color=SLATE, lw=3)
    yy += bh + 40
    step(yy, "S2 顺序调度 · 按节点类型分发", ["沿顺序边依次调度 · 专家节点 / 评审节点 / 并行网关 / 人工确认节点四类分发"])
    arrow(d, (cx, yy + bh), (cx, yy + bh + 40), color=SLATE, lw=3)
    yy += bh + 40

    fw, fh = 340, 260
    gap = 24
    fx0 = cx - (fw * 4 + gap * 3) / 2
    fy = yy + 60
    branches = [
        ("S3 专家执行节点", ["装配：固定部分 + Skill 组合", "+ 授权工具 + 知识索引注入", "+ 收敛约束（格式 / 上下文上限）",
                        "声明式输入读取 → 执行 →", "声明式输出写入工作区", "Harness 标签匹配（不足排队）"], BLUE_L, BLUE_D),
        ("S4 评审 / 校验节点", ["独立否决视角 · 按要点判定", "通过 → 顺序下行", "不通过 → 携带评审意见回退",
                          "唯一固定回退目标重跑", "意见写入工作区留痕", "轨迹标注「回退×N」"], PURPLE_L, PURPLE_D),
        ("S5 并行网关", ["fan-out：清单代码化拆分", "子任务独立上下文 + worktree", "并发上限 + 配额调度 · 重试",
                    "fan-in：全部完成 / 失败阈值", "　或 抽样人工审核", "聚合报告写入工作区"], GREEN_L, GREEN_D),
        ("S6 人工确认节点", ["方案先写入工作区", "实例挂起（等待人工确认）", "批准（意见选填）→ 下行",
                        "驳回（意见必填）→ 回退", "超时：提醒 / 自动终止", "列表角标 + 通知联动"], ORANGE_L, ORANGE_D),
    ]
    center_text(d, cx, yy + 16, "按节点类型分发", F(19, True), INK)
    for i, (t, subs, f, o) in enumerate(branches):
        fx = fx0 + i * (fw + gap)
        elbow(d, [(cx, yy + bh), (cx, yy + bh + 36), (fx + fw / 2, yy + bh + 36), (fx + fw / 2, fy)], color=SLATE, lw=3)
        box(d, fx, fy, fw, fh, t, subs, fill=f, outline=o, tsize=21, ssize=15)
        elbow(d, [(fx + fw / 2, fy + fh), (fx + fw / 2, fy + fh + 36), (cx, fy + fh + 36), (cx, fy + fh + 60)],
              color=SLATE, lw=3)

    yy = fy + fh + 60
    step(yy, "S7 状态机迁移与全程留痕",
         ["实例 / 节点 / 子任务三级状态实时迁移 · 执行日志 · 节点输入输出 · 工作区变更文件树与 diff"])
    arrow(d, (cx, yy + bh), (cx, yy + bh + 40), color=SLATE, lw=3)
    yy += bh + 40
    step(yy, "S8 终态与运营汇聚",
         ["到结束节点 → 成功 / 失败 / 已终止 · 准出记录汇总 · Skill 审计（被跳过 / 自我冲突 / 老化）· 知识索引更新工作流"])
    arrow(d, (cx, yy + bh), (cx, yy + bh + 44), color=SLATE, lw=3)
    yy += bh + 44
    box(d, cx - 450, yy, 900, 110, "质量收敛",
        ["最终依靠 DevOps 验证（黄金标准：验证代码 / 数据 / 预期结果）", "人工确认与收敛约束只做辅助收敛 · 治理闭环防技能老化"],
        fill=GRAY_L, outline=GRAY_D, tsize=23, ssize=17)

    save(img, "fig6-method-flow.png")


if __name__ == "__main__":
    fig1()
    fig2()
    fig3()
    fig4()
    fig5()
    fig6()
    print("all figures done ->", OUT)
