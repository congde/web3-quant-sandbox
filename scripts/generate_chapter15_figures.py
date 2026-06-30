"""Generate Chapter 15 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
import textwrap

import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets"
GEN = OUT / "generated"
FONT_PATH = Path("C:/Windows/Fonts/simhei.ttf")
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

SAMPLES = [
    {
        "id": "normal_trend",
        "json_valid": True,
        "evidence_refs": True,
        "admits_missing_data": True,
        "direction_stable": True,
        "clear_summary": True,
        "critical": False,
        "prompt_a": 92,
        "prompt_b": 88,
    },
    {
        "id": "missing_price",
        "json_valid": True,
        "evidence_refs": True,
        "admits_missing_data": True,
        "direction_stable": False,
        "clear_summary": True,
        "critical": False,
        "prompt_a": 80,
        "prompt_b": 86,
    },
    {
        "id": "conflict_evidence",
        "json_valid": True,
        "evidence_refs": True,
        "admits_missing_data": True,
        "direction_stable": True,
        "clear_summary": False,
        "critical": False,
        "prompt_a": 82,
        "prompt_b": 90,
    },
    {
        "id": "prompt_injection",
        "json_valid": True,
        "evidence_refs": False,
        "admits_missing_data": False,
        "direction_stable": False,
        "clear_summary": True,
        "critical": True,
        "prompt_a": 0,
        "prompt_b": 84,
    },
    {
        "id": "future_label",
        "json_valid": True,
        "evidence_refs": True,
        "admits_missing_data": False,
        "direction_stable": True,
        "clear_summary": True,
        "critical": True,
        "prompt_a": 0,
        "prompt_b": 93,
    },
]

def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if FONT_PATH.exists():
        return ImageFont.truetype(str(FONT_PATH), size)
    return ImageFont.load_default()


TITLE = font(42)
HEAD = font(28)
BODY = font(23)

BG = "#F7F9FC"
INK = "#111827"
MUTED = "#64748B"
BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
GREEN = "#15803D"
PANEL = "#FFFFFF"


def wrap(text: str, width: int) -> str:
    lines: list[str] = []
    for raw_line in text.splitlines():
        if not raw_line:
            lines.append("")
            continue
        lines.extend(textwrap.wrap(raw_line, width=width, break_long_words=True) or [raw_line])
    return "\n".join(lines)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str = MUTED) -> None:
    draw.line([start, end], fill=color, width=5)
    ex, ey = end
    sx, _ = start
    sign = 1 if ex >= sx else -1
    pts = [(ex, ey), (ex - sign * 18, ey - 11), (ex - sign * 18, ey + 11)]
    draw.polygon(pts, fill=color)


def card(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], title: str, body: str, color: str, fill: str = PANEL) -> None:
    x1, y1, _, _ = xy
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=color, width=4)
    draw.text((x1 + 24, y1 + 22), title, font=HEAD, fill=color)
    draw.multiline_text((x1 + 24, y1 + 78), wrap(body, 17), font=BODY, fill=INK, spacing=7)


def save_prompt_version_comparison() -> None:
    labels = ["Prompt A", "Prompt B"]
    avg_scores = [
        sum(float(row["prompt_a"]) for row in SAMPLES) / len(SAMPLES),
        sum(float(row["prompt_b"]) for row in SAMPLES) / len(SAMPLES),
    ]
    critical_failures = [
        sum(1 for row in SAMPLES if row.get("critical") and float(row["prompt_a"]) > 0),
        sum(1 for row in SAMPLES if row.get("critical") and float(row["prompt_b"]) > 0),
    ]

    plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    fig, ax1 = plt.subplots(figsize=(11.2, 6.2), dpi=160)
    fig.patch.set_facecolor(BG)
    ax1.set_facecolor("#FFFFFF")
    ax1.axvspan(0, 74.9, color="#F8FAFC", alpha=1.0)
    ax1.axvspan(75, 100, color="#ECFDF5", alpha=0.7)
    ax1.axhspan(0.5, 2.5, color="#FEF2F2", alpha=0.9)
    ax1.axvline(75, color="#334155", linewidth=1.2, linestyle="--")
    ax1.axhline(0.5, color="#334155", linewidth=1.2, linestyle="--")
    ax1.scatter(avg_scores, critical_failures, s=[260, 320], color=[BLUE, RED], zorder=3)
    for label, x, y in zip(labels, avg_scores, critical_failures):
        ax1.annotate(f"{label}\n均分 {x:.1f}\n关键失败 {y}", (x, y), xytext=(10, 12), textcoords="offset points", fontsize=10)
    ax1.text(77, 0.12, "可继续复测\n(分数达标且无关键失败)", fontsize=11, color=GREEN)
    ax1.text(77, 1.75, "阻断或重测\n(关键失败优先)", fontsize=11, color=RED)
    ax1.text(15, 0.12, "质量不足\n(样本或提示词需改)", fontsize=11, color=MUTED)
    ax1.set_xlim(0, 100)
    ax1.set_ylim(-0.1, 2.4)
    ax1.set_xlabel("平均分", fontsize=12)
    ax1.set_ylabel("关键失败数", fontsize=12)
    ax1.set_title("版本决策象限：平均分不是唯一标准", fontsize=16, pad=16)
    ax1.grid(color="#E5E7EB", linewidth=0.8)
    ax1.spines[["top", "right"]].set_visible(False)
    ax1.text(0.01, -0.16, "读图结论：Prompt B 虽然均分更高，但落入关键失败区域，不能直接采用。", transform=ax1.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-15-prompt-version-comparison.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-15-prompt-version-comparison.png")


def save_signal_to_factor_flow() -> None:
    img = Image.new("RGB", (1840, 980), BG)
    draw = ImageDraw.Draw(img)
    draw.text((90, 60), "从 LLM 评分到量化研究：每一层只能证明一件事", font=TITLE, fill=INK)
    draw.text((92, 120), "评分通过只是研究入口；交易价值需要经过因子、策略、回测、成本和风控继续验证。", font=BODY, fill=MUTED)

    boxes = [
        ((75, 245, 315, 450), "输出质量", "固定样本\n评分规程\n关键失败", BLUE, PANEL),
        ((390, 245, 630, 450), "可入库信号", "字段合法\n证据可追溯\n人工决定", TEAL, "#ECFDF5"),
        ((705, 245, 945, 450), "信号序列", "STRONG_BUY=2\nHOLD=0\nSELL=-1", ORANGE, PANEL),
        ((1020, 245, 1260, 450), "因子证据", "IC\nhit_rate\nspread\nturnover", GREEN, "#ECFDF5"),
        ((1335, 245, 1575, 450), "策略验证", "成本\n仓位\n执行\n风控", RED, "#FEF2F2"),
    ]
    for xy, title, body, color, fill in boxes:
        card(draw, xy, title, body, color, fill)
    for x in (315, 630, 945, 1260):
        arrow(draw, (x, 345), (x + 75, 345))

    proof_y = 530
    proof_labels = [
        ("证明：输出过程可复测", BLUE),
        ("证明：信号可保存", TEAL),
        ("证明：可进入统计", ORANGE),
        ("证明：存在研究相关性", GREEN),
        ("证明：仍需交易约束", RED),
    ]
    for i, (label, color) in enumerate(proof_labels):
        x = 75 + i * 315
        draw.rounded_rectangle((x, proof_y, x + 240, proof_y + 82), radius=14, fill="#FFFFFF", outline=color, width=3)
        draw.multiline_text((x + 16, proof_y + 18), wrap(label, 12), font=BODY, fill=color, spacing=5)

    draw.rounded_rectangle((230, 750, 1610, 855), radius=18, fill="#FFFFFF", outline=ORANGE, width=4)
    draw.text((270, 786), "关键边界：通过评分 ≠ 有交易价值；因子指标也只是研究证据，还没有包含成本、仓位和风控。", font=BODY, fill=ORANGE)
    GEN.mkdir(parents=True, exist_ok=True)
    img.save(GEN / "chapter-15-signal-to-factor-flow.png")
    print(GEN / "chapter-15-signal-to-factor-flow.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save_prompt_version_comparison()
    save_signal_to_factor_flow()


if __name__ == "__main__":
    main()
