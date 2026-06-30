"""Generate native draw.io companions for non-chart chapter figures.

The course uses Python for quantitative plots.  Process diagrams, gates, cards,
matrices, ladders, and path illustrations should also have an editable draw.io
source instead of a draw.io file that only embeds the rendered PNG.
"""

from __future__ import annotations

from dataclasses import dataclass
import html
from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
V2 = ROOT / "docs" / "v2"


DIAGRAM_KEYWORDS = {
    "audit",
    "boundary",
    "card",
    "checklist",
    "completeness",
    "contract",
    "coverage",
    "dashboard",
    "decision",
    "fallback",
    "field",
    "flow",
    "gate",
    "inventory",
    "ladder",
    "loop",
    "map",
    "matrix",
    "package",
    "path",
    "recovery",
    "route",
    "rubric",
    "scenario",
    "stack",
    "status",
    "steps",
    "timeline",
    "traceability",
    "verification",
}

SPECIAL_FLOWS: dict[str, dict[str, object]] = {
    "chapter-14-pollution-gate": {
        "steps": [
            ("输入", "行情 链上 新闻 策略代码", "#2563EB"),
            ("污染门禁", "幻觉诱因 提示注入 未来信息", "#F59E0B"),
            ("结构输出", "JSON signal reason", "#0F9B8E"),
            ("复核", "来源 时间 证据", "#7C3AED"),
            ("决定", "继续 复测 拒绝", "#DC2626"),
        ],
        "warning": "污染样本在进入结论前停止；如果已进入回测样本，相关实验记录作废并重建。",
    },
}

CHART_ONLY = {
    "action-distribution",
    "age-history",
    "backtest-combo",
    "breakout-signal-equity",
    "cpcv",
    "cost-preset-chart",
    "cost-sensitivity",
    "courseware-coverage",
    "dsr-vs-trials",
    "equity-drawdown",
    "event-trace-waterfall",
    "factor-metrics",
    "false-positive-curve",
    "golden-cross-signal",
    "indicator-chart",
    "leakage-inflates-metrics",
    "llm-execution-curve",
    "ma-crossover-trades",
    "market-ticker-volume",
    "metric-consistency-chart",
    "metrics-comparison",
    "opportunity-score-chart",
    "pairs-zscore",
    "parameter-sensitivity",
    "pollution-cases",
    "prompt-version-comparison",
    "rank-tradeoff",
    "risk-backlog-priority",
    "robustness-cpcv",
    "rule-llm-comparison",
    "sample-score-matrix",
    "sample-version-grid",
    "sector-inflow-chart",
    "sharpe",
    "strategy-compare-chart",
    "ticker-volume",
    "trial-ledger-sources",
    "walkforward",
    "windows-wfo-chart",
}


PALETTE = ["#2563EB", "#0F9B8E", "#F59E0B", "#7C3AED", "#DC2626", "#334155"]
PAPER = "#F7F9FC"
INK = "#111827"
MUTED = "#64748B"


@dataclass(frozen=True)
class FigureRef:
    chapter: int
    image_ref: str
    caption: str

    @property
    def png(self) -> Path:
        return V2 / self.image_ref

    @property
    def drawio(self) -> Path:
        return self.png.with_suffix(".drawio")

    @property
    def stem(self) -> str:
        return self.png.stem


def escape(value: str) -> str:
    return html.escape(value, quote=True)


def style_text(font_size: int, color: str, *, bold: bool = False) -> str:
    return (
        "text;html=1;strokeColor=none;fillColor=none;align=left;"
        "verticalAlign=middle;whiteSpace=wrap;rounded=0;"
        f"fontSize={font_size};fontColor={color};fontFamily=Microsoft YaHei;"
        f"fontStyle={1 if bold else 0};"
    )


def cell(
    cid: str,
    value: str,
    style: str,
    x: int,
    y: int,
    w: int,
    h: int,
    *,
    vertex: bool = True,
) -> ET.Element:
    node = ET.Element("mxCell", {"id": cid, "value": value, "style": style, "parent": "1"})
    if vertex:
        node.set("vertex", "1")
    geom = ET.SubElement(node, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})
    return node


