"""Generate Chapter 14 publication figures."""

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

from backtest.pollution import run_pollution_checks  # noqa: E402
from strategy_engine.dsl import check_lookahead_bias  # noqa: E402


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if FONT_PATH.exists():
        return ImageFont.truetype(str(FONT_PATH), size)
    return ImageFont.load_default()


TITLE = font(42)
HEAD = font(28)
BODY = font(23)
SMALL = font(20)

BG = "#F7F9FC"
INK = "#111827"
MUTED = "#64748B"
BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
PANEL = "#FFFFFF"


def wrap(text: str, width: int) -> str:
    return "\n".join(textwrap.wrap(text, width=width, break_long_words=True))


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str = MUTED) -> None:
    draw.line([start, end], fill=color, width=5)
    ex, ey = end
    sx, sy = start
    sign = 1 if ex >= sx else -1
    pts = [(ex, ey), (ex - sign * 18, ey - 11), (ex - sign * 18, ey + 11)]
    draw.polygon(pts, fill=color)


def card(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], title: str, body: str, color: str) -> None:
    x1, y1, _, _ = xy
    draw.rounded_rectangle(xy, radius=18, fill=PANEL, outline=color, width=4)
    draw.text((x1 + 24, y1 + 22), title, font=HEAD, fill=color)
    draw.multiline_text((x1 + 24, y1 + 78), wrap(body, 18), font=BODY, fill=INK, spacing=7)


def pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    text: str,
    *,
    fill: str,
    outline: str,
    color: str,
) -> None:
    draw.rounded_rectangle(xy, radius=16, fill=fill, outline=outline, width=2)
    bbox = draw.textbbox((0, 0), text, font=SMALL)
    x = xy[0] + ((xy[2] - xy[0]) - (bbox[2] - bbox[0])) // 2
    y = xy[1] + ((xy[3] - xy[1]) - (bbox[3] - bbox[1])) // 2 - 1
    draw.text((x, y), text, font=SMALL, fill=color)


def save_pollution_gate() -> None:
    img = Image.new("RGB", (1840, 980), BG)
    draw = ImageDraw.Draw(img)

    boxes = [
        ((95, 210, 365, 410), "输入", "行情\n链上\n新闻\n策略代码", BLUE),
        ((460, 210, 730, 410), "污染门禁", "幻觉诱因\n提示注入\n未来信息", ORANGE),
        ((825, 210, 1095, 410), "结构输出", "JSON\nsignal\nreason", TEAL),
        ((1190, 210, 1460, 410), "复核", "来源\n时间\n证据", PURPLE),
        ((1555, 210, 1775, 410), "决定", "继续\n复测\n拒绝", RED),
    ]
    for xy, title, body, color in boxes:
        card(draw, xy, title, body, color)
    for x in (365, 730, 1095, 1460):
        arrow(draw, (x, 310), (x + 90, 310))

    draw.rounded_rectangle((330, 630, 1510, 740), radius=18, fill="#FEF2F2", outline=RED, width=4)
    draw.text((370, 665), "污染样本在进入结论前停止；如果已进入回测样本，相关实验记录作废并重建。", font=BODY, fill=RED)
    GEN.mkdir(parents=True, exist_ok=True)
    img.save(GEN / "chapter-14-pollution-gate.png")
    print(GEN / "chapter-14-pollution-gate.png")


