// Минимальный .xlsx: один лист, строки ячеек со стилями, закреплённая шапка.
// XLSX — это zip с XML; zip даёт jszip (уже в зависимостях через docx-preview),
// XML пишем сами. ponytail: только то, что нужно табелю — без формул, слияний
// и общих строк (inlineStr); понадобится больше — exceljs.

import JSZip from "jszip";

export type CellStyle = {
  bold?: boolean;
  italic?: boolean;
  /** «RRGGBB» без решётки. */
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  /** Формат числа, например «0.0#». */
  numFmt?: string;
};

export type Cell = { value: string | number | null; style?: CellStyle } | string | number | null;

export type SheetSpec = {
  name: string;
  rows: Cell[][];
  /** Ширины колонок в символах. */
  widths: number[];
  /** Сколько колонок и строк закрепить. */
  freeze?: { cols: number; rows: number };
};

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 0 → A, 25 → Z, 26 → AA. */
export const columnName = (index: number): string => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

/** Реестр стилей: одинаковые стили — один индекс в cellXfs. */
const styleRegistry = () => {
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const numFmts: string[] = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const byKey = new Map<string, number>([["", 0]]);

  const index = (style?: CellStyle): number => {
    if (!style) return 0;
    const key = JSON.stringify(style);
    const known = byKey.get(key);
    if (known != null) return known;

    let fontId = 0;
    if (style.bold || style.italic || style.color) {
      fonts.push(
        `<font>${style.bold ? "<b/>" : ""}${style.italic ? "<i/>" : ""}<sz val="11"/>${style.color ? `<color rgb="FF${style.color}"/>` : ""}<name val="Calibri"/></font>`
      );
      fontId = fonts.length - 1;
    }
    let fillId = 0;
    if (style.fill) {
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`);
      fillId = fills.length - 1;
    }
    let numFmtId = 0;
    if (style.numFmt) {
      numFmtId = 164 + numFmts.length;
      numFmts.push(`<numFmt numFmtId="${numFmtId}" formatCode="${escapeXml(style.numFmt)}"/>`);
    }
    const alignment = style.align ? `<alignment horizontal="${style.align}"/>` : "";
    xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${fontId ? ' applyFont="1"' : ""}${fillId ? ' applyFill="1"' : ""}${numFmtId ? ' applyNumberFormat="1"' : ""}${alignment ? ' applyAlignment="1">' + alignment + "</xf>" : "/>"}`
    );
    byKey.set(key, xfs.length - 1);
    return xfs.length - 1;
  };

  const xml = () =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : "") +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  return { index, xml };
};

const sheetXml = (spec: SheetSpec, styleIndex: (style?: CellStyle) => number): string => {
  const rows = spec.rows
    .map((row, r) => {
      const cells = row
        .map((raw, c) => {
          const cell = raw !== null && typeof raw === "object" ? raw : { value: raw };
          if (cell.value === null || cell.value === "") {
            return cell.style ? `<c r="${columnName(c)}${r + 1}" s="${styleIndex(cell.style)}"/>` : "";
          }
          const ref = `${columnName(c)}${r + 1}`;
          const s = styleIndex(cell.style);
          const attr = s ? ` s="${s}"` : "";
          return typeof cell.value === "number"
            ? `<c r="${ref}"${attr}><v>${cell.value}</v></c>`
            : `<c r="${ref}"${attr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const freeze = spec.freeze;
  const pane = freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${freeze.cols}" ySplit="${freeze.rows}" topLeftCell="${columnName(freeze.cols)}${freeze.rows + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : "";
  const cols = spec.widths.length
    ? `<cols>${spec.widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`
  );
};

export const buildXlsx = async (spec: SheetSpec): Promise<Blob> => {
  const styles = styleRegistry();
  // Лист строится раньше стилей: стили регистрируются по мере встречи.
  const sheet = sheetXml(spec, styles.index);
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>"
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>"
  );
  zip.file(
    "xl/workbook.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${escapeXml(spec.name.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>"
  );
  zip.file("xl/worksheets/sheet1.xml", sheet);
  zip.file("xl/styles.xml", styles.xml());
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
