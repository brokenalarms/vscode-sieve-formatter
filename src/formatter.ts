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
 * e.g. ["item1", "item2", "item3"]
 *   →  [
 *        "item1",
 *        "item2",
 *        "item3"
 *      ]
 */
export function expandListsToMultiline(text: string, indent: string = '  '): string {
  // Match [...] that doesn't contain newlines or nested brackets
  return text.replace(/\[([^[\]\n]+)\]/g, (match, content: string) => {
    const items = splitOnCommas(content);
    if (items.length >= 2) {
      return `[\n${indent}${items.join(`,\n${indent}`)}\n]`;
    }
    return match;
  });
}

/**
 * Expand the `require` statement to multi-line, even when it lists only one
 * extension. Useful because `require` is frequently edited as rules evolve,
 * so keeping it multi-line from the start avoids noisy diffs.
 *
 * Handles both bare-string and single-item list forms:
 *   require "fileinto";      →  require [\n  "fileinto"\n];
 *   require ["fileinto"];    →  require [\n  "fileinto"\n];
 *
 * Multi-item require lists are already handled by expandListsToMultiline.
 * Already-expanded require blocks are left untouched (no embedded newlines matched).
 */
export function expandRequireToMultiline(text: string, indent: string = '  '): string {
  // require "ext";  →  require [\n  "ext"\n];
  text = text.replace(
    /^require\s+"([^"]+)"\s*;/mg,
    (_match, ext: string) => `require [\n${indent}"${ext}"\n];`
  );
  // require ["ext"];  →  require [\n  "ext"\n];
  // (single-item lists are skipped by expandListsToMultiline)
  text = text.replace(
    /^require\s+\["([^"]+)"\]\s*;/mg,
    (_match, ext: string) => `require [\n${indent}"${ext}"\n];`
  );
  return text;
}

export interface FormatOptions {
  /** Indentation string used inside expanded lists. Default: two spaces. */
  indent?: string;
  /**
   * When true, the `require` statement is always expanded to multi-line even
   * with only one extension listed. Default: false.
   *
   * Controlled by the `sieve.formatter.alwaysExpandRequire` VS Code setting.
   */
  alwaysExpandRequire?: boolean;
}

/**
 * Apply all formatting passes to a Sieve document.
 */
export function formatDocument(text: string, options: FormatOptions = {}): string {
  const { indent = '  ', alwaysExpandRequire = false } = options;
  let result = removeTrailingCommas(text);
  result = expandListsToMultiline(result, indent);
  if (alwaysExpandRequire) {
    result = expandRequireToMultiline(result, indent);
  }
  return result;
}
