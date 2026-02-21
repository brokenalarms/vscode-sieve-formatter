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

export interface FormatOptions {
  /** Indentation string used inside expanded lists. Default: two spaces. */
  indent?: string;
  /**
   * When false, single-line lists with 2+ items are left as-is.
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
}

/**
 * Apply all formatting passes to a Sieve document.
 */
export function formatDocument(text: string, options: FormatOptions = {}): string {
  const { indent = '  ', expandLists = true, alwaysExpandRequire = false } = options;
  let result = removeTrailingCommas(text);
  if (expandLists) {
    result = expandListsToMultiline(result, indent, /* skipRequire= */ !alwaysExpandRequire);
  }
  return result;
}
