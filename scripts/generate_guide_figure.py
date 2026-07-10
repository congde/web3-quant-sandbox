from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "v2" / "assets" / "generated" / "guide-quant-knowledge-map.png"
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size)


def rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: str,
    title: str,
    lines: list[str],
) -> None:
    draw.rounded_rectangle(box, radius=16, fill=fill, outline="#94A3B8", width=2)
    x1, y1, _, _ = box
    draw.text((x1 + 20, y1 + 24), title, font=font(24, bold=True), fill="#111827")
    for index, line in enumerate(lines):
        draw.text((x1 + 20, y1 + 68 + index * 31), line, font=font(17), fill="#64748B")


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int]) -> None:
    draw.line((start, end), fill="#64748B", width=4)
    x, y = end
    draw.polygon([(x, y), (x - 16, y - 10), (x - 16, y + 10)], fill="#64748B")


def main() -> None:
    canvas = Image.new("RGB", (1600, 900), "#F8FAFC")
    draw = ImageDraw.Draw(canvas)

    draw.text((60, 35), "量化知识导读：从知识地图到研究闭环", font=font(38, bold=True), fill="#1F2937")
    draw.text(
        (60, 91),
        "所有知识都要落到数据、公式、代码、回测、风险和人工复核上",
        font=font(20),
        fill="#64748B",
    )

    boxes = [
        ((70, 190, 315, 335), "#DBEAFE", "数据输入", ["价格 / 财务 / 新闻情绪", "样本口径与质量检查"]),
        ((380, 190, 625, 335), "#DCFCE7", "指标与公式", ["布林带 / 相对强弱指标", "平均真实波幅 / 公式复算"]),
        ((690, 190, 935, 335), "#FEF3C7", "策略规则", ["入场 / 离场 / 成本", "候选信号不等于订单"]),
        ((1000, 190, 1245, 335), "#FAE8FF", "回测评价", ["收益 / 回撤 / 夏普", "基准与成本敏感性"]),
        ((1310, 190, 1555, 335), "#FEE2E2", "风险控制", ["仓位 / 止损 / 凯利公式", "拒绝 / 降级 / 急停"]),
    ]
    for box, fill, title, lines in boxes:
        rounded_box(draw, box, fill, title, lines)

    for left, right in zip(boxes, boxes[1:]):
        left_box = left[0]
        right_box = right[0]
        arrow(draw, (left_box[2] + 8, 262), (right_box[0] - 12, 262))

    stop_box = (100, 455, 1500, 640)
    draw.rounded_rectangle(stop_box, radius=16, fill="#FFFFFF", outline="#CBD5E1", width=2)
    draw.text((130, 480), "出版级停止线", font=font(24, bold=True), fill="#B91C1C")
    stop_lines = [
        ("• 样本来源不清 → 不发布结论", "• 回测无成本或无基准 → 降级为演示", "• 夏普漂亮但交易太少 → 不写成稳健"),
        ("• 公式不能复算 → 回到变量定义", "• 凯利参数无样本支持 → 禁止放大仓位", ""),
    ]
    columns = (140, 600, 1100)
    for row_index, row in enumerate(stop_lines):
        for column_index, line in enumerate(row):
            if line:
                draw.text((columns[column_index], 535 + row_index * 43), line, font=font(17), fill="#64748B")

    draw.text(
        (60, 735),
        "导读讲的作用：给第 0～35 讲建立共同语言，而不是提前承诺任何策略收益。",
        font=font(20),
        fill="#64748B",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
