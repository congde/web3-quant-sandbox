"""Generate Chapter 25 publication figures."""

from __future__ import annotations

import os
import html
from pathlib import Path
import subprocess
import sys

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

# Publication figures should be reproducible from the bundled teaching sample.
os.environ["DASHBOARD_DATA_MODE"] = "offline"
os.environ["OPENAI_API_KEY"] = ""

from dashboard import api as dashboard_api  # noqa: E402
from dashboard import kline_analysis as kline_mod  # noqa: E402
from dashboard import signal_analysis as signal_mod  # noqa: E402

dashboard_api.prefer_offline = lambda: True
dashboard_api.serve_offline_first = lambda *, refresh=False: not refresh
dashboard_api.try_live_public = lambda: False
kline_mod.prefer_offline = lambda: True
kline_mod.try_live_public = lambda: False
signal_mod.prefer_offline = lambda: True

run_kline_analysis = kline_mod.run_kline_analysis
run_signal_analysis = signal_mod.run_signal_analysis


BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
INK = "#111827"
MUTED = "#64748B"
GRID = "#E5E7EB"
PAPER = "#F7F9FC"


def setup_matplotlib() -> None:
    plt.rcParams["font.sans-serif"] = [
        "SimHei",
        "Microsoft YaHei",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False


def _drawio_label(title: str, body: str, color: str) -> str:
    body_html = html.escape(body).replace("\n", "<br>")
    raw = (
        f'<font style="font-size:24px" color="{color}"><b>{html.escape(title)}</b></font>'
        f'<br><br><font style="font-size:18px" color="{INK}">{body_html}</font>'
    )
    return html.escape(raw, quote=True)


def _drawio_cell(cell_id: str, value: str, x: int, y: int, w: int, h: int, color: str, fill: str = "#FFFFFF") -> str:
    return f"""        <mxCell id="{cell_id}" value="{value}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor={fill};strokeColor={color};strokeWidth=3;spacing=20;align=left;verticalAlign=top;fontFamily=Microsoft YaHei;" parent="1" vertex="1">
          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />
        </mxCell>"""


def _drawio_edge(edge_id: str, source: str, target: str, color: str = MUTED, dashed: bool = False) -> str:
    dash = "dashed=1;" if dashed else ""
    return f"""        <mxCell id="{edge_id}" value="" style="endArrow=block;html=1;rounded=0;{dash}strokeColor={color};strokeWidth=4;endFill=1;" parent="1" source="{source}" target="{target}" edge="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>"""


def _write_drawio(path: Path, diagram_id: str, page_name: str, title: str, subtitle: str, cells: list[str], edges: list[str], note: str) -> None:
    note_value = html.escape(f'<font style="font-size:20px" color="{BLUE}">{html.escape(note)}</font>', quote=True)
    xml = f"""<mxfile host="app.diagrams.net" modified="2026-07-03T00:00:00Z" agent="Codex" version="24.7.17" type="device">
  <diagram id="{diagram_id}" name="{html.escape(page_name)}">
    <mxGraphModel dx="1600" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="900" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor={PAPER};strokeColor=none;" parent="1" vertex="1">
          <mxGeometry x="0" y="0" width="1600" height="900" as="geometry" />
        </mxCell>
        <mxCell id="title" value="{html.escape(title)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=34;fontColor={INK};fontFamily=Microsoft YaHei;fontStyle=1;" parent="1" vertex="1">
          <mxGeometry x="70" y="48" width="1180" height="54" as="geometry" />
        </mxCell>
        <mxCell id="subtitle" value="{html.escape(subtitle)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=18;fontColor={MUTED};fontFamily=Microsoft YaHei;" parent="1" vertex="1">
          <mxGeometry x="70" y="108" width="1320" height="34" as="geometry" />
        </mxCell>
{chr(10).join(cells)}
{chr(10).join(edges)}
        <mxCell id="note" value="{note_value}" style="rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor=#EEF2FF;strokeColor={BLUE};strokeWidth=3;spacingLeft=28;spacingRight=28;align=left;verticalAlign=middle;fontFamily=Microsoft YaHei;" parent="1" vertex="1">
          <mxGeometry x="240" y="795" width="1120" height="64" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
"""
    path.write_text(xml, encoding="utf-8")


def _export_drawio(drawio: Path, png: Path) -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "export_drawio_png.py"), str(drawio), "-o", str(png), "--width", "1440"],
        check=True,
    )


def save_kline_llm_binding() -> None:
    cells = [
        _drawio_cell("step-kline", _drawio_label("K 线样本", "OHLCV\n周期与时间戳\n离线快照边界", BLUE), 70, 245, 220, 230, BLUE),
        _drawio_cell("step-indicator", _drawio_label("指标计算", "MA20 / MA60\nRSI / volume\n支撑 / 阻力", "#0891B2"), 340, 245, 230, 230, "#0891B2"),
        _drawio_cell("step-rule", _drawio_label("规则基线", "signal\nscore / confidence\n交易计划字段", TEAL), 620, 245, 230, 230, TEAL),
        _drawio_cell("step-context", _drawio_label("LLM 上下文", "只传必要字段\n带上基线与限制\n禁止未来信息", ORANGE), 900, 245, 230, 230, ORANGE),
        _drawio_cell("step-explain", _drawio_label("结构化解释", "logicFlow\nriskAssessment\nreviewFlags", PURPLE), 1180, 245, 230, 230, PURPLE),
        _drawio_cell("page", _drawio_label("页面同屏复核", "图表、指标、规则基线、模型状态和风险边界必须同时可见。", RED), 390, 590, 820, 150, RED),
    ]
    edges = [
        _drawio_edge("arrow-1", "step-kline", "step-indicator"),
        _drawio_edge("arrow-2", "step-indicator", "step-rule"),
        _drawio_edge("arrow-3", "step-rule", "step-context"),
        _drawio_edge("arrow-4", "step-context", "step-explain"),
        _drawio_edge("arrow-5", "step-explain", "page", RED),
    ]
    drawio = OUT / "chapter-25-kline-llm-binding.drawio"
    _write_drawio(
        drawio,
        "chapter-25-kline-llm-binding",
        "图 25-3 K 线证据与 LLM 信号解释绑定",
        "K 线证据与 LLM 信号解释绑定",
        "顺序必须是先证据、再规则基线、再模型解释；页面只展示能回到输入字段的结论。",
        cells,
        edges,
        "LLM 只能解释已进入上下文的证据，不能先给结论再反向挑选 K 线理由。",
    )
    _export_drawio(drawio, OUT / "chapter-25-kline-llm-binding.png")
    print(OUT / "chapter-25-kline-llm-binding.png")


