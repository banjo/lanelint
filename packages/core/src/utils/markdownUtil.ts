/** Inline code. Inside a table cell, pipes are escaped so they do not end the cell. */
const code = (text: string, inTable = false) => {
  const body = inTable ? text.replaceAll('|', '\\|') : text;
  const fence = body.includes('`') ? '``' : '`';
  return fence.length > 1 ? `${fence} ${body} ${fence}` : `${fence}${body}${fence}`;
};

/** Text for a table cell: one line, with pipes escaped. */
const cell = (text: string) => text.replaceAll('\n', ' ').replaceAll('|', '\\|');

/** A table with aligned columns. Cells must already be escaped with `cell` or `code`. */
const table = (headers: readonly string[], rows: readonly (readonly string[])[]) => {
  const widths = headers.map((header, column) =>
    Math.max(3, header.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]) =>
    `| ${widths.map((width, column) => (cells[column] ?? '').padEnd(width)).join(' | ')} |`;
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join(
    '\n',
  );
};

/** A fenced code block. */
const fence = (language: string, body: string) => `\`\`\`${language}\n${body}\n\`\`\``;

/** The anchor GitHub creates for a heading. */
const anchor = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .replaceAll(' ', '-');

export const MarkdownUtil = {
  anchor,
  cell,
  code,
  fence,
  table,
};
