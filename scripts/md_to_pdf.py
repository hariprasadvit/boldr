from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent.parent
FONT_CANDIDATES = [
    Path("/Library/Fonts/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
]


def register_fonts() -> tuple[str, str]:
    font_path = next((p for p in FONT_CANDIDATES if p.exists()), None)
    if font_path:
        pdfmetrics.registerFont(TTFont("DocUnicode", str(font_path)))
        return "DocUnicode", "DocUnicode"
    return "Helvetica", "Courier"


BODY_FONT, CODE_FONT = register_fonts()


def clean_inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r"<font face='%s'>\1</font>" % CODE_FONT, text)
    return text


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=BODY_FONT,
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            spaceAfter=14,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName=BODY_FONT,
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4b5563"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontName=BODY_FONT,
            fontSize=16,
            leading=21,
            textColor=colors.HexColor("#111827"),
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontName=BODY_FONT,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1f2937"),
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "Heading3",
            parent=base["Heading3"],
            fontName=BODY_FONT,
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#374151"),
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=9.2,
            leading=13,
            textColor=colors.HexColor("#1f2937"),
            alignment=TA_LEFT,
            spaceAfter=5,
        ),
        "quote": ParagraphStyle(
            "Quote",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=9,
            leading=13,
            leftIndent=14,
            borderColor=colors.HexColor("#d1d5db"),
            borderWidth=0,
            borderPadding=6,
            textColor=colors.HexColor("#374151"),
            backColor=colors.HexColor("#f9fafb"),
            spaceBefore=4,
            spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=9,
            leading=12.5,
            leftIndent=8,
            firstLineIndent=0,
            spaceAfter=2,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName=CODE_FONT,
            fontSize=6.6,
            leading=8.2,
            leftIndent=6,
            rightIndent=6,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#f3f4f6"),
            borderColor=colors.HexColor("#e5e7eb"),
            borderWidth=0.5,
            borderPadding=5,
            spaceBefore=5,
            spaceAfter=7,
        ),
        "table": ParagraphStyle(
            "TableCell",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=7.4,
            leading=9.4,
            textColor=colors.HexColor("#1f2937"),
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName=BODY_FONT,
            fontSize=7.3,
            leading=9.2,
            textColor=colors.white,
        ),
    }


def is_table_start(lines: list[str], i: int) -> bool:
    return (
        i + 1 < len(lines)
        and lines[i].strip().startswith("|")
        and lines[i + 1].strip().startswith("|")
        and set(lines[i + 1].strip().replace("|", "").replace(" ", "")) <= {"-", ":"}
    )


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        line = lines[i].strip().strip("|")
        cells = [c.strip() for c in line.split("|")]
        if i != start + 1:
            rows.append(cells)
        i += 1
    return rows, i


def add_table(story: list, rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> None:
    if not rows:
        return
    max_cols = max(len(r) for r in rows)
    normalized = [r + [""] * (max_cols - len(r)) for r in rows]
    data = []
    for r_idx, row in enumerate(normalized):
        style = styles["table_header"] if r_idx == 0 else styles["table"]
        data.append([Paragraph(clean_inline(cell), style) for cell in row])

    width = 7.0 * inch
    col_width = width / max_cols
    table = Table(data, colWidths=[col_width] * max_cols, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#374151")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 7))


def flush_list(story: list, pending: list[str], styles: dict[str, ParagraphStyle]) -> None:
    if not pending:
        return
    items = [ListItem(Paragraph(clean_inline(item), styles["bullet"])) for item in pending]
    story.append(
        ListFlowable(
            items,
            bulletType="bullet",
            start="circle",
            leftIndent=18,
            bulletFontName=BODY_FONT,
            bulletFontSize=7,
        )
    )
    story.append(Spacer(1, 3))
    pending.clear()


def markdown_to_story(source: Path) -> list:
    styles = make_styles()
    lines = source.read_text(encoding="utf-8").splitlines()
    story: list = []
    pending_list: list[str] = []
    code_lines: list[str] = []
    in_code = False

    for i, raw in enumerate(lines):
        line = raw.rstrip()

        if line.strip().startswith("```"):
            if in_code:
                flush_list(story, pending_list, styles)
                story.append(Preformatted("\n".join(code_lines), styles["code"], maxLineLength=120))
                code_lines = []
                in_code = False
            else:
                flush_list(story, pending_list, styles)
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if is_table_start(lines, i):
            flush_list(story, pending_list, styles)
            rows, next_i = parse_table(lines, i)
            add_table(story, rows, styles)
            for j in range(i + 1, next_i):
                lines[j] = ""
            continue

        stripped = line.strip()
        if not stripped:
            flush_list(story, pending_list, styles)
            continue

        if stripped == "---":
            flush_list(story, pending_list, styles)
            story.append(Spacer(1, 8))
            continue

        if stripped.startswith("# "):
            flush_list(story, pending_list, styles)
            if story:
                story.append(PageBreak())
            story.append(Paragraph(clean_inline(stripped[2:].strip()), styles["title"]))
            continue

        if stripped.startswith("### "):
            flush_list(story, pending_list, styles)
            if len(story) < 3:
                story.append(Paragraph(clean_inline(stripped[4:].strip()), styles["subtitle"]))
            else:
                story.append(Paragraph(clean_inline(stripped[4:].strip()), styles["h3"]))
            continue

        if stripped.startswith("## "):
            flush_list(story, pending_list, styles)
            story.append(Paragraph(clean_inline(stripped[3:].strip()), styles["h1"]))
            continue

        if stripped.startswith("#### "):
            flush_list(story, pending_list, styles)
            story.append(Paragraph(clean_inline(stripped[5:].strip()), styles["h3"]))
            continue

        bullet_match = re.match(r"^[-*]\s+(.+)$", stripped)
        numbered_match = re.match(r"^\d+\.\s+(.+)$", stripped)
        if bullet_match:
            pending_list.append(bullet_match.group(1))
            continue
        if numbered_match:
            flush_list(story, pending_list, styles)
            story.append(Paragraph(clean_inline(stripped), styles["body"]))
            continue

        if stripped.startswith(">"):
            flush_list(story, pending_list, styles)
            story.append(Paragraph(clean_inline(stripped.lstrip("> ").strip()), styles["quote"]))
            continue

        flush_list(story, pending_list, styles)
        story.append(Paragraph(clean_inline(stripped), styles["body"]))

    flush_list(story, pending_list, styles)
    return story


def footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont(BODY_FONT, 7)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(doc.leftMargin, 0.45 * inch, "Boldr Customer Intelligence Engine")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(source: Path, output: Path) -> None:
    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title="Boldr Customer Intelligence Engine",
        author="Boldr Intel Project",
    )
    story = markdown_to_story(source)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    build_pdf(args.source, args.output)


if __name__ == "__main__":
    main()
