import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const stagingDir = path.join(projectRoot, "data", "staging");
const canonicalPath = path.join(projectRoot, "data", "exhibit-records.json");
const outputPath = path.join(__dirname, "collected-exhibition-data.xlsx");

const asText = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  return String(value);
};

const asDate = (value) => {
  if (!value || typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00:00`);
};

const asDateTime = (value) => {
  if (!value || typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
};

const newest = (a, b) => String(a.generatedAt || "") > String(b.generatedAt || "") ? a : b;

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

const canonicalStore = await readJson(canonicalPath);
const canonicalRecords = (canonicalStore.records || []).map((record) => ({
  sourceFile: "data/exhibit-records.json",
  generatedAt: record.updatedAt || record.createdAt || "",
  stagingId: "",
  proposalType: "canonical",
  stagingReviewStatus: record.reviewStatus || "",
  reviewBucket: record.reviewStatus === "approved" ? "Reviewed" : "Unreviewed",
  record: {
    ...record,
    sourceUrl: record.sourceUrl || record.sources?.[0]?.url || "",
  },
  sourceMeta: record.sources?.[0] || {},
  dedupeStatus: "",
  dedupeConfidence: "",
  conflictStatus: "",
  reviewerNotes: "",
  extractedAt: record.updatedAt || record.createdAt || "",
}));

const stagingFiles = (await fs.readdir(stagingDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

const stagingRows = [];
const sourceSummaryRows = [];

for (const file of stagingFiles) {
  const report = await readJson(path.join(stagingDir, file));
  const summary = report.summary || {};
  sourceSummaryRows.push({
    sourceFile: `data/staging/${file}`,
    sourceId: summary.sourceId || "",
    source: summary.source || "",
    parser: summary.parser || "",
    generatedAt: summary.generatedAt || "",
    verificationStatus: summary.verification?.status || "",
    verifiedAt: summary.verification?.verifiedAt || "",
    incomingRecords: summary.incomingRecords ?? "",
    creates: summary.creates ?? "",
    updates: summary.updates ?? "",
    possibleDuplicates: summary.possibleDuplicates ?? "",
    conflicts: summary.conflicts ?? "",
    unchanged: summary.unchanged ?? "",
    notes: summary.stagingNotes || summary.verification?.notes || "",
  });

  for (const item of report.items || []) {
    const record = item.proposed || item.after || item.before || {};
    stagingRows.push({
      sourceFile: `data/staging/${file}`,
      generatedAt: summary.generatedAt || item.extractedAt || "",
      stagingId: item.id || "",
      proposalType: item.proposalType || "",
      stagingReviewStatus: item.reviewStatus || "",
      reviewBucket: item.reviewStatus === "approved" ? "Reviewed" : "Unreviewed",
      record,
      sourceMeta: item.source || {},
      dedupeStatus: item.dedupe?.status || "",
      dedupeConfidence: item.dedupe?.confidence ?? "",
      conflictStatus: item.conflict?.status || "",
      reviewerNotes: item.reviewerNotes || "",
      extractedAt: item.extractedAt || "",
    });
  }
}

const deduped = new Map();
for (const row of [...canonicalRecords, ...stagingRows]) {
  const record = row.record || {};
  const key = [
    record.id || "",
    record.sourceUrl || record.exhibitionUrl || row.sourceMeta.url || "",
    record.title || "",
    record.venue || "",
  ].join("|");
  const existing = deduped.get(key);
  deduped.set(key, existing ? newest(existing, row) : row);
}

const allCollectedRows = [...deduped.values()];
const mainRows = allCollectedRows.filter((row) => row.record?.type === "exhibition").sort((a, b) => {
  const av = `${a.record.venue || ""}|${a.record.startDate || ""}|${a.record.title || ""}`;
  const bv = `${b.record.venue || ""}|${b.record.startDate || ""}|${b.record.title || ""}`;
  return av.localeCompare(bv);
});
const otherRows = allCollectedRows.filter((row) => row.record?.type !== "exhibition").sort((a, b) => {
  const av = `${a.record.type || ""}|${a.record.artistName || a.record.title || ""}|${a.record.sourceUrl || ""}`;
  const bv = `${b.record.type || ""}|${b.record.artistName || b.record.title || ""}|${b.record.sourceUrl || ""}`;
  return av.localeCompare(bv);
});

const venueStats = new Map();
for (const row of mainRows) {
  const record = row.record || {};
  const venue = record.venue || "(No venue)";
  const stats = venueStats.get(venue) || {
    venue,
    total: 0,
    reviewed: 0,
    unreviewed: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
    firstStart: "",
    latestEnd: "",
  };
  stats.total += 1;
  if (row.reviewBucket === "Reviewed") stats.reviewed += 1;
  else stats.unreviewed += 1;
  const confidence = record.sourceConfidence || "unknown";
  if (stats[confidence] !== undefined) stats[confidence] += 1;
  else stats.unknown += 1;
  if (record.startDate && (!stats.firstStart || record.startDate < stats.firstStart)) stats.firstStart = record.startDate;
  if (record.endDate && (!stats.latestEnd || record.endDate > stats.latestEnd)) stats.latestEnd = record.endDate;
  venueStats.set(venue, stats);
}

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("Summary");
const allSheet = workbook.worksheets.add("All Exhibitions");
const otherSheet = workbook.worksheets.add("Other Collected Items");
const rawSheet = workbook.worksheets.add("Raw Staging Items");
const sourcesSheet = workbook.worksheets.add("Source Runs");

const writeRows = (sheet, headers, rows) => {
  const matrix = [headers, ...rows];
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;
  const headerRange = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  headerRange.format.fill.color = "#1F2937";
  headerRange.format.font.color = "#FFFFFF";
  headerRange.format.font.bold = true;
  headerRange.format.wrapText = true;
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  const used = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
  used.format.font.name = "Aptos";
  used.format.font.size = 10;
  used.format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    bottom: { style: "thin", color: "#CBD5E1" },
  };
  used.format.autofitColumns();
  used.format.autofitRows();
};

const mainHeaders = [
  "Review Bucket",
  "Staging Status",
  "Proposal Type",
  "Type",
  "Venue",
  "Title",
  "Start Date",
  "End Date",
  "Date Text",
  "Artists",
  "Curators",
  "Neighborhood",
  "Borough",
  "City",
  "Address",
  "Source Confidence",
  "Tags",
  "Description",
  "Exhibition URL",
  "Source URL",
  "Image URL",
  "Record ID",
  "Source File",
  "Generated At",
  "Extracted At",
  "Dedupe Status",
  "Dedupe Confidence",
  "Reviewer Notes",
  "Source Notes",
];

const mainMatrix = mainRows.map((row) => {
  const r = row.record || {};
  return [
    row.reviewBucket,
    row.stagingReviewStatus || r.reviewStatus || "",
    row.proposalType,
    r.type || "",
    r.venue || "",
    r.title || "",
    asDate(r.startDate),
    asDate(r.endDate),
    r.dateText || "",
    asText(r.artists),
    asText(r.curators),
    r.neighborhood || "",
    r.borough || "",
    r.city || "",
    r.venueAddress || "",
    r.sourceConfidence || "",
    asText(r.tags),
    r.description || "",
    r.exhibitionUrl || "",
    r.sourceUrl || row.sourceMeta.url || "",
    r.imageUrl || "",
    r.id || "",
    row.sourceFile,
    asDateTime(row.generatedAt),
    asDateTime(row.extractedAt),
    row.dedupeStatus,
    row.dedupeConfidence,
    row.reviewerNotes,
    r.sourceNotes || row.sourceMeta.notes || "",
  ];
});

writeRows(allSheet, mainHeaders, mainMatrix);
allSheet.getRange(`G2:H${mainMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd");
allSheet.getRange(`X2:Y${mainMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
allSheet.getRange("A:A").format.columnWidth = 16;
allSheet.getRange("E:E").format.columnWidth = 28;
allSheet.getRange("F:F").format.columnWidth = 42;
allSheet.getRange("R:R").format.columnWidth = 60;
allSheet.getRange("S:U").format.columnWidth = 42;
allSheet.getRange("AC:AC").format.columnWidth = 60;
allSheet.getRange(`A2:A${mainMatrix.length + 1}`).dataValidation = {
  rule: { type: "list", values: ["Reviewed", "Unreviewed"] },
};

const otherHeaders = [
  "Review Bucket",
  "Staging Status",
  "Proposal Type",
  "Type",
  "Name / Title",
  "Artist",
  "Gallery",
  "Birth Date",
  "Birth Place",
  "Gender",
  "Medium",
  "Year",
  "Dimensions",
  "Description",
  "Source URL",
  "Image URL",
  "Record ID",
  "Source File",
  "Generated At",
  "Extracted At",
  "Dedupe Status",
  "Reviewer Notes",
];

const otherMatrix = otherRows.map((row) => {
  const r = row.record || {};
  return [
    row.reviewBucket,
    row.stagingReviewStatus || r.reviewStatus || "",
    row.proposalType,
    r.type || "",
    r.artistName || r.title || "",
    r.artistName || r.artist || "",
    r.gallery || "",
    r.birthDate || "",
    r.birthPlace || "",
    r.gender || "",
    r.medium || "",
    r.year || "",
    r.dimensions || "",
    r.description || "",
    r.sourceUrl || row.sourceMeta.url || "",
    r.imageUrl || "",
    r.id || "",
    row.sourceFile,
    asDateTime(row.generatedAt),
    asDateTime(row.extractedAt),
    row.dedupeStatus,
    row.reviewerNotes,
  ];
});

writeRows(otherSheet, otherHeaders, otherMatrix);
otherSheet.getRange(`S2:T${otherMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
otherSheet.getRange("E:F").format.columnWidth = 30;
otherSheet.getRange("N:P").format.columnWidth = 48;
otherSheet.getRange("R:R").format.columnWidth = 56;

const rawHeaders = [
  "Review Bucket",
  "Staging Status",
  "Proposal Type",
  "Type",
  "Venue",
  "Title",
  "Start Date",
  "End Date",
  "Date Text",
  "Source Confidence",
  "Exhibition URL",
  "Source URL",
  "Record ID",
  "Staging ID",
  "Source File",
  "Generated At",
  "Extracted At",
  "Dedupe Status",
  "Dedupe Confidence",
  "Conflict Status",
  "Reviewer Notes",
];

const rawMatrix = stagingRows
  .sort((a, b) => `${a.sourceFile}|${a.record.venue}|${a.record.title}`.localeCompare(`${b.sourceFile}|${b.record.venue}|${b.record.title}`))
  .map((row) => {
    const r = row.record || {};
    return [
      row.reviewBucket,
      row.stagingReviewStatus,
      row.proposalType,
      r.type || "",
      r.venue || "",
      r.title || "",
      asDate(r.startDate),
      asDate(r.endDate),
      r.dateText || "",
      r.sourceConfidence || "",
      r.exhibitionUrl || "",
      r.sourceUrl || row.sourceMeta.url || "",
      r.id || "",
      row.stagingId,
      row.sourceFile,
      asDateTime(row.generatedAt),
      asDateTime(row.extractedAt),
      row.dedupeStatus,
      row.dedupeConfidence,
      row.conflictStatus,
      row.reviewerNotes,
    ];
  });

writeRows(rawSheet, rawHeaders, rawMatrix);
rawSheet.getRange(`G2:H${rawMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd");
rawSheet.getRange(`P2:Q${rawMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
rawSheet.getRange("E:F").format.columnWidth = 38;
rawSheet.getRange("K:L").format.columnWidth = 42;
rawSheet.getRange("N:O").format.columnWidth = 44;

const sourceHeaders = [
  "Source File",
  "Source ID",
  "Source",
  "Parser",
  "Generated At",
  "Verification Status",
  "Verified At",
  "Incoming Records",
  "Creates",
  "Updates",
  "Possible Duplicates",
  "Conflicts",
  "Unchanged",
  "Notes",
];
const sourceMatrix = sourceSummaryRows.map((row) => sourceHeaders.map((header) => row[header.charAt(0).toLowerCase() + header.slice(1).replaceAll(" ", "")] ?? ""));
for (const [i, row] of sourceSummaryRows.entries()) {
  sourceMatrix[i] = [
    row.sourceFile,
    row.sourceId,
    row.source,
    row.parser,
    asDateTime(row.generatedAt),
    row.verificationStatus,
    asDateTime(row.verifiedAt),
    row.incomingRecords,
    row.creates,
    row.updates,
    row.possibleDuplicates,
    row.conflicts,
    row.unchanged,
    row.notes,
  ];
}
writeRows(sourcesSheet, sourceHeaders, sourceMatrix);
sourcesSheet.getRange(`E2:E${sourceMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
sourcesSheet.getRange(`G2:G${sourceMatrix.length + 1}`).setNumberFormat("yyyy-mm-dd hh:mm");
sourcesSheet.getRange("A:A").format.columnWidth = 48;
sourcesSheet.getRange("E:E").format.columnWidth = 20;
sourcesSheet.getRange("G:G").format.columnWidth = 20;
sourcesSheet.getRange("N:N").format.columnWidth = 70;

summarySheet.showGridLines = false;
summarySheet.getRange("A1:H1").merge();
summarySheet.getRange("A1").values = [["Collected Exhibition Data"]];
summarySheet.getRange("A1").format.font.bold = true;
summarySheet.getRange("A1").format.font.size = 18;
summarySheet.getRange("A1").format.fill.color = "#1F2937";
summarySheet.getRange("A1").format.font.color = "#FFFFFF";
summarySheet.getRange("A3:B8").values = [
  ["Deduped exhibition rows", mainRows.length],
  ["Raw staging items", stagingRows.length],
  ["Other collected rows", otherRows.length],
  ["Reviewed exhibitions", mainRows.filter((row) => row.reviewBucket === "Reviewed").length],
  ["Unreviewed exhibitions", mainRows.filter((row) => row.reviewBucket !== "Reviewed").length],
  ["Staging source files", stagingFiles.length],
];
summarySheet.getRange("A3:B8").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
summarySheet.getRange("A3:A8").format.fill.color = "#F1F5F9";
summarySheet.getRange("A3:A8").format.font.bold = true;
summarySheet.getRange("B3:B8").setNumberFormat("#,##0");

const venueHeaders = ["Venue", "Total", "Reviewed", "Unreviewed", "High Confidence", "Medium Confidence", "Low Confidence", "Unknown Confidence", "First Start", "Latest End"];
const venueMatrix = [...venueStats.values()]
  .sort((a, b) => b.total - a.total || a.venue.localeCompare(b.venue))
  .map((row) => [
    row.venue,
    row.total,
    row.reviewed,
    row.unreviewed,
    row.high,
    row.medium,
    row.low,
    row.unknown,
    asDate(row.firstStart),
    asDate(row.latestEnd),
  ]);
summarySheet.getRangeByIndexes(10, 0, 1 + venueMatrix.length, venueHeaders.length).values = [venueHeaders, ...venueMatrix];
summarySheet.getRange("A11:J11").format.fill.color = "#1F2937";
summarySheet.getRange("A11:J11").format.font.color = "#FFFFFF";
summarySheet.getRange("A11:J11").format.font.bold = true;
summarySheet.getRangeByIndexes(10, 0, 1 + venueMatrix.length, venueHeaders.length).format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
  bottom: { style: "thin", color: "#CBD5E1" },
};
summarySheet.getRange(`I12:J${11 + venueMatrix.length}`).setNumberFormat("yyyy-mm-dd");
summarySheet.freezePanes.freezeRows(11);
summarySheet.getRange("A:J").format.autofitColumns();
summarySheet.getRange("A:A").format.columnWidth = 34;

for (const sheet of [summarySheet, allSheet, otherSheet, rawSheet, sourcesSheet]) {
  const used = sheet.getUsedRange();
  used.format.wrapText = false;
  sheet.getRange("1:1").format.wrapText = true;
}

const inspected = await workbook.inspect({
  kind: "workbook,sheet,table",
  tableMaxRows: 5,
  tableMaxCols: 8,
  maxChars: 6000,
});
console.log(inspected.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Summary", "All Exhibitions", "Other Collected Items", "Raw Staging Items", "Source Runs"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  const previewBytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(path.join(__dirname, `${sheetName.replaceAll(" ", "-").toLowerCase()}.png`), previewBytes);
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
