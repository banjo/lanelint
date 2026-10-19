import { createRequire } from 'node:module';
import type { Comment, ParseResult } from 'oxc-parser';
import type { AstInfo, ModuleExport, ModuleImport, ModuleInfo } from '../models/module.ts';
import type { WorkStats } from '../models/stats.ts';
import { ModuleCacheService, type CachedModule, type ModuleCache } from './moduleCacheService.ts';
import { LineUtil, type LineIndex } from '../utils/lineUtil.ts';

export interface ParseError {
  readonly message: string;
  readonly line: number;
}

export interface ParsedFile {
  readonly module: ModuleInfo;
  readonly errors: readonly ParseError[];
  /** The full AST. For module info from the cache, the file is read and parsed now. */
  ast(): AstInfo;
}

export interface SourceFile {
  readonly path: string;
  readonly absolutePath: string;
  readonly extension: string;
}

export interface ParseCache {
  /**
   * Module info of a file. With a known content hash it may come from the cache without
   * reading the file; otherwise `read` is called. `undefined` when the file cannot be read.
   */
  parse(
    file: SourceFile,
    hash: string | undefined,
    read: () => string | undefined,
  ): ParsedFile | undefined;
  /** Whether the module info of a file with this content hash is cached. */
  has(hash: string | undefined, extension: string): boolean;
}

const REQUIRE = /\brequire\s*\(/;

const load = createRequire(import.meta.url);
let oxc: typeof import('oxc-parser') | undefined;
/** oxc-parser loads a native binding, so it is loaded on the first parse, not at startup. */
const parser = () => (oxc ??= load('oxc-parser') as typeof import('oxc-parser'));

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
  const { Visitor } = parser();
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
  const result = parser().parseSync(absolutePath, text);
  const lines = LineUtil.create(text);
  let ast: AstInfo | undefined;
  const module = moduleOf(result, text, lines);
  return {
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

/** A file whose module info came from the cache. Its AST is built when a rule needs it. */
const fromCache = (
  cached: CachedModule,
  absolutePath: string,
  read: () => string | undefined,
): ParsedFile => {
  let parsed: ParsedFile | undefined;
  return {
    module: cached.module,
    errors: cached.errors,
    ast: () => {
      const text = read();
      if (text === undefined) {
        throw new Error(`${absolutePath} can no longer be read.`);
      }
      return (parsed ??= parseFile(absolutePath, text)).ast();
    },
  };
};

/**
 * Parses files once per content. Module info is looked up by the content's git blob hash, first
 * in this run, then in `store`, which can keep it between runs.
 */
const createCache = (store: ModuleCache, stats?: WorkStats): ParseCache => {
  const parsed = new Map<string, ParsedFile>();
  const lookup = (key: string, absolutePath: string, read: () => string | undefined) => {
    const hit = parsed.get(key);
    if (hit) {
      return hit;
    }
    const cached = store.get(key);
    if (!cached) {
      return undefined;
    }
    if (stats) {
      stats.modulesFromCache++;
    }
    const file = fromCache(cached, absolutePath, read);
    parsed.set(key, file);
    return file;
  };
  return {
    parse(file, hash, read) {
      const known =
        hash && lookup(ModuleCacheService.keyOf(hash, file.extension), file.absolutePath, read);
      if (known) {
        return known;
      }
      const text = read();
      if (text === undefined) {
        return undefined;
      }
      const key = ModuleCacheService.keyOf(ModuleCacheService.hashOf(text), file.extension);
      const hit = lookup(key, file.absolutePath, () => text);
      if (hit) {
        return hit;
      }
      if (stats) {
        stats.filesParsed++;
      }
      const result = parseFile(file.absolutePath, text);
      parsed.set(key, result);
      store.set(key, { module: result.module, errors: result.errors });
      return result;
    },
    has: (hash, extension) => {
      if (!hash) {
        return false;
      }
      const key = ModuleCacheService.keyOf(hash, extension);
      return parsed.has(key) || store.get(key) !== undefined;
    },
  };
};

export const ParseService = {
  createCache,
};
