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
 * Apply all formatting passes to a Sieve document.
 * @param text   - raw document content
 * @param indent - indentation string to use inside expanded lists
 */
export function formatDocument(text: string, indent: string = '  '): string {
  let result = removeTrailingCommas(text);
  result = expandListsToMultiline(result, indent);
  return result;
}