def edge(cid: str, x1: int, y1: int, x2: int, y2: int, color: str = MUTED) -> ET.Element:
    node = ET.Element(
        "mxCell",
        {
            "id": cid,
            "value": "",
            "style": f"endArrow=block;html=1;rounded=0;strokeColor={color};strokeWidth=4;endFill=1;",
            "edge": "1",
            "parent": "1",
        },
    )
    geom = ET.SubElement(node, "mxGeometry", {"width": "50", "height": "50", "relative": "1", "as": "geometry"})
    ET.SubElement(geom, "mxPoint", {"x": str(x1), "y": str(y1), "as": "sourcePoint"})
    ET.SubElement(geom, "mxPoint", {"x": str(x2), "y": str(y2), "as": "targetPoint"})
    return node


def card_value(title: str, body: str, color: str) -> str:
    return (
        f'<font style="font-size:24px" color="{color}">{escape(title)}</font>'
        "<br><br>"
        f'<font style="font-size:18px" color="{INK}">{escape(body).replace(chr(10), "<br>")}</font>'
    )


def card_style(color: str, fill: str = "#FFFFFF") -> str:
    return (
        "rounded=1;whiteSpace=wrap;html=1;arcSize=8;"
        f"fillColor={fill};strokeColor={color};strokeWidth=3;spacing=20;"
        "align=left;verticalAlign=top;fontFamily=Microsoft YaHei;"
    )


def xml_tree(ref: FigureRef) -> tuple[ET.ElementTree, ET.Element]:
    mxfile = ET.Element(
        "mxfile",
        {
            "host": "app.diagrams.net",
            "modified": "2026-06-26T16:30:00Z",
            "agent": "Codex",
            "version": "24.7.17",
            "type": "device",
        },
    )
    diagram = ET.SubElement(mxfile, "diagram", {"id": ref.stem, "name": f"图 {ref.chapter} draw.io source"})
    model = ET.SubElement(
        diagram,
        "mxGraphModel",
        {
            "dx": "1600",
            "dy": "900",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": "1600",
            "pageHeight": "900",
            "math": "0",
            "shadow": "0",
        },
    )
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    root.append(cell("bg", "", "rounded=0;whiteSpace=wrap;html=1;fillColor=#F7F9FC;strokeColor=none;", 0, 0, 1600, 900))
    return ET.ElementTree(mxfile), root


