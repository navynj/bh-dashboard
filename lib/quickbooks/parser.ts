/**
 * Parse QuickBooks P&L report JSON: income total, COS total, COS by category.
 */

/** Parsed P&L: total income and Cost of Goods Sold line items (category name + amount). */
export type ProfitAndLossParsed = {
  incomeTotal?: number;
  cosTotal?: number;
  cosByCategory?: { categoryId: string; name: string; amount: number }[];
};

/** Raw QuickBooks P&L report response. */
export type QuickBooksProfitAndLossRaw = {
  Header?: { Time?: string; ReportName?: string; [k: string]: unknown };
  Columns?: { Column?: unknown[] };
  Rows?: { Row?: unknown[] };
};

/** Parsable P&L report structure from GET /api/quickbooks/pnl. */
export type PnlReportData = QuickBooksProfitAndLossRaw;

/** Controls which P&L data to parse and return. */
export type ProfitAndLossDataOption = 'income,cos' | 'cos';

function parseAmount(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const s = String(value).replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : Math.abs(n);
}

function findSection(
  rows: { Row?: unknown[] } | undefined,
  titleMatch: (title: string) => boolean,
): unknown | undefined {
  const rowList = Array.isArray(rows?.Row) ? rows.Row : [];
  for (const row of rowList) {
    const header = (row as { Header?: { ColData?: { value?: string }[] } })
      ?.Header?.ColData?.[0]?.value;
    if (header && titleMatch(header)) return row;
    const group = (row as { group?: string }).group;
    if (group && titleMatch(group)) return row;
  }
  return undefined;
}

/**
 * For multi-period P&L reports, QuickBooks returns one column per period plus a "Total" column.
 * We use the Total column (last) so income/COS reflect the full requested range; otherwise use the single value column (index 1).
 * Blank/empty cells are treated as 0 via parseAmount.
 */
function getValueColumnIndex(colData: { value?: unknown }[] | undefined): number {
  const arr = Array.isArray(colData) ? colData : [];
  if (arr.length > 2) return arr.length - 1; // Total column
  return 1; // Single period value
}

function rowTotal(row: unknown): number {
  const r = row as {
    Summary?: { ColData?: { value?: unknown }[] };
    ColData?: { value?: unknown }[];
  };
  const summary = r?.Summary?.ColData;
  const colData = r?.ColData;
  const fromSummary = Array.isArray(summary) && summary.length >= 2;
  const data = fromSummary ? summary : colData;
  const idx = getValueColumnIndex(data);
  if (Array.isArray(data) && data.length > idx) {
    return parseAmount(data[idx]?.value);
  }
  return 0;
}

type PlRow = {
  ColData?: { value?: string }[];
  Rows?: { Row?: PlRow[] };
  Header?: { ColData?: { value?: string }[] };
  Summary?: { ColData?: { value?: unknown }[] };
};

function lineName(row: PlRow): string {
  const cols = row?.ColData;
  if (!Array.isArray(cols) || cols.length < 1) return '';
  return (cols[0]?.value ?? '').trim();
}

function categoryOrLineName(row: PlRow): string {
  const header = row?.Header?.ColData?.[0]?.value;
  if (header != null && String(header).trim()) return String(header).trim();
  return lineName(row);
}

/** Extract COS number from names like "COS1- Supplier BH", "COS6 - Coffee beans, Teas". Used so categoryId is stable when QB omits rows (e.g. COS5 with no activity). */
function cosNumberFromName(name: string): number | null {
  const m = name.trim().match(/^COS\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Recurse COS section: use raw report structure. Top-level id = qb-${cosNum-1} when name is "COSn"; child id = parentId + "-" + idx so children attach to the correct COS parent (e.g. L3 MAIN COS 6 under COS6 = qb-5-0, not qb-2-0).
 */
function sectionCosLineItemsRecurse(
  row: PlRow,
  path: number[],
  parentId: string | null,
  out: { id: string; name: string; amount: number }[],
): void {
  const name = categoryOrLineName(row);
  if (!name) return;
  if (!row?.Header && /^cost of (goods )?sold$/i.test(name.trim())) return;
  const cosNum = cosNumberFromName(name);
  const isTopLevel = path.length === 1;
  const id =
    cosNum != null && isTopLevel
      ? `qb-${cosNum - 1}`
      : parentId != null
        ? `${parentId}-${path[path.length - 1] ?? 0}`
        : `qb-${path.join('-')}`;
  out.push({ id, name, amount: rowTotal(row) });
  const subRows = row?.Rows?.Row;
  if (!Array.isArray(subRows) || subRows.length === 0) return;
  subRows.forEach((sub, idx) => {
    sectionCosLineItemsRecurse(sub, [...path, idx], id, out);
  });
}

function sectionCosLineItems(
  row: unknown,
): { id: string; name: string; amount: number }[] {
  const r = row as { Rows?: { Row?: PlRow[] } };
  const out: { id: string; name: string; amount: number }[] = [];
  const rowList = Array.isArray(r?.Rows?.Row) ? r.Rows.Row : [];
  rowList.forEach((category, catIdx) => {
    sectionCosLineItemsRecurse(category, [catIdx], null, out);
  });
  return out;
}

export function parseIncomeFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): number {
  const incomeSection = findSection(rows, (t) => /^income$/i.test(t.trim()));
  if (!incomeSection) return 0;
  return rowTotal(incomeSection);
}

export function parseCosTotalFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): number {
  const cosSection = findSection(rows, (t) =>
    /cost of (goods )?sold|cost of sales/i.test(t.trim()),
  );
  if (!cosSection) return 0;
  return rowTotal(cosSection);
}

export function parseCosFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): { categoryId: string; name: string; amount: number }[] {
  const cosSection = findSection(rows, (t) =>
    /cost of (goods )?sold|cost of sales/i.test(t.trim()),
  );
  if (!cosSection) return [];
  return sectionCosLineItems(cosSection).map((c) => ({
    categoryId: c.id,
    name: c.name,
    amount: c.amount,
  }));
}

export function getIncomeFromPnlReport(report: PnlReportData): number {
  return parseIncomeFromReportRows(report?.Rows);
}

export function getCosFromPnlReport(report: PnlReportData): {
  cosTotal: number;
  cosByCategory: { categoryId: string; name: string; amount: number }[];
} {
  const rows = report?.Rows;
  return {
    cosTotal: parseCosTotalFromReportRows(rows),
    cosByCategory: parseCosFromReportRows(rows),
  };
}

export function getBudgetDataFromPnlReport(report: PnlReportData): {
  incomeTotal: number;
  cosTotal: number;
  cosByCategory: { categoryId: string; name: string; amount: number }[];
} {
  const rows = report?.Rows;
  return {
    incomeTotal: parseIncomeFromReportRows(rows),
    cosTotal: parseCosTotalFromReportRows(rows),
    cosByCategory: parseCosFromReportRows(rows),
  };
}