def save_pollution_cases_chart() -> None:
    payload = run_pollution_checks()
    cases = {case["label"]: case for case in payload["cases"]}
    rows = [
        (
            "safe_noop",
            "空策略",
            "无危险 import\n无未来字段",
            "无拦截",
            "可进入流程\n但不代表有交易价值",
        ),
        (
            "unsafe_import",
            "危险导入",
            "import os\n调用 os.getcwd()",
            "DSL 安全门\n拒绝执行",
            "返回作者修改\n不能进入沙箱",
        ),
        (
            "lookahead_shift",
            "未来信息",
            "df['close'].shift(-5)\n把未来价格挪到当前行",
            "前视检查\nL002 拒绝",
            "样本作废\n重建特征切分",
        ),
    ]
    img = Image.new("RGB", (1840, 980), BG)
    draw = ImageDraw.Draw(img)
    draw.text((80, 55), "污染样本的拦截层级与处理动作", font=TITLE, fill=INK)
    draw.text(
        (80, 116),
        "重点不是三根柱子谁为 1，而是看清失败发生在哪一层，以及失败后研究记录如何处理。",
        font=BODY,
        fill=MUTED,
    )

    x_cols = [80, 330, 610, 1020, 1325, 1590]
    headers = ["样本", "污染类型", "触发点", "拦截层", "人工动作"]
    for i, header in enumerate(headers):
        draw.text((x_cols[i], 205), header, font=HEAD, fill=INK)
    draw.line([(80, 255), (1760, 255)], fill="#CBD5E1", width=3)

    pass_fill = "#DCFCE7"
    pass_border = "#16A34A"
    fail_fill = "#FEE2E2"
    fail_border = RED
    warn_fill = "#FEF3C7"
    warn_border = ORANGE

    for index, (label, kind, trigger, layer, action) in enumerate(rows):
        y = 300 + index * 190
        draw.rounded_rectangle((60, y - 32, 1780, y + 125), radius=18, fill=PANEL, outline="#E5E7EB", width=2)
        draw.text((x_cols[0], y), label, font=HEAD, fill=INK)
        case = cases[label]
        dsl_text = "DSL 通过" if case["dsl_valid"] else "DSL 失败"
        lookahead_text = "前视通过" if case["lookahead_clean"] else "前视失败"
        ready_text = "可回测" if case["backtest_ready"] else "不可回测"
        pill(
            draw,
            (x_cols[0], y + 52, x_cols[0] + 108, y + 90),
            dsl_text,
            fill=pass_fill if case["dsl_valid"] else fail_fill,
            outline=pass_border if case["dsl_valid"] else fail_border,
            color=pass_border if case["dsl_valid"] else fail_border,
        )
        pill(
            draw,
            (x_cols[0] + 120, y + 52, x_cols[0] + 240, y + 90),
            lookahead_text,
            fill=pass_fill if case["lookahead_clean"] else fail_fill,
            outline=pass_border if case["lookahead_clean"] else fail_border,
            color=pass_border if case["lookahead_clean"] else fail_border,
        )
        draw.text((x_cols[1], y + 15), kind, font=HEAD, fill=ORANGE if label != "safe_noop" else TEAL)
        draw.multiline_text((x_cols[2], y - 5), trigger, font=BODY, fill=INK, spacing=7)
        layer_color = TEAL if case["backtest_ready"] else RED
        draw.multiline_text((x_cols[3], y - 5), layer, font=BODY, fill=layer_color, spacing=7)
        draw.multiline_text((x_cols[4], y - 5), action, font=BODY, fill=INK, spacing=7)
        pill(
            draw,
            (x_cols[4], y + 72, x_cols[4] + 130, y + 110),
            ready_text,
            fill=pass_fill if case["backtest_ready"] else warn_fill,
            outline=pass_border if case["backtest_ready"] else warn_border,
            color=pass_border if case["backtest_ready"] else "#B45309",
        )

    draw.rounded_rectangle((80, 865, 1760, 930), radius=18, fill="#EEF2FF", outline=BLUE, width=3)
    draw.text(
        (115, 883),
        "读图结论：lookahead_shift 不是代码安全问题，而是研究真实性问题；DSL 放行后仍必须被前视门禁作废。",
        font=BODY,
        fill=BLUE,
    )
    img.save(OUT / "chapter-14-pollution-cases.png")
    print(OUT / "chapter-14-pollution-cases.png")


