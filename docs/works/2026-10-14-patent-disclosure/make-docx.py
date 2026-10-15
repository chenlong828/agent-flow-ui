# 工序工件：把 patent-disclosure.md 转换为排版良好的 Word 交底书
# 中文显式设置 w:eastAsia 字体；标题黑体 / 正文宋体 / 代码 Consolas；表格 Table Grid + 表头底纹
import os
import re

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, "patent-disclosure.md")
OUT = os.path.join(HERE, "AgentFlow-专利交底书-v1.0.docx")

INK = RGBColor(0x0F, 0x17, 0x2A)
GRAY = RGBColor(0x64, 0x74, 0x8B)
HEAD_FILL = "E8EDFB"
INFO_FILL = "F6F9FF"
CODE_FILL = "F4F4F5"


def set_cn(run, size=11, bold=False, east="宋体", latin="Cambria", color=None):
    run.font.name = latin
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color if color else INK
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), east)


def add_cn(p, text, **kw):
    run = p.add_run(text)
    set_cn(run, **kw)
    return run


CODE_SPLIT = re.compile(r"(`[^`]+`)")
BOLD_SPLIT = re.compile(r"(\*\*.*?\*\*)")


def add_inline(p, text, size=11, east="宋体", latin="Cambria", color=None, base_bold=False):
    for seg in BOLD_SPLIT.split(text):
        if not seg:
            continue
        if seg.startswith("**") and seg.endswith("**") and len(seg) > 4:
            inner = seg[2:-2]
            for part in CODE_SPLIT.split(inner):
                if not part:
                    continue
                if part.startswith("`") and part.endswith("`"):
                    add_cn(p, part[1:-1], size=size - 0.5, east=east, latin="Consolas", color=color)
                else:
                    add_cn(p, part, size=size, bold=True, east=east, latin=latin, color=color)
        else:
            for part in CODE_SPLIT.split(seg):
                if not part:
                    continue
                if part.startswith("`") and part.endswith("`"):
                    add_cn(p, part[1:-1], size=size - 0.5, east=east, latin="Consolas", color=color)
                else:
                    add_cn(p, part, size=size, bold=base_bold, east=east, latin=latin, color=color)


def shade_p(p, fill):
    ppr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    ppr.append(shd)


def shade_cell(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def is_sep_row(row):
    cells = [c.strip() for c in row.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", c) for c in cells)


def split_row(row):
    return [c.strip() for c in row.strip().strip("|").split("|")]


def restyle_heading(p, level):
    sizes = {1: 16, 2: 14, 3: 13}
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(6)
    for run in p.runs:
        set_cn(run, size=sizes.get(level, 12), bold=True, east="黑体", latin="Calibri", color=INK)


def main():
    with open(MD, encoding="utf-8") as f:
        lines = f.read().splitlines()

    doc = Document()
    # A4 页面
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin, sec.bottom_margin = Cm(2.4), Cm(2.2)

    # 样式基线
    normal = doc.styles["Normal"]
    normal.font.name = "Cambria"
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.paragraph_format.line_spacing = 1.28
    normal.paragraph_format.space_after = Pt(4)

    cp = doc.core_properties
    cp.title = "AgentFlow 专利技术交底书 v1.0"
    cp.author = "陈龙"
    cp.subject = "基于代码化编排与工作区唯一信道的研发智能体系统及方法"

    i = 0
    # 跳过 YAML frontmatter
    if lines and lines[0].strip() == "---":
        i = 1
        while i < len(lines) and lines[i].strip() != "---":
            i += 1
        i += 1

    total = len(lines)
    while i < total:
        line = lines[i]
        s = line.strip()

        if not s or s == "---":
            i += 1
            continue

        # 标题
        if s.startswith("# ") and not s.startswith("##"):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            add_cn(p, s[2:], size=22, bold=True, east="黑体", latin="Calibri")
            p.paragraph_format.space_after = Pt(10)
            i += 1
            continue

        # 信息块（紧随标题的 > 行合并为一段）
        if s.startswith(">"):
            p = doc.add_paragraph()
            shade_p(p, INFO_FILL)
            p.paragraph_format.left_indent = Cm(0.4)
            p.paragraph_format.space_before = Pt(6)
            first = True
            while i < total and lines[i].strip().startswith(">"):
                t = lines[i].strip().lstrip(">").strip()
                if not first:
                    p.runs[-1].add_break()
                add_inline(p, t, size=10, color=GRAY)
                first = False
                i += 1
            continue

        # 分级标题
        m = re.match(r"^(#{2,4})\s+(.*)$", s)
        if m:
            level = len(m.group(1)) - 1  # ## → 1
            p = doc.add_heading(m.group(2), level=level)
            restyle_heading(p, level)
            i += 1
            continue

        # 代码块（合并为一段，软换行保持底纹连续）
        if s.startswith("```"):
            code_lines = []
            i += 1
            while i < total and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            shade_p(p, CODE_FILL)
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(8)
            for j, cl in enumerate(code_lines):
                if j:
                    p.runs[-1].add_break()
                add_cn(p, cl if cl else " ", size=9, east="宋体", latin="Consolas")
            continue

        # 图片
        m = re.match(r"^!\[(.*?)\]\((.*?)\)\s*$", s)
        if m:
            path = os.path.join(HERE, m.group(2))
            if os.path.exists(path):
                doc.add_picture(path, width=Cm(16.2))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                doc.paragraphs[-1].paragraph_format.space_before = Pt(8)
            i += 1
            continue

        # 图注（独立加粗「图N …」行）
        if re.fullmatch(r"\*\*图\d+.*\*\*", s):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(10)
            add_inline(p, s, size=10.5, base_bold=True, color=GRAY)
            i += 1
            continue

        # 表格
        if s.startswith("|"):
            rows = []
            while i < total and lines[i].strip().startswith("|"):
                rows.append(lines[i])
                i += 1
            body = [r for r in rows if not is_sep_row(r)]
            if not body:
                continue
            header = split_row(body[0])
            table = doc.add_table(rows=len(body), cols=len(header))
            table.style = "Table Grid"
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            for r_idx, r_text in enumerate(body):
                cells = split_row(r_text)
                for c_idx in range(len(header)):
                    cell = table.cell(r_idx, c_idx)
                    text = cells[c_idx] if c_idx < len(cells) else ""
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_after = Pt(2)
                    if r_idx == 0:
                        shade_cell(cell, HEAD_FILL)
                        add_inline(p, text, size=10.5, base_bold=True, east="黑体")
                    else:
                        add_inline(p, text, size=10.5)
                        if r_idx % 2 == 0:
                            shade_cell(cell, "FAFBFF")
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
            continue

        # 列表（编号/短横均保留字面前缀）
        if re.match(r"^(-\s+|\d+\.\s+)", s):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.5)
            p.paragraph_format.first_line_indent = Cm(-0.0)
            add_inline(p, s, size=11)
            i += 1
            continue

        # 普通段落
        p = doc.add_paragraph()
        add_inline(p, s, size=11)
        i += 1

    doc.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
