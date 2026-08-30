// docx-js construction for the itinerary export — the visual half of the
// itinerary-format skill spec (~/.claude/skills/itinerary-format/SKILL.md,
// v2). Colors/fonts/box-table pattern ported from that skill's own
// reference example, verified by rendering and visually comparing against
// it (see the plan's verification section, not unit-tested here — see
// assembleItineraryDocxModel.ts for the testable half).
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType,
  Header, Footer, PageNumber, VerticalAlign, Tab, TabStopType,
} from "docx";
import type { DocxModel, DocxPickRow } from "./assembleItineraryDocxModel";

const NAVY = "1A2744";
const GOLD = "B8924A";
const LIGHT_BLUE = "EEF2F8";
const WHITE = "FFFFFF";
const TAN = "F0EBE0";
const BODY_FONT = "Georgia";
const HEAD_FONT = "Gill Sans MT";

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
  return { top: none, bottom: none, left: none, right: none };
}

function labelRun(text: string, opts: { color?: string; size?: number } = {}) {
  return new TextRun({
    text, font: HEAD_FONT, bold: true, color: opts.color ?? GOLD, size: opts.size ?? 18,
    allCaps: true, characterSpacing: 20,
  });
}

function body(text: string, opts: { size?: number; italics?: boolean; bold?: boolean; color?: string } = {}) {
  return new TextRun({ text, font: BODY_FONT, size: opts.size ?? 21, italics: opts.italics, bold: opts.bold, color: opts.color });
}

function para(children: TextRun[], after = 160) {
  return new Paragraph({ children, spacing: { after } });
}

function box(fill: string, borderColor: string, paragraphs: Paragraph[]) {
  const border = { style: BorderStyle.SINGLE, size: 24, color: borderColor };
  const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill },
        borders: { top: border, bottom: border, left: none, right: none },
        margins: { top: 160, bottom: 160, left: 220, right: 220 },
        children: paragraphs,
      })],
    })],
  });
}

function sectionBanner(location: string, dateRange: string, nights: number, hotelName: string | null) {
  const subtitle = `${dateRange}  ·  ${nights} Night${nights === 1 ? "" : "s"}${hotelName ? `  ·  ${hotelName}` : ""}`;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: NAVY },
        borders: noBorders(),
        margins: { top: 220, bottom: 220, left: 260, right: 260 },
        children: [
          new Paragraph({ children: [new TextRun({ text: location.toUpperCase(), font: HEAD_FONT, bold: true, color: WHITE, size: 34 })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: subtitle, font: HEAD_FONT, color: GOLD, size: 18, allCaps: true, characterSpacing: 16 })] }),
        ],
      })],
    })],
  });
}

function pickTable(headerLeft: string, headerRight: string, rows: DocxPickRow[]) {
  const leftW = Math.round(CONTENT_WIDTH * 0.34);
  const rightW = CONTENT_WIDTH - leftW;
  const headerRow = new TableRow({
    tableHeader: true,
    children: [headerLeft, headerRight].map((t, i) => new TableCell({
      width: { size: i === 0 ? leftW : rightW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun({ text: t, font: HEAD_FONT, bold: true, color: WHITE, size: 18 })] })],
    })),
  });
  const dataRows = rows.map((r) => new TableRow({
    children: [
      new TableCell({
        width: { size: leftW, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: r.isTravellerPick ? `${r.name} ✓ Your pick` : r.name, font: BODY_FONT, bold: true, size: 20, color: NAVY })],
        })],
      }),
      new TableCell({
        width: { size: rightW, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: r.notes, font: BODY_FONT, size: 19 })] })],
      }),
    ],
  }));
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [leftW, rightW], rows: [headerRow, ...dataRows] });
}

function bullet(text: string) {
  return new Paragraph({ children: [body(text)], numbering: { reference: "day-bullets", level: 0 }, spacing: { after: 90 } });
}

function dayHeading(weekday: string, dateLabel: string, theme: string) {
  return [
    new Paragraph({
      children: [new TextRun({ text: `${weekday.toUpperCase()}, ${dateLabel.toUpperCase()}`, font: HEAD_FONT, bold: true, color: GOLD, size: 18, allCaps: true, characterSpacing: 18 })],
      spacing: { before: 300, after: 60 },
    }),
    new Paragraph({ children: [new TextRun({ text: theme, font: HEAD_FONT, bold: true, color: NAVY, size: 26 })], spacing: { after: 120 } }),
  ];
}

function gettingThere(lines: string[]) {
  return [
    para([labelRun("GETTING THERE", { size: 17 })], 100),
    ...lines.map((l) => bullet(l)),
  ];
}

function hotelWriteup(hotel: { name: string; writeup: string; isTravellerPick: boolean }) {
  return [
    para([labelRun("HOTEL ACCOMMODATIONS", { size: 17 })], 100),
    new Paragraph({
      children: [
        new TextRun({ text: hotel.isTravellerPick ? `${hotel.name} ✓ Your pick` : hotel.name, font: BODY_FONT, bold: true, size: 21, color: NAVY }),
        new TextRun({ text: ` — ${hotel.writeup}`, font: BODY_FONT, size: 21 }),
      ],
      spacing: { after: 0 },
    }),
  ];
}

