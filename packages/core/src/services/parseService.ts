import { parseSync, Visitor, type Comment, type ParseResult } from 'oxc-parser';
import type { AstInfo, ModuleExport, ModuleImport, ModuleInfo } from '../models/module.ts';
import type { WorkStats } from '../models/stats.ts';
import { LineUtil, type LineIndex } from '../utils/lineUtil.ts';

export interface ParseError {
  readonly message: string;
  readonly line: number;
}

export interface ParsedFile {
  readonly text: string;
  readonly module: ModuleInfo;
  readonly errors: readonly ParseError[];
  readonly lines: LineIndex;
  ast(): AstInfo;
}

export interface ParseCache {
  /** Parses a file, reusing the result when the same path was parsed with the same text. */
  parse(path: string, absolutePath: string, text: string): ParsedFile;
}

const REQUIRE = /\brequire\s*\(/;

// oxc-parser types its kinds as const enums, which cannot be compared to literals directly.
const kindOf = (value: { readonly kind: unknown }) => String(value.kind);

/** `default`, a plain name, or `*` for namespaces and `export *`. */
const nameOf = (name: { readonly kind: unknown; readonly name: string | null }) => {
  switch (kindOf(name)) {
    case 'Default':
      return 'default';
    case 'Name':
      return name.name ?? '';
    default:
      return '*';
  }
};

const requiresOf = (result: ParseResult, lines: LineIndex): ModuleImport[] => {
  const found: ModuleImport[] = [];
  const add = (specifier: string, start: number) =>
    found.push({
      specifier,
      line: lines.lineOf(start),
      syntax: 'require',
      typeOnly: false,
      names: ['*'],
      locals: [],
      reexport: false,
    });
  new Visitor({
    CallExpression(node) {
      const [argument] = node.arguments;
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments.length === 1 &&
        argument?.type === 'Literal' &&
        typeof argument.value === 'string'
      ) {
        add(argument.value, argument.start);
      }
    },
    TSExternalModuleReference(node) {
      add(node.expression.value, node.expression.start);
    },
  }).visit(result.program);
  return found;
};

const moduleOf = (result: ParseResult, text: string, lines: LineIndex): ModuleInfo => {
  const record = result.module;
  const imports: ModuleImport[] = [];
  // Import statements by the offset of their module request.
  const importAt = new Map<number, number>();
  for (const statement of record.staticImports) {
    importAt.set(statement.moduleRequest.start, imports.length);
    imports.push({
      specifier: statement.moduleRequest.value,
      line: lines.lineOf(statement.moduleRequest.start),
      syntax: 'import',
      typeOnly: statement.entries.length > 0 && statement.entries.every((entry) => entry.isType),
      names: statement.entries.map((entry) => nameOf(entry.importName)),
      locals: statement.entries.map((entry) => entry.localName.value),
      reexport: false,
    });
  }
  const markReexported = (index: number | undefined) => {
    const entry = index === undefined ? undefined : imports[index];
    if (index !== undefined && entry) {
      imports[index] = { ...entry, reexport: true };
    }
  };
  const exports: ModuleExport[] = [];
  const exportedLocals = new Set<string>();
  for (const statement of record.staticExports) {
    const reexports = new Map<number, ModuleImport>();
    for (const entry of statement.entries) {
      exports.push({
        name: nameOf(entry.exportName),
        local: entry.localName.name ?? undefined,
        typeOnly: entry.isType,
        line: lines.lineOf(entry.start),
        start: entry.start,
        statementStart: statement.start,
        specifier: entry.moduleRequest?.value,
      });
      const request = entry.moduleRequest;
      if (!request) {
        if (entry.localName.name) {
          exportedLocals.add(entry.localName.name);
        }
        continue;
      }
      // `import { a } from 'x'; export { a }` is an indirect export with the import's request.
      if (importAt.has(request.start)) {
        markReexported(importAt.get(request.start));
        continue;
      }
      const existing = reexports.get(request.start);
      reexports.set(request.start, {
        specifier: request.value,
        line: lines.lineOf(request.start),
        syntax: 'export',
        typeOnly: (existing?.typeOnly ?? true) && entry.isType,
        names: [...(existing?.names ?? []), nameOf(entry.importName)],
        locals: [],
        reexport: true,
      });
    }
    imports.push(...reexports.values());
  }
  imports.forEach((entry, index) => {
    if (entry.locals.some((local) => exportedLocals.has(local))) {
      markReexported(index);
    }
  });
  for (const dynamic of record.dynamicImports) {
    const raw = text.slice(dynamic.moduleRequest.start, dynamic.moduleRequest.end).trim();
    const literal = /^(['"`])([^'"`$]*)\1$/.exec(raw);
    if (literal?.[2] !== undefined) {
      imports.push({
        specifier: literal[2],
        line: lines.lineOf(dynamic.moduleRequest.start),
        syntax: 'dynamic',
        typeOnly: false,
        names: ['*'],
        locals: [],
        reexport: false,
      });
    }
  }
  if (REQUIRE.test(text)) {
    imports.push(...requiresOf(result, lines));
  }
  return { imports, exports, hasModuleSyntax: record.hasModuleSyntax };
};

const astOf = (
  result: ParseResult,
  text: string,
  lines: LineIndex,
  module: ModuleInfo,
): AstInfo => {
  const comments = result.comments;
  return {
    // Deserializing the program is the expensive part of parsing, so it waits until a rule reads it.
    get program() {
      return result.program;
    },
    comments,
    text,
    module,
    lineOf: (offset) => lines.lineOf(offset),
    leadingComments(offset) {
      const leading: Comment[] = [];
      let end = offset;
      for (let index = comments.length - 1; index >= 0; index--) {
        const comment = comments[index];
        if (!comment || comment.end > end) {
          continue;
        }
        if (text.slice(comment.end, end).trim()) {
          break;
        }
        leading.unshift(comment);
        end = comment.start;
      }
      return leading;
    },
  };
};

const parseFile = (absolutePath: string, text: string): ParsedFile => {
  const result = parseSync(absolutePath, text);
  const lines = LineUtil.create(text);
  let ast: AstInfo | undefined;
  const module = moduleOf(result, text, lines);
  return {
    text,
    lines,
    module,
    errors: result.errors
      .filter((error) => String(error.severity) === 'Error')
      .map((error) => ({
        message: error.message,
        line: lines.lineOf(error.labels[0]?.start ?? 0),
      })),
    ast: () => (ast ??= astOf(result, text, lines, module)),
  };
};

const createCache = (stats?: WorkStats): ParseCache => {
  const entries = new Map<string, ParsedFile>();
  return {
    parse(path, absolutePath, text) {
      const cached = entries.get(path);
      if (cached?.text === text) {
        return cached;
      }
      if (stats) {
        stats.filesParsed++;
      }
      const parsed = parseFile(absolutePath, text);
      entries.set(path, parsed);
      return parsed;
    },
  };
};

export const ParseService = {
  createCache,
};
