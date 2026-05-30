type CellValue = string | number | boolean | null | undefined;

export type WorksheetSpec = {
  name: string;
  rows: CellValue[][];
  widths?: number[];
  validations?: { range: string; options: string[] }[];
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function writeUInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function zip(entries: { path: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const checksum = crc32(content);

    const local = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(checksum),
      writeUInt32(content.length),
      writeUInt32(content.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
      content,
    ]);
    localParts.push(local);

    centralParts.push(
      Buffer.concat([
        writeUInt32(0x02014b50),
        writeUInt16(20),
        writeUInt16(20),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(checksum),
        writeUInt32(content.length),
        writeUInt32(content.length),
        writeUInt16(name.length),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(0),
        writeUInt32(offset),
        name,
      ]),
    );
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(central.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function cellXml(value: CellValue, rowIndex: number, colIndex: number): string {
  if (value === null || value === undefined || value === "") return "";
  const ref = `${columnName(colIndex)}${rowIndex + 1}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(String(value))}</t></is></c>`;
}

function worksheetXml(sheet: WorksheetSpec): string {
  const maxCols = Math.max(...sheet.rows.map((row) => row.length), 1);
  const widths =
    sheet.widths ??
    Array.from({ length: maxCols }, (_, index) => {
      const longest = Math.max(
        ...sheet.rows.map((row) => String(row[index] ?? "").length),
        8,
      );
      return Math.min(Math.max(longest + 2, 10), 60);
    });

  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row.map((value, colIndex) => cellXml(value, rowIndex, colIndex)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const validations = sheet.validations?.length
    ? `<dataValidations count="${sheet.validations.length}">${sheet.validations
        .map(
          (validation) =>
            `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${xml(validation.range)}"><formula1>"${xml(validation.options.join(","))}"</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`
    : "";
  const dimension = `${columnName(0)}1:${columnName(maxCols - 1)}${Math.max(sheet.rows.length, 1)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${rows}</sheetData>
  ${validations}
</worksheet>`;
}

function workbookXml(sheets: WorksheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map((sheet, index) => `<sheet name="${xml(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}
  </sheets>
</workbook>`;
}

function workbookRels(sheets: WorksheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("")}
</Relationships>`;
}

function contentTypes(sheets: WorksheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("")}
</Types>`;
}

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

export function createXlsx(sheets: WorksheetSpec[]): Buffer {
  return zip([
    { path: "[Content_Types].xml", content: contentTypes(sheets) },
    { path: "_rels/.rels", content: rootRels },
    { path: "xl/workbook.xml", content: workbookXml(sheets) },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRels(sheets) },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(sheet),
    })),
  ]);
}