function hr() {
  return new Paragraph({ text: "", border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D8D2C4", space: 1 } }, spacing: { before: 260, after: 260 } });
}

function spacer(after = 200) {
  return new Paragraph({ text: "", spacing: { after } });
}

export async function renderItineraryDocx(model: DocxModel): Promise<Buffer> {
  const glanceTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1, 1, 1, 1, 1].map(() => Math.round(CONTENT_WIDTH / 5)),
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Date", "Day", "Location", "Hotel", "Notes"].map((t) => new TableCell({
          width: { size: Math.round(CONTENT_WIDTH / 5), type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: t, font: HEAD_FONT, bold: true, color: WHITE, size: 17 })] })],
        })),
      }),
      ...model.glanceRows.map((r, i) => new TableRow({
        children: [r.dateLabel, r.weekday, r.location, r.hotel, r.notes].map((cell, ci) => new TableCell({
          width: { size: Math.round(CONTENT_WIDTH / 5), type: WidthType.DXA },
          // Transition days (arriving somewhere new) get a light-blue tint
          // instead of the normal alternating banding, so travel days stand
          // out at a glance — matches the reference example's convention.
          shading: { type: ShadingType.CLEAR, fill: r.isTransitionDay ? LIGHT_BLUE : i % 2 === 1 ? TAN : WHITE },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font: BODY_FONT, size: 18, bold: ci === 2 })] })],
        })),
      })),
    ],
  });

  const bodyChildren: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: model.title.toUpperCase(), font: HEAD_FONT, bold: true, color: NAVY, size: 56 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    new Paragraph({ children: [body(model.dateRangeLabel, { italics: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
    ...(model.travelersLabel
      ? [new Paragraph({ children: [body(model.travelersLabel, { size: 20 })], alignment: AlignmentType.CENTER, spacing: { after: 40 } })]
      : []),
    new Paragraph({
      children: [new TextRun({ text: model.regionsLine, font: HEAD_FONT, size: 18, color: GOLD, allCaps: true, characterSpacing: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    para([labelRun("TRIP AT A GLANCE", { size: 18 })], 140),
    glanceTable,
    spacer(260),
  ];

  if (model.visaEntries.length) {
    bodyChildren.push(
      box(LIGHT_BLUE, NAVY, [
        para([labelRun("VISA REQUIREMENTS", { color: NAVY, size: 17 })], 100),
        ...model.visaEntries.map((v, i) => para([body(`${v.country}: ${v.summary}`, { size: 20 })], i === model.visaEntries.length - 1 ? 0 : 90)),
      ]),
      spacer(220)
    );
  }

  model.sections.forEach((section, si) => {
    if (si > 0) bodyChildren.push(hr());
    bodyChildren.push(
      sectionBanner(section.location, section.dateRangeLabel, section.nightCount, section.hotel?.name ?? null),
      spacer(220)
    );
    if (section.gettingThere.length) {
      bodyChildren.push(...gettingThere(section.gettingThere), spacer(220));
    }
    if (section.hotel) {
      bodyChildren.push(...hotelWriteup(section.hotel), spacer(220));
    }
    section.days.forEach((day) => {
      bodyChildren.push(...dayHeading(day.weekday, day.dateLabel, day.theme));
      if (day.bullets.length) {
        day.bullets.forEach((b) => bodyChildren.push(bullet(b)));
      } else {
        bodyChildren.push(new Paragraph({ children: [body("Open — nothing scheduled yet.", { italics: true, size: 20, color: "8A8578" })], spacing: { after: 90 } }));
      }
      bodyChildren.push(spacer(220));
    });
    // One table if every restaurant here is in the same boat (all booked,
    // or all just suggestions); split into two labeled tables only when
    // there's an actual mix to distinguish.
    const hasBooked = section.restaurantsBooked.length > 0;
    const hasOptions = section.restaurantsOptions.length > 0;
    if (hasBooked && hasOptions) {
      bodyChildren.push(
        para([labelRun(`RESTAURANTS — ${section.location.toUpperCase()}`, { size: 17 })], 100),
        para([labelRun("BOOKED", { size: 15 })], 80),
        pickTable("Restaurant", "Notes", section.restaurantsBooked),
        spacer(160),
        para([labelRun("OPTIONS — ZIGY'S RECOMMENDATIONS", { size: 15 })], 80),
        pickTable("Restaurant", "Notes", section.restaurantsOptions)
      );
    } else if (hasBooked || hasOptions) {
      bodyChildren.push(
        para([labelRun(`RESTAURANTS — ${section.location.toUpperCase()}`, { size: 17 })], 100),
        pickTable("Restaurant", "Notes", hasBooked ? section.restaurantsBooked : section.restaurantsOptions)
      );
    }
  });

  if (model.bookInAdvance.length || model.seasonalNote) {
    bodyChildren.push(hr(), para([labelRun("PRACTICAL INFORMATION", { size: 20 })], 200));
    if (model.bookInAdvance.length) {
      bodyChildren.push(para([labelRun("BOOK THESE IN ADVANCE", { size: 16 })], 90));
      model.bookInAdvance.forEach((b) => bodyChildren.push(bullet(b)));
      bodyChildren.push(spacer(220));
    }
    if (model.seasonalNote) {
      bodyChildren.push(para([labelRun("SEASONAL NOTES", { size: 16 })], 90), bullet(model.seasonalNote));
    }
  }

  bodyChildren.push(spacer(260), new Paragraph({ children: [body("Have a wonderful trip.", { italics: true, size: 22 })], alignment: AlignmentType.CENTER }));

  const doc = new Document({
    numbering: {
      config: [{
        reference: "day-bullets",
        levels: [{ level: 0, format: "bullet", text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
            children: [new TextRun({ text: model.title.toUpperCase(), font: HEAD_FONT, size: 14, color: GOLD, allCaps: true, characterSpacing: 14 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
            children: [
              new TextRun({ text: "Illustrative itinerary — not booking confirmations", font: BODY_FONT, size: 14, color: "8A8578" }),
              new TextRun({ children: [new Tab(), PageNumber.CURRENT], font: BODY_FONT, italics: true, size: 16, color: NAVY }),
            ],
          })],
        }),
      },
      children: bodyChildren,
    }],
  });

  return Packer.toBuffer(doc);
}
