/**
 * Pure formatting functions for Sieve scripts.
 * No VS Code API dependency — keep testable without a VS Code instance.
 */

/**
 * Split a comma-separated string into items, respecting double-quoted strings
 * so that commas inside strings are not treated as separators.
 */
function splitOnCommas(content: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;

  for (const ch of content) {
    if (ch === '"') {
      inString = !inString;
      current += ch;
    } else if (ch === ',' && !inString) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  const tail = current.trim();
  if (tail) {
    parts.push(tail);
  }

  return parts;
}

/**
 * Count occurrences of `ch` in `text` that are not inside double-quoted strings.
 */
function countCharsOutsideStrings(text: string, ch: string): number {
  let count = 0;
  let inString = false;
  for (const c of text) {
    if (c === '"') {
      inString = !inString;
    } else if (c === ch && !inString) {
      count++;
    }
  }
  return count;
}

/**
 * Remove trailing commas before a closing bracket or parenthesis.
 * e.g. ["a", "b",]  →  ["a", "b"]
 *      fileinto("x",)  →  fileinto("x")
 */
export function removeTrailingCommas(text: string): string {
  return text.replace(/,(\s*[)\]])/g, '$1');
}

/**
 * Expand single-line lists/argument groups with 2 or more items to multi-line.
 * Only operates on content that is already on a single line (no embedded newlines).
 *
 * By default, `require [...]` lines are skipped — pass `skipRequire = false` to
 * include them (used when `alwaysExpandRequire` is enabled).
 *
 * e.g. ["item1", "item2", "item3"]
 *   →  [
 *        "item1",
 *        "item2",
 *        "item3"
 *      ]
 */
export function expandListsToMultiline(
  text: string,
  indent: string = '  ',
  skipRequire = true
): string {
  return text.replace(/\[([^[\]\n]+)\]/g, (match, content: string, offset: number) => {
    if (skipRequire) {
      const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
      const lineBefore = text.slice(lineStart, offset);
      if (/^require\s+$/.test(lineBefore)) {
        return match;
      }
    }
    const items = splitOnCommas(content);
    if (items.length >= 2) {
      return `[\n${indent}${items.join(`,\n${indent}`)}\n]`;
    }
    return match;
  });
}

/**
 * Normalise the indentation of already-multi-line `[...]` lists.
 *
 * Each item line is re-indented to `baseIndent + indent`, where `baseIndent`
 * is the leading whitespace of the line that contains the opening `[`.
 * The closing `]` is re-indented to `baseIndent`.
 *
 * Single-line lists and single-item multi-line lists are left unchanged by
 * this pass (they are not matched by the multi-line regex).
 */
export function normalizeMultilineListIndentation(
  text: string,
  indent: string = '  '
): string {
  // Match [...] that spans at least one newline; no nested brackets.
  return text.replace(/\[([^[\]]*\n[^[\]]*)\]/g, (match, content: string, offset: number) => {
    // Determine the leading whitespace of the line that contains `[`.
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const linePrefix = text.slice(lineStart, offset);
    const baseIndent = /^(\s*)/.exec(linePrefix)?.[1] ?? '';
    const itemIndent = baseIndent + indent;

    // Collapse all whitespace around newlines, then parse as comma-separated items.
    const normalized = content.replace(/\s*\n\s*/g, ' ').trim();
    const items = splitOnCommas(normalized);
    if (items.length === 0) {
      return match;
    }

    return `[\n${itemIndent}${items.join(`,\n${itemIndent}`)}\n${baseIndent}]`;
  });
}

/**
 * Re-indent all lines based on the nesting depth of `{` / `}` blocks.
 *
 * Lines that fall inside a multi-line `[...]` list are left verbatim —
 * their indentation is the responsibility of `normalizeMultilineListIndentation`.
 *
 * A line comment (`# ...`) on the same line as a `{` or `}` is stripped before
 * the brace check so that `if condition { # comment` is treated correctly.
 */
