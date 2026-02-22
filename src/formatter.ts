/**
 * Pure formatting functions for Sieve scripts.
 * No VS Code API dependency — keep testable without a VS Code instance.
 */

/**
 * Returns true if the line opens a `text:` heredoc block.
 *
 * In Sieve (RFC 5228 §2.4.2) a multi-line string starts with `text:` at the
 * end of a line (optionally followed by whitespace or a hash comment).
 * e.g.  `vacation :reason text:`  or  `vacation :reason text: # start`
 */
function opensHeredoc(line: string): boolean {
  return /\btext:\s*(?:#.*)?$/.test(line);
}

/**
 * Returns true if the line is the closing dot of a `text:` heredoc block.
 * Per RFC 5228 the terminator must be a lone dot at column 0.
 */
function closesHeredoc(line: string): boolean {
  return line === '.';
}

/**
 * Find the character ranges [start, end] of heredoc bodies in `text`.
 * Each range covers the bytes from the first body line through (and including)
 * the closing `.` line, so that regex callbacks can skip these regions.
 */
function findHeredocRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  let pos = 0;
  let inHeredoc = false;
  let heredocStart = 0;

  for (const line of lines) {
    if (!inHeredoc) {
      if (opensHeredoc(line)) {
        inHeredoc = true;
        // Body starts after the newline that follows the `text:` line.
        heredocStart = pos + line.length + 1;
      }
    } else {
      if (closesHeredoc(line)) {
        inHeredoc = false;
        ranges.push([heredocStart, pos + line.length]);
      }
    }
    pos += line.length + 1; // +1 for the '\n' separator
  }

  return ranges;
}

/**
 * Returns true if `offset` falls within any of the given heredoc ranges.
 */
function isInHeredocRange(offset: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => offset >= start && offset <= end);
}

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
 * Remove `/* ... */` block-comment spans from a single line.
 *
 * Returns:
 *   effective        — the line content with each comment span replaced by a
 *                      single space (so surrounding tokens remain parseable).
 *   opensBlockComment — true when `/*` was found on this line without a
 *                       matching `*‌/`, meaning the comment continues onto
 *                       subsequent lines.
 *
 * This function does NOT handle the case where the line is already inside a
 * block comment that started on a previous line — the caller is responsible for
 * tracking that state (see `indentBlocks`).
 */
function stripLineBlockComments(line: string): { effective: string; opensBlockComment: boolean } {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inString) {
      result += ch;
      if (ch === '"') {
        inString = false;
      }
      i++;
    } else if (ch === '"') {
      inString = true;
      result += ch;
      i++;
    } else if (ch === '/' && i + 1 < line.length && line[i + 1] === '*') {
      const closeIdx = line.indexOf('*/', i + 2);
      if (closeIdx === -1) {
        // Block comment extends past end of this line.
        return { effective: result, opensBlockComment: true };
      }
      // Block comment closes on this line — replace the whole span with a space.
      result += ' ';
      i = closeIdx + 2;
    } else {
      result += ch;
      i++;
    }
  }

  return { effective: result, opensBlockComment: false };
}

/**
 * Remove trailing commas before a closing bracket or parenthesis.
 * e.g. ["a", "b",]  →  ["a", "b"]
 *      fileinto("x",)  →  fileinto("x")
 *
 * Commas inside double-quoted strings are never removed.
 * Lines inside a `text:` heredoc body are preserved verbatim so that
 * prose containing patterns like `,]` is not corrupted.
 */
export function removeTrailingCommas(text: string): string {
  // Split into consecutive heredoc / non-heredoc segments and apply the
  // character-level pass only to non-heredoc content.  Segments are rejoined
  // with '\n' which reconstructs the original line boundaries exactly.
  const lines = text.split('\n');
  const segments: { lines: string[]; isHeredoc: boolean }[] = [];
  let currentLines: string[] = [];
  let inHeredoc = false;

  for (const line of lines) {
    if (!inHeredoc) {
      currentLines.push(line);
      if (opensHeredoc(line)) {
        inHeredoc = true;
        segments.push({ lines: currentLines, isHeredoc: false });
        currentLines = [];
      }
    } else {
      currentLines.push(line);
      if (closesHeredoc(line)) {
        inHeredoc = false;
        segments.push({ lines: currentLines, isHeredoc: true });
        currentLines = [];
      }
    }
  }
  if (currentLines.length > 0) {
    segments.push({ lines: currentLines, isHeredoc: false });
  }

  return segments
    .map(({ lines: segLines, isHeredoc }) =>
      isHeredoc ? segLines.join('\n') : removeTrailingCommasRaw(segLines.join('\n'))
    )
    .join('\n');
}