def save_lookahead_rules_chart() -> None:
    rows = [
        (
            "history[-1]",
            "return ctx.history[-1]",
            "只读当前时点之前的历史",
            "允许",
            "可作为最近一根已知 K 线",
        ),
        (
            "ctx.future_close",
            "return ctx.future_close",
            "字段名直接声明未来价格",
            "拒绝",
            "停止进入回测，删除未来字段",
        ),
        (
            "shift(-5)",
            "df['close'].shift(-5)",
            "未来五根 K 线的值挪到当前行",
            "拒绝",
            "样本作废，重建特征",
        ),
        (
            "np.roll(...,-1)",
            "np.roll(ctx.closes, -1)",
            "数组负向滚动，把后一项提前",
            "拒绝",
            "停止回测，改用滞后特征",
        ),
        (
            "history[5]",
            "return ctx.history[5]",
            "正数索引可能不是最近 K 线",
            "人工说明",
            "保留前必须写清 warm-up 逻辑",
        ),
    ]
    code_by_label = {
        "history[-1]": "def on_tick(ctx, candle):\n    return ctx.history[-1]",
        "ctx.future_close": "def on_tick(ctx, candle):\n    return ctx.future_close",
        "shift(-5)": "def on_tick(ctx, candle):\n    return ctx.dataframe['close'].shift(-5)",
        "np.roll(...,-1)": "def on_tick(ctx, candle):\n    return np.roll(ctx.closes, -1)",
        "history[5]": "def on_tick(ctx, candle):\n    return ctx.history[5]",
    }

    img = Image.new("RGB", (1840, 1080), BG)
    draw = ImageDraw.Draw(img)
    draw.text((80, 55), "前视检查规则样本", font=TITLE, fill=INK)
    draw.text(
        (80, 116),
        "这张图看规则如何命中，而不是看柱子高度：错误级发现直接阻断回测，警告级发现必须人工说明。",
        font=BODY,
        fill=MUTED,
    )

    x_cols = [80, 335, 650, 1010, 1200, 1435]
    headers = ["代码形态", "示例片段", "时间顺序风险", "规则", "结论", "处理动作"]
    for i, header in enumerate(headers):
        draw.text((x_cols[i], 205), header, font=HEAD, fill=INK)
    draw.line([(80, 255), (1760, 255)], fill="#CBD5E1", width=3)

    pass_fill = "#DCFCE7"
    pass_border = "#16A34A"
    fail_fill = "#FEE2E2"
    fail_border = RED
    warn_fill = "#FEF3C7"
    warn_border = ORANGE

    for index, (label, snippet, risk, conclusion, action) in enumerate(rows):
        report = check_lookahead_bias(code_by_label[label])
        finding = report.findings[0] if report.findings else None
        rule = finding.rule if finding else "OK"
        severity = finding.severity if finding else "clean"
        if severity == "error":
            status_fill, status_border, status_color = fail_fill, fail_border, fail_border
            rule_fill, rule_border = fail_fill, fail_border
        elif severity == "warning":
            status_fill, status_border, status_color = warn_fill, warn_border, "#B45309"
            rule_fill, rule_border = warn_fill, warn_border
        else:
            status_fill, status_border, status_color = pass_fill, pass_border, pass_border
            rule_fill, rule_border = pass_fill, pass_border

        y = 300 + index * 145
        draw.rounded_rectangle((60, y - 30, 1780, y + 95), radius=16, fill=PANEL, outline="#E5E7EB", width=2)
        draw.text((x_cols[0], y), label, font=HEAD, fill=INK)
        draw.text((x_cols[1], y + 2), snippet, font=SMALL, fill=INK)
        draw.multiline_text((x_cols[2], y - 2), wrap(risk, 17), font=BODY, fill=INK, spacing=6)
        pill(
            draw,
            (x_cols[3], y + 5, x_cols[3] + 120, y + 45),
            rule,
            fill=rule_fill,
            outline=rule_border,
            color=status_color,
        )
        pill(
            draw,
            (x_cols[4], y + 5, x_cols[4] + 150, y + 45),
            conclusion,
            fill=status_fill,
            outline=status_border,
            color=status_color,
        )
        draw.multiline_text((x_cols[5], y - 2), wrap(action, 16), font=BODY, fill=INK, spacing=6)

    draw.rounded_rectangle((80, 995, 1760, 1050), radius=18, fill="#EEF2FF", outline=BLUE, width=3)
    draw.text(
        (115, 1010),
        "读图结论：前视检查保护的是时间顺序；能运行、能画收益曲线，都不能替代这些规则。",
        font=BODY,
        fill=BLUE,
    )
    img.save(OUT / "chapter-14-lookahead-rules.png")
    print(OUT / "chapter-14-lookahead-rules.png")


def _synthetic_prices() -> list[float]:
    import math

    prices = [100.0]
    for index in range(1, 96):
        ret = 0.014 * math.sin(index * 1.65) + 0.009 * math.sin(index * 0.47) - 0.002
        prices.append(prices[-1] * (1 + ret))
    return prices


def _equity_from_signal(prices: list[float], *, leaky: bool) -> list[float]:
    equity = [1.0]
    for index in range(1, len(prices)):
        if leaky:
            signal = 1 if prices[index] >= prices[index - 1] else -1
        else:
            if index < 2:
                signal = 0
            else:
                signal = 1 if prices[index - 1] >= prices[index - 2] else -1
        ret = (prices[index] / prices[index - 1] - 1) * signal
        equity.append(equity[-1] * (1 + ret))
    return equity


def save_leakage_inflates_metrics_chart() -> None:
    prices = _synthetic_prices()
    honest = _equity_from_signal(prices, leaky=False)
    leaky = _equity_from_signal(prices, leaky=True)
    x = list(range(len(prices)))

    plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    fig, ax = plt.subplots(figsize=(11.2, 5.8), dpi=160)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor("#FFFFFF")
    ax.plot(x, honest, color=BLUE, linewidth=2.5, label=f"滞后一根K线信号：{(honest[-1] - 1) * 100:+.1f}%")
    ax.plot(x, leaky, color=RED, linewidth=2.5, label=f"偷看下一根方向：{(leaky[-1] - 1) * 100:+.1f}%")
    ax.axhline(1.0, color="#334155", linewidth=1.0)
    ax.set_ylabel("权益倍数", fontsize=12)
    ax.set_xlabel("教学样本序号", fontsize=12)
    ax.grid(color="#E5E7EB", linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper left", frameon=False)
    ax.text(
        0.01,
        -0.18,
        "红线不是好策略，而是未来信息污染的演示：信号使用当期之后才知道的方向。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-14-leakage-inflates-metrics.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-14-leakage-inflates-metrics.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save_pollution_gate()
    save_pollution_cases_chart()
    save_lookahead_rules_chart()
    save_leakage_inflates_metrics_chart()


if __name__ == "__main__":
    main()