export function indentBlocks(text: string, indent: string = '  '): string {
  const lines = text.split('\n');
  let blockLevel = 0;
  let bracketDepth = 0;
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      result.push('');
      continue;
    }

    // Inside a multi-line list — preserve the line verbatim and track depth.
    if (bracketDepth > 0) {
      result.push(line);
      bracketDepth +=
        countCharsOutsideStrings(trimmed, '[') -
        countCharsOutsideStrings(trimmed, ']');
      if (bracketDepth < 0) {
        bracketDepth = 0;
      }
      // Handle `] {` — the list closed on this line and a block was opened.
      // e.g. the closing line of a multi-line test argument followed by the block open.
      if (bracketDepth === 0) {
        const withoutComment = trimmed.replace(/#.*$/, '').trimEnd();
        if (withoutComment.endsWith('{')) {
          blockLevel++;
        }
      }
      continue;
    }

    // Strip trailing line comment before checking brace structure.
    const withoutComment = trimmed.replace(/#.*$/, '').trimEnd();

    // A line starting with `}` closes the current block before being rendered.
    if (trimmed[0] === '}') {
      blockLevel = Math.max(0, blockLevel - 1);
    }

    result.push(indent.repeat(blockLevel) + trimmed);

    // A line ending with `{` opens a new block for subsequent lines.
    if (withoutComment.endsWith('{')) {
      blockLevel++;
    }

    // Track bracket depth so content inside [...] is skipped on next lines.
    bracketDepth +=
      countCharsOutsideStrings(trimmed, '[') -
      countCharsOutsideStrings(trimmed, ']');
    if (bracketDepth < 0) {
      bracketDepth = 0;
    }
  }

  return result.join('\n');
}

/**
 * Collapse runs of more than one consecutive blank line into a single blank line.
 */
export function normalizeBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

export interface FormatOptions {
  /** Indentation string used inside expanded lists and blocks. Default: two spaces. */
  indent?: string;
  /**
   * When false, single-line lists with 2+ items are left as-is and
   * multi-line list indentation is not normalised.
   * Default: true.
   *
   * Controlled by the `sieve.formatter.expandLists` VS Code setting.
   */
  expandLists?: boolean;
  /**
   * When true, the `require` list is expanded to multi-line when it contains
   * 2 or more extensions — the same rule applied to all other lists.
   * By default, `require` is left on a single line regardless of extension count.
   * Has no effect when `expandLists` is false.
   *
   * Controlled by the `sieve.formatter.alwaysExpandRequire` VS Code setting.
   */
  alwaysExpandRequire?: boolean;
  /**
   * When true, re-indent all lines based on `{` / `}` block nesting so that
   * the contents of `if`, `elsif`, and `else` blocks are consistently indented.
   * Default: true.
   *
   * Controlled by the `sieve.formatter.indentBlocks` VS Code setting.
   */
  indentBlocks?: boolean;
  /**
   * When true, collapse runs of more than one consecutive blank line into a
   * single blank line.
   * Default: true.
   *
   * Controlled by the `sieve.formatter.normalizeBlankLines` VS Code setting.
   */
  normalizeBlankLines?: boolean;
}

/**
 * Apply all formatting passes to a Sieve document.
 *
 * Pass order:
 *  1. removeTrailingCommas        — always
 *  2. expandListsToMultiline      — if expandLists
 *  3. indentBlocks                — if indentBlocks
 *  4. normalizeMultilineListIndentation — if expandLists (after indentBlocks so
 *                                         the base indent reflects the final line position)
 *  5. normalizeBlankLines         — if normalizeBlankLines
 */
export function formatDocument(text: string, options: FormatOptions = {}): string {
  const {
    indent = '  ',
    expandLists = true,
    alwaysExpandRequire = false,
    indentBlocks: shouldIndentBlocks = true,
    normalizeBlankLines: shouldNormalizeBlankLines = true,
  } = options;

  let result = removeTrailingCommas(text);

  if (expandLists) {
    result = expandListsToMultiline(result, indent, /* skipRequire= */ !alwaysExpandRequire);
  }

  if (shouldIndentBlocks) {
    result = indentBlocks(result, indent);
  }

  if (expandLists) {
    result = normalizeMultilineListIndentation(result, indent);
  }

  if (shouldNormalizeBlankLines) {
    result = normalizeBlankLines(result);
  }

  return result;
}