/**
 * Core character-by-character trailing-comma removal. Operates on a single
 * non-heredoc segment of text (may still contain newlines).
 */
function removeTrailingCommasRaw(text: string): string {
  let result = '';
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      inString = !inString;
      result += ch;
    } else if (ch === ',' && !inString) {
      // Peek ahead past optional whitespace to see whether ) or ] follows.
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) {
        j++;
      }
      if (j < text.length && (text[j] === ')' || text[j] === ']')) {
        // Trailing comma — drop it and keep only the whitespace between , and )/]
        result += text.slice(i + 1, j);
        i = j - 1; // the for-loop will increment to j
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }

  return result;
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
  const lines = text.split('\n');
  let inHeredoc = false;
  const result: string[] = [];

  for (const line of lines) {
    if (inHeredoc) {
      result.push(line);
      if (closesHeredoc(line)) inHeredoc = false;
      continue;
    }

    // Expand single-line [...] lists on this line, then check whether it
    // opens a heredoc (so subsequent lines are preserved verbatim).
    const processed = line.replace(/\[([^[\]\n]+)\]/g, (match, content: string, offset: number) => {
      if (skipRequire) {
        const lineBefore = line.slice(0, offset);
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

    result.push(processed);

    if (opensHeredoc(line)) {
      inHeredoc = true;
    }
  }

  return result.join('\n');
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
  const heredocRanges = findHeredocRanges(text);

  // Match [...] that spans at least one newline; no nested brackets.
  return text.replace(/\[([^[\]]*\n[^[\]]*)\]/g, (match, content: string, offset: number) => {
    // Skip any [...] whose opening bracket falls inside a text: heredoc body.
    if (isInHeredocRange(offset, heredocRanges)) {
      return match;
    }

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
 * Lines that are inside a multi-line `/* ... *‌/` block comment are also left
 * verbatim so that comment formatting chosen by the author is preserved.
 *
 * Inline `/* ... *‌/` comments and `# ...` line comments on the same line as
 * a `{` or `}` are stripped before the brace check.
 */
export function indentBlocks(text: string, indent: string = '  '): string {
  const lines = text.split('\n');
  let blockLevel = 0;
  let bracketDepth = 0;
  let inBlockComment = false;
  let inHeredoc = false;
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Inside a text: heredoc — preserve every line verbatim (including blank
    // lines and the closing dot) so the vacation body is not corrupted.
    if (inHeredoc) {
      result.push(line);
      if (closesHeredoc(line)) inHeredoc = false;
      continue;
    }

    if (trimmed === '') {
      result.push('');
      continue;
    }

    // Inside a multi-line list — preserve verbatim and track bracket depth.
    if (bracketDepth > 0) {
      result.push(line);
      bracketDepth +=
        countCharsOutsideStrings(trimmed, '[') -
        countCharsOutsideStrings(trimmed, ']');
      if (bracketDepth < 0) {
        bracketDepth = 0;
      }
      // Handle `] {` — list closed and block opened on the same line.
      if (bracketDepth === 0) {
        const { effective } = stripLineBlockComments(trimmed);
        const withoutComment = effective.replace(/#.*$/, '').trimEnd();
        if (withoutComment.endsWith('{')) {
          blockLevel++;
        }
      }
      continue;
    }

    // Inside a multi-line block comment — preserve verbatim.
    if (inBlockComment) {
      result.push(line);
      const closeIdx = trimmed.indexOf('*/');
      if (closeIdx !== -1) {
        inBlockComment = false;
        // Check whether there is significant content after */ on this line.
        const afterClose = trimmed.slice(closeIdx + 2);
        const { effective, opensBlockComment } = stripLineBlockComments(afterClose);
        inBlockComment = opensBlockComment;
        const withoutLineComment = effective.replace(/#.*$/, '').trimEnd();
        if (withoutLineComment.endsWith('{')) {
          blockLevel++;
        }
        bracketDepth +=
          countCharsOutsideStrings(effective, '[') -
          countCharsOutsideStrings(effective, ']');
        if (bracketDepth < 0) {
          bracketDepth = 0;
        }
      }
      continue;
    }

    // Normal line — strip block comments for brace and bracket analysis.
    const { effective, opensBlockComment } = stripLineBlockComments(trimmed);
    inBlockComment = opensBlockComment;

    const withoutLineComment = effective.replace(/#.*$/, '').trimEnd();

    // A line starting with `}` closes the current block before being rendered.
    if (trimmed[0] === '}') {
      blockLevel = Math.max(0, blockLevel - 1);
    }

    result.push(indent.repeat(blockLevel) + trimmed);

    // A line ending with `{` opens a new block for subsequent lines.
    if (withoutLineComment.endsWith('{')) {
      blockLevel++;
    }

    // Track bracket depth so content inside [...] is skipped on subsequent lines.
    bracketDepth +=
      countCharsOutsideStrings(effective, '[') -
      countCharsOutsideStrings(effective, ']');
    if (bracketDepth < 0) {
      bracketDepth = 0;
    }

    // If this line opens a text: heredoc, subsequent lines are body content
    // that must be preserved verbatim.
    if (opensHeredoc(trimmed)) {
      inHeredoc = true;
    }
  }

  return result.join('\n');
}

/**
 * Collapse runs of more than one consecutive blank line into a single blank line.
 *
 * Lines inside a `text:` heredoc body are preserved verbatim so that paragraph
 * breaks in vacation messages are not silently discarded.
 */
export function normalizeBlankLines(text: string): string {
  const lines = text.split('\n');
  let inHeredoc = false;
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (inHeredoc) {
      result.push(line);
      if (closesHeredoc(line)) inHeredoc = false;
      continue;
    }

    if (line === '') {
      consecutiveBlanks++;
      // Allow at most one blank line outside heredoc sections.
      if (consecutiveBlanks <= 1) {
        result.push(line);
      }
    } else {
      consecutiveBlanks = 0;
      if (opensHeredoc(line)) {
        inHeredoc = true;
      }
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * When `elsif` or `else` appears on a line by itself (possibly with leading
 * whitespace) immediately after a line that is only `}`, join them onto the
 * same line as the `}` so that Sieve control flow reads as a single construct.
 *
 * e.g.
 *   }            →   } elsif condition {
 *   elsif condition {
 *
 * Blank lines between `}` and `elsif`/`else` are consumed by the join.
 * Already-joined `} elsif` / `} else` lines are left unchanged (idempotent).
 */
export function joinElsifElse(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inHeredoc = false;

  for (let i = 0; i < lines.length; i++) {
    if (inHeredoc) {
      result.push(lines[i]);
      if (closesHeredoc(lines[i])) inHeredoc = false;
      continue;
    }

    if (opensHeredoc(lines[i])) {
      inHeredoc = true;
      result.push(lines[i]);
      continue;
    }

    const trimmed = lines[i].trim();

    // Only consider lines that are exactly `}` (no other content).
    if (trimmed === '}') {
      // Scan forward past blank lines to find the next non-empty line.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') {
        j++;
      }
      if (j < lines.length) {
        const nextTrimmed = lines[j].trim();
        if (/^(elsif|else)\b/.test(nextTrimmed)) {
          // Merge: append the keyword line to the `}` line, consuming any
          // blank lines that appeared between them.
          result.push(lines[i].replace(/\}\s*$/, '} ') + nextTrimmed);
          i = j; // skip lines up to and including the elsif/else line
          continue;
        }
      }
    }

    result.push(lines[i]);
  }

  return result.join('\n');
}

/**
 * Sort the extensions inside a `require [...]` list alphabetically
 * (case-insensitive). Works on both single-line and multi-line forms;
 * multi-line requires are collapsed to a single line so that
 * `expandListsToMultiline` (if enabled) can re-expand them consistently.
 *
 * A bare `require "string"` (no brackets) is left unchanged.
 * A single-extension list is left unchanged.
 *
 * Lines inside a `text:` heredoc body are skipped so that prose which
 * happens to start a line with `require [...]` is never re-ordered.
 */
export function sortRequireExtensions(text: string): string {
  // Apply only to non-heredoc segments (same principle as all other passes).
  const lines = text.split('\n');
  const segments: { lines: string[]; isHeredoc: boolean }[] = [];
  let currentLines: string[] = [];
  let inHeredoc = false;

  for (const line of lines) {
    if (!inHeredoc) {
      currentLines.push(line);
      if (opensHeredoc(line)) {
        inHeredoc = true;
        segments.push({ lines: currentLines, isHeredoc: false });
        currentLines = [];
      }
    } else {
      currentLines.push(line);
      if (closesHeredoc(line)) {
        inHeredoc = false;
        segments.push({ lines: currentLines, isHeredoc: true });
        currentLines = [];
      }
    }
  }
  if (currentLines.length > 0) {
    segments.push({ lines: currentLines, isHeredoc: false });
  }

  return segments
    .map(({ lines: segLines, isHeredoc }) =>
      isHeredoc ? segLines.join('\n') : sortRequireExtensionsRaw(segLines.join('\n'))
    )
    .join('\n');
}

function sortRequireExtensionsRaw(text: string): string {
  // Match `require [...]` where the list may span multiple lines.
  // The 'm' flag makes ^ anchor to any line start.
  return text.replace(/^(require\s+\[)([\s\S]*?)(\])/m, (match, open: string, content: string, close: string) => {
    // Collapse newlines / surrounding whitespace to parse items uniformly.
    const normalized = content.replace(/\s*\n\s*/g, ' ').trim();
    const items = splitOnCommas(normalized);
    if (items.length <= 1) {
      return match;
    }
    const sorted = [...items].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    // Rebuild as single-line so expandListsToMultiline can re-expand if enabled.
    return `${open}${sorted.join(', ')}${close}`;
  });
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
   * When true, join a lone `}` line with a following `elsif` or `else` line
   * so that Sieve control flow reads as `} elsif ...` / `} else {` on a
   * single line.
   * Default: true.
   *
   * Controlled by the `sieve.formatter.joinElsifElse` VS Code setting.
   */
  joinElsifElse?: boolean;
  /**
   * When true, collapse runs of more than one consecutive blank line into a
   * single blank line.
   * Default: true.
   *
   * Controlled by the `sieve.formatter.normalizeBlankLines` VS Code setting.
   */
  normalizeBlankLines?: boolean;
  /**
   * When true, sort the extensions inside `require [...]` alphabetically
   * (case-insensitive). Has no effect on a bare `require "string"` or a
   * single-extension list.
   * Default: false.
   *
   * Controlled by the `sieve.formatter.sortRequire` VS Code setting.
   */
  sortRequire?: boolean;
}

/**
 * Apply all formatting passes to a Sieve document.
 *
 * Pass order:
 *  1. removeTrailingCommas              — always
 *  2. sortRequireExtensions             — if sortRequire
 *  3. expandListsToMultiline            — if expandLists
 *  4. joinElsifElse                     — if joinElsifElse
 *  5. indentBlocks                      — if indentBlocks
 *  6. normalizeMultilineListIndentation — if expandLists (after indentBlocks so
 *                                         the base indent reflects the final position)
 *  7. normalizeBlankLines               — if normalizeBlankLines
 */
export function formatDocument(text: string, options: FormatOptions = {}): string {
  const {
    indent = '  ',
    expandLists = true,
    alwaysExpandRequire = false,
    indentBlocks: shouldIndentBlocks = true,
    joinElsifElse: shouldJoinElsifElse = true,
    normalizeBlankLines: shouldNormalizeBlankLines = true,
    sortRequire: shouldSortRequire = false,
  } = options;

  let result = removeTrailingCommas(text);

  if (shouldSortRequire) {
    result = sortRequireExtensions(result);
  }

  if (expandLists) {
    result = expandListsToMultiline(result, indent, /* skipRequire= */ !alwaysExpandRequire);
  }

  if (shouldJoinElsifElse) {
    result = joinElsifElse(result);
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
