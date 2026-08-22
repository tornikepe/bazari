/**
 * A product's specifications.
 *
 * Stored as JSON, which means the shape arriving from the database is
 * *unknown* rather than typed: a column written by an older version of this
 * code, by a migration, or by hand in a SQL console is still a valid `Json`
 * and still lands here. So nothing trusts it — every read goes through
 * `parseSpecs`, which returns only rows it recognises and drops the rest
 * rather than throwing. A product page that renders four of five
 * specifications is a small fault; one that 500s because a row is malformed is
 * a large one.
 */

export type Spec = {
  labelKa: string;
  labelEn: string;
  valueKa: string;
  valueEn: string;
};

/**
 * As many rows as a product page can carry before the table stops being read.
 *
 * Also the cap the form enforces, so the two cannot disagree about when to
 * stop offering "add another".
 */
export const MAX_SPECS = 20;

const MAX_LENGTH = 120;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_LENGTH) : "";
}

/**
 * The rows worth showing, in order.
 *
 * A row survives when it has *something* to say in at least one language on
 * both sides: a label with no value is a heading nobody asked for, and a value
 * with no label is a number with no meaning.
 */
export function parseSpecs(value: unknown): Spec[] {
  if (!Array.isArray(value)) return [];

  const rows: Spec[] = [];

  for (const raw of value) {
    if (raw === null || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;

    const spec: Spec = {
      labelKa: text(row.labelKa),
      labelEn: text(row.labelEn),
      valueKa: text(row.valueKa),
      valueEn: text(row.valueEn),
    };

    const labelled = spec.labelKa !== "" || spec.labelEn !== "";
    const valued = spec.valueKa !== "" || spec.valueEn !== "";
    if (!labelled || !valued) continue;

    rows.push(spec);
    if (rows.length === MAX_SPECS) break;
  }

  return rows;
}

/**
 * One row as the reader of a given language sees it.
 *
 * Falls back to the other language rather than showing a blank cell. A shop
 * that has filled in only English has said something true, and hiding it from
 * a Georgian reader helps nobody; the alternative is a table with holes in it.
 */
export function readSpec(spec: Spec, locale: "ka" | "en"): { label: string; value: string } {
  return locale === "ka"
    ? { label: spec.labelKa || spec.labelEn, value: spec.valueKa || spec.valueEn }
    : { label: spec.labelEn || spec.labelKa, value: spec.valueEn || spec.valueKa };
}

/**
 * The rows a submitted form is asking to store.
 *
 * The four fields of a row are posted as four parallel lists, because that is
 * what a set of repeated inputs in one form produces. They are zipped back
 * together here and then put through the same parser the database goes
 * through, so the form cannot store a shape the page would later reject.
 */
export function specsFromForm(formData: {
  getAll(name: string): unknown[];
}): Spec[] {
  const columns = (["labelKa", "labelEn", "valueKa", "valueEn"] as const).map((name) =>
    formData.getAll(`spec_${name}`).map((value) => String(value)),
  );

  const rows = Math.max(...columns.map((column) => column.length));

  return parseSpecs(
    Array.from({ length: rows }, (_, index) => ({
      labelKa: columns[0]![index] ?? "",
      labelEn: columns[1]![index] ?? "",
      valueKa: columns[2]![index] ?? "",
      valueEn: columns[3]![index] ?? "",
    })),
  );
}