def write_special_flow(ref: FigureRef, spec: dict[str, object]) -> None:
    tree, root = xml_tree(ref)
    model = tree.getroot().find("./diagram/mxGraphModel")
    if model is not None:
        model.set("dx", "1840")
        model.set("dy", "980")
        model.set("pageWidth", "1840")
        model.set("pageHeight", "980")
    bg = root.find("mxCell[@id='bg']/mxGeometry")
    if bg is not None:
        bg.set("width", "1840")
        bg.set("height", "980")
    for node in root.findall("mxCell"):
        if node.get("id") == "title":
            root.remove(node)
            continue
        if node.get("id") == "subtitle":
            root.remove(node)
            continue

    steps = spec["steps"]
    assert isinstance(steps, list)
    boxes = [
        (95, 210, 270, 200),
        (460, 210, 270, 200),
        (825, 210, 270, 200),
        (1190, 210, 270, 200),
        (1555, 210, 220, 200),
    ]
    for index, (step, box) in enumerate(zip(steps, boxes, strict=True), start=1):
        title, body, color = step
        x, y, w, h = box
        root.append(cell(f"special-step-{index}", card_value(str(title), str(body), str(color)), card_style(str(color)), x, y, w, h))
        if index < len(boxes):
            nx = boxes[index][0]
            root.append(edge(f"special-arrow-{index}", x + w, y + h // 2, nx - 10, y + h // 2))

    root.append(
        cell(
            "warning",
            f'<font style="font-size:23px" color="#DC2626">{escape(str(spec["warning"]))}</font>',
            "rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor=#FEF2F2;strokeColor=#DC2626;strokeWidth=4;spacingLeft=36;spacingRight=36;align=left;verticalAlign=middle;fontFamily=Microsoft YaHei;",
            330,
            630,
            1180,
            110,
        )
    )

    save(tree, ref.drawio)


def semantic_steps(ref: FigureRef) -> list[tuple[str, str]]:
    stem = ref.stem
    if "risk-order" in stem:
        return [("订单意图", "策略只提交研究动作"), ("组合状态", "仓位、现金、风险占用"), ("风控规则", "上限、止损、黑名单"), ("门禁结果", "放行、审批或拒绝"), ("审计记录", "原因和时间戳入库")]
    if "research-ia" in stem or "research-path" in stem:
        return [("行情入口", "离线样本和数据源状态"), ("候选筛选", "机会与风险排序"), ("信号研究", "K线、LLM、规则基线"), ("回测风控", "成本、回撤、拒单"), ("证据导出", "复核包和验收命令")]
    if "snapshot" in stem:
        return [("采集快照", "行情、资金、链上、情绪"), ("新鲜度检查", "时间戳和来源口径"), ("草稿生成", "只写可追溯字段"), ("停止线", "过期或缺失时阻断"), ("人工复核", "确认后进入研究记录")]
    if "eval" in stem or "rubric" in stem:
        return [("冻结样本", "正常、边界、失败样本"), ("固定权重", "结构、证据、边界"), ("逐条评分", "记录原因和失败项"), ("关键失败", "不能被平均分抵消"), ("版本决定", "采用、复测或拒绝")]
    if "failure" in stem or "recovery" in stem:
        return [("发现失败", "状态码、异常、超时"), ("降级兜底", "快照或规则基线"), ("恢复重试", "受限次数和窗口"), ("补齐审计", "原因、影响、证据"), ("关闭事件", "验证通过后归档")]
    if "approval" in stem or "stopline" in stem:
        return [("动作识别", "读、写、改、删、下单"), ("风险分级", "普通、需审批、禁止"), ("审批门", "高风险动作显式确认"), ("停止线", "越权或缺证据即阻断"), ("验证记录", "命令和结果留痕")]
    if "skill" in stem:
        return [("技能入口", "适用场景和边界"), ("输入契约", "文件、样本、参数"), ("执行步骤", "命令和失败出口"), ("输出证据", "报告、图表、日志"), ("复用检查", "版本和测试覆盖")]
    if "trace" in stem or "field" in stem or "contract" in stem:
        return [("字段来源", "源码、样本或接口"), ("契约约束", "枚举、范围、状态"), ("执行路径", "函数、路由、页面"), ("验证命令", "测试或脚本输出"), ("复核结论", "通过、降级、阻断")]
    if "boundary" in stem:
        return [("研究边界", "只处理教学样本"), ("执行边界", "不触发真实订单"), ("数据边界", "来源和时间戳"), ("风险边界", "拒绝和停止线"), ("审计边界", "证据可回放")]
    return [("输入", "样本、配置、上下文"), ("门禁", "结构、范围、来源"), ("处理", "规则或页面流程"), ("输出", "研究结果和状态"), ("复核", "人工确认和审计")]


def write_flow(ref: FigureRef) -> None:
    tree, root = xml_tree(ref)
    steps = semantic_steps(ref)
    xs = [70, 370, 670, 970, 1270]
    y = 285
    for index, ((title, body), x) in enumerate(zip(steps, xs, strict=True), start=1):
        color = PALETTE[index - 1]
        root.append(cell(f"step-{index}", card_value(title, body, color), card_style(color), x, y, 230, 210))
        if index < len(steps):
            root.append(edge(f"arrow-{index}", x + 230, y + 105, xs[index] - 10, y + 105))
    root.append(
        cell(
            "note",
            f'<font style="font-size:20px" color="#2563EB">{escape(ref.caption)}：结论必须能追到源码、样本、命令或人工复核记录。</font>',
            "rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor=#EEF2FF;strokeColor=#2563EB;strokeWidth=3;spacingLeft=28;spacingRight=28;align=left;verticalAlign=middle;fontFamily=Microsoft YaHei;",
            240,
            665,
            1120,
            86,
        )
    )
    save(tree, ref.drawio)


def write_matrix(ref: FigureRef) -> None:
    tree, root = xml_tree(ref)
    rows = ["来源", "字段", "状态", "复核"]
    cols = ["数据", "规则", "风险", "审计"]
    x0, y0, w, h = 250, 230, 250, 86
    root.append(cell("matrix-title", escape("可编辑矩阵：逐格记录覆盖状态和失败出口"), style_text(22, MUTED), x0, 178, 900, 36))
    for c, label in enumerate([""] + cols):
        fill = "#334155" if c else "#475569"
        root.append(cell(f"head-{c}", escape(label), f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor=#CBD5E1;fontColor=#FFFFFF;fontSize=20;fontFamily=Microsoft YaHei;align=center;verticalAlign=middle;", x0 + c * w, y0, w, h))
    for r, row in enumerate(rows, start=1):
        root.append(cell(f"row-{r}", escape(row), "rounded=0;whiteSpace=wrap;html=1;fillColor=#E2E8F0;strokeColor=#CBD5E1;fontColor=#111827;fontSize=20;fontFamily=Microsoft YaHei;align=center;verticalAlign=middle;", x0, y0 + r * h, w, h))
        for c, col in enumerate(cols, start=1):
            color = "#0F9B8E" if (r + c) % 3 else "#F59E0B"
            text = "OK" if color == "#0F9B8E" else "复核"
            root.append(cell(f"cell-{r}-{c}", escape(text), f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#CBD5E1;fontColor={color};fontSize=20;fontFamily=Microsoft YaHei;align=center;verticalAlign=middle;", x0 + c * w, y0 + r * h, w, h))
    root.append(cell("foot", escape(ref.caption), style_text(20, "#2563EB"), 250, 690, 1060, 42))
    save(tree, ref.drawio)


def write_card(ref: FigureRef) -> None:
    tree, root = xml_tree(ref)
    root.append(cell("main", card_value(ref.caption, "本图是课程用可编辑卡片源图：上半区记录结论，下半区记录证据、风险和验证命令。", "#2563EB"), card_style("#2563EB"), 170, 210, 1260, 190))
    labels = [("证据", "源码 / 样本 / 接口"), ("风险", "缺字段 / 越权 / 失败状态"), ("验证", "测试命令 / 输出摘要")]
    for i, (title, body) in enumerate(labels):
        color = PALETTE[i + 1]
        root.append(cell(f"sub-{i}", card_value(title, body, color), card_style(color), 170 + i * 430, 455, 380, 185))
    root.append(cell("note", escape("编辑提示：交付前把每一项替换成本章实际字段、命令和复核结论。"), style_text(20, MUTED), 170, 705, 900, 40))
    save(tree, ref.drawio)


def save(tree: ET.ElementTree, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(path, encoding="utf-8", xml_declaration=False)


def figure_refs() -> list[FigureRef]:
    refs: list[FigureRef] = []
    image_re = re.compile(r"!\[[^\]]*\]\((assets/[^)]+\.png)\)")
    caption_re = re.compile(r"\*\*图\s+\d+-\d+[　 ]+(.+?)\*\*")
    for md in sorted(V2.glob("*.md")):
        match = re.match(r"(\d+)-", md.name)
        if not match:
            continue
        chapter = int(match.group(1))
        if chapter < 14 or chapter > 35:
            continue
        lines = md.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            image = image_re.search(line)
            if not image:
                continue
            caption = Path(image.group(1)).stem
            for follow in lines[index + 1 : index + 5]:
                found = caption_re.search(follow)
                if found:
                    caption = found.group(1)
                    break
            refs.append(FigureRef(chapter, image.group(1), caption))
    return refs


def should_generate(ref: FigureRef) -> bool:
    return ref.stem in SPECIAL_FLOWS


def main() -> int:
    generated = 0
    for ref in figure_refs():
        if not should_generate(ref):
            continue
        stem = ref.stem.lower()
        if ref.stem in SPECIAL_FLOWS:
            write_special_flow(ref, SPECIAL_FLOWS[ref.stem])
        elif any(token in stem for token in ("matrix", "status", "coverage", "completeness", "inventory")):
            write_matrix(ref)
        elif any(token in stem for token in ("card", "dashboard", "summary")):
            write_card(ref)
        else:
            write_flow(ref)
        generated += 1
        print(ref.drawio.relative_to(ROOT))
    print(f"generated native draw.io companions: {generated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