def save_kline_indicator_chart() -> None:
    payload = run_kline_analysis("BTC-USDT", kline_type="1hour", limit=120)
    candles = payload.get("candles") or []
    closes = [float(row.get("close") or 0) for row in candles]
    dates = [str(row.get("date") or idx) for idx, row in enumerate(candles)]
    metrics = payload.get("metrics") or {}
    x = list(range(len(closes)))

    def rolling(values: list[float], window: int) -> list[float | None]:
        out: list[float | None] = []
        for idx in range(len(values)):
            if idx + 1 < window:
                out.append(None)
            else:
                out.append(sum(values[idx + 1 - window : idx + 1]) / window)
        return out

    ma20 = rolling(closes, 20)
    ma60 = rolling(closes, 60)
    fig, ax = plt.subplots(figsize=(11.6, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(x, closes, color=INK, linewidth=1.8, label="close")
    ax.plot(x, [v if v is not None else float("nan") for v in ma20], color=BLUE, linewidth=1.6, label="MA20")
    ax.plot(x, [v if v is not None else float("nan") for v in ma60], color=ORANGE, linewidth=1.6, label="MA60")
    ax.axhline(float(metrics.get("support20") or 0), color=TEAL, linestyle="--", linewidth=1.2, label="support20")
    ax.axhline(float(metrics.get("resistance20") or 0), color=RED, linestyle="--", linewidth=1.2, label="resistance20")
    ticks = [0, max(0, len(x) // 3), max(0, len(x) * 2 // 3), len(x) - 1]
    ax.set_xticks(ticks)
    ax.set_xticklabels([dates[i] for i in ticks], rotation=0)
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, loc="upper left")
    ax.text(
        0.0,
        -0.18,
        f"source={payload.get('source')}，trend={payload.get('trend')}，RSI={metrics.get('rsi')}，regime={metrics.get('regime')}。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-25-kline-indicator-chart.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-25-kline-indicator-chart.png")


def save_llm_fallback_ladder() -> None:
    cells = [
        _drawio_cell("rule", _drawio_label("规则基线", "run_signal_analysis()\nsignal / score\nconfidence / 计划", BLUE), 70, 255, 250, 220, BLUE),
        _drawio_cell("context", _drawio_label("构造上下文", "只包含可复算字段\n附带规则输出\n写明解释边界", "#0891B2"), 370, 255, 250, 220, "#0891B2"),
        _drawio_cell("gate", _drawio_label("调用门禁", "OPENAI_API_KEY\n模型配置\n超时与异常", TEAL), 670, 255, 250, 220, TEAL),
        _drawio_cell("llm", _drawio_label("LLM 结构化输出", "signal 枚举\nconfidence 范围\nlogicFlow / risk", PURPLE), 970, 255, 250, 220, PURPLE),
        _drawio_cell("merge", _drawio_label("合并与复核", "保留 ruleBaseline\n写入 engineMeta\n展示 reviewFlags", RED), 1270, 255, 250, 220, RED),
        _drawio_cell("fallback", _drawio_label("失败回退", "未配置密钥\n调用失败\n非法枚举或越界数值", "#B45309"), 670, 585, 340, 170, "#B45309", "#FFF7ED"),
        _drawio_cell("page", _drawio_label("页面输出", "规则模式、LLM 成功和 fallback 都要能被用户一眼区分。", INK), 1060, 585, 460, 170, INK),
    ]
    edges = [
        _drawio_edge("arrow-1", "rule", "context"),
        _drawio_edge("arrow-2", "context", "gate"),
        _drawio_edge("arrow-3", "gate", "llm"),
        _drawio_edge("arrow-4", "llm", "merge"),
        _drawio_edge("arrow-5", "gate", "fallback", "#B45309", dashed=True),
        _drawio_edge("arrow-6", "llm", "fallback", "#B45309", dashed=True),
        _drawio_edge("arrow-7", "fallback", "page", "#B45309"),
        _drawio_edge("arrow-8", "merge", "page", RED),
    ]
    drawio = OUT / "chapter-25-llm-fallback-ladder.drawio"
    _write_drawio(
        drawio,
        "chapter-25-llm-fallback-ladder",
        "图 25-5 LLM 信号必须有规则基线和失败回退",
        "LLM 信号必须有规则基线和失败回退",
        "模型可用时进入结构化解释；模型不可用、越界或失败时保留规则基线并显式标记 fallback。",
        cells,
        edges,
        "没有规则基线的 LLM 文字不能进入回测；没有显式 fallback 的页面不能用于教学验收。",
    )
    _export_drawio(drawio, OUT / "chapter-25-llm-fallback-ladder.png")
    print(OUT / "chapter-25-llm-fallback-ladder.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    setup_matplotlib()
    save_kline_llm_binding()
    save_kline_indicator_chart()
    save_llm_fallback_ladder()


if __name__ == "__main__":
    main()
