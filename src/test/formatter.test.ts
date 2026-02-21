import * as assert from 'assert';
import {
  removeTrailingCommas,
  expandListsToMultiline,
  normalizeMultilineListIndentation,
  indentBlocks,
  normalizeBlankLines,
  formatDocument,
} from '../formatter';

describe('removeTrailingCommas', () => {
  it('removes trailing comma before ]', () => {
    assert.strictEqual(
      removeTrailingCommas('["a", "b",]'),
      '["a", "b"]'
    );
  });

  it('removes trailing comma before ) ', () => {
    assert.strictEqual(
      removeTrailingCommas('fileinto("folder",)'),
      'fileinto("folder")'
    );
  });

  it('removes trailing comma with whitespace before ]', () => {
    assert.strictEqual(
      removeTrailingCommas('["a", "b",  ]'),
      '["a", "b"  ]'
    );
  });

  it('removes trailing comma with newline before ]', () => {
    assert.strictEqual(
      removeTrailingCommas('["a",\n  "b",\n  ]'),
      '["a",\n  "b"\n  ]'
    );
  });

  it('does not modify lists without trailing commas', () => {
    const input = '["a", "b"]';
    assert.strictEqual(removeTrailingCommas(input), input);
  });

  it('handles multiple trailing commas in one document', () => {
    const input = '["a",]\nif address :is "From" ["x@example.com",] { }';
    const expected = '["a"]\nif address :is "From" ["x@example.com"] { }';
    assert.strictEqual(removeTrailingCommas(input), expected);
  });

  it('does not touch commas that are not trailing', () => {
    const input = '["a", "b", "c"]';
    assert.strictEqual(removeTrailingCommas(input), input);
  });
});

describe('expandListsToMultiline', () => {
  it('expands a 2-item list to multi-line', () => {
    const input = '["item1", "item2"]';
    const expected = '[\n  "item1",\n  "item2"\n]';
    assert.strictEqual(expandListsToMultiline(input), expected);
  });

  it('expands a 3-item list to multi-line', () => {
    const input = '["a", "b", "c"]';
    const expected = '[\n  "a",\n  "b",\n  "c"\n]';
    assert.strictEqual(expandListsToMultiline(input), expected);
  });

  it('does not expand a single-item list', () => {
    const input = '["only"]';
    assert.strictEqual(expandListsToMultiline(input), input);
  });

  it('respects the provided indent string', () => {
    const input = '["a", "b"]';
    const expected = '[\n\t"a",\n\t"b"\n]';
    assert.strictEqual(expandListsToMultiline(input, '\t'), expected);
  });

  it('does not re-expand already multi-line lists', () => {
    const input = '[\n  "a",\n  "b"\n]';
    assert.strictEqual(expandListsToMultiline(input), input);
  });

  it('does not expand items that contain commas inside strings', () => {
    const input = '["hello, world", "foo"]';
    assert.strictEqual(expandListsToMultiline(input), '[\n  "hello, world",\n  "foo"\n]');
  });

  it('skips require lists by default (single-item)', () => {
    const input = 'require ["fileinto"];';
    assert.strictEqual(expandListsToMultiline(input), input);
  });

  it('skips require lists by default (multi-item)', () => {
    const input = 'require ["fileinto", "imap4flags"];';
    assert.strictEqual(expandListsToMultiline(input), input);
  });

  it('expands require lists when skipRequire is false (single-item stays collapsed)', () => {
    assert.strictEqual(
      expandListsToMultiline('require ["fileinto"];', '  ', false),
      'require ["fileinto"];'
    );
  });

  it('expands require lists when skipRequire is false (multi-item expands)', () => {
    assert.strictEqual(
      expandListsToMultiline('require ["fileinto", "imap4flags"];', '  ', false),
      'require [\n  "fileinto",\n  "imap4flags"\n];'
    );
  });
});

describe('normalizeMultilineListIndentation', () => {
  it('normalizes over-indented items to baseIndent + indent', () => {
    const input = 'fileinto [\n      "INBOX",\n      "Spam"\n  ]';
    const expected = 'fileinto [\n  "INBOX",\n  "Spam"\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), expected);
  });

  it('normalizes inconsistently indented items', () => {
    const input = 'fileinto [\n    "INBOX",\n  "Spam"\n]';
    const expected = 'fileinto [\n  "INBOX",\n  "Spam"\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), expected);
  });

  it('is idempotent on already-correct indentation', () => {
    const input = 'fileinto [\n  "INBOX",\n  "Spam"\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), input);
  });

  it('uses the containing line indent as base', () => {
    // The [ is on a line with 2-space base indent → items get 4 spaces
    const input = '  fileinto [\n"INBOX",\n"Spam"\n]';
    const expected = '  fileinto [\n    "INBOX",\n    "Spam"\n  ]';
    assert.strictEqual(normalizeMultilineListIndentation(input), expected);
  });

  it('does not affect single-line lists', () => {
    const input = 'fileinto ["INBOX", "Spam"]';
    assert.strictEqual(normalizeMultilineListIndentation(input), input);
  });

  it('does not affect single-item multi-line list', () => {
    // A single item that somehow ended up multi-line stays (no commas to split on)
    const input = 'fileinto [\n  "INBOX"\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), input);
  });

  it('respects a custom indent string', () => {
    const input = 'fileinto [\n"INBOX",\n"Spam"\n]';
    const expected = 'fileinto [\n\t"INBOX",\n\t"Spam"\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input, '\t'), expected);
  });
});

describe('indentBlocks', () => {
  it('indents the body of an if block', () => {
    const input = 'if condition {\nfileinto "Inbox";\n}';
    const expected = 'if condition {\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('is idempotent on already-indented blocks', () => {
    const input = 'if condition {\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), input);
  });

  it('handles } elsif { correctly', () => {
    const input = [
      'if condition1 {',
      'fileinto "A";',
      '} elsif condition2 {',
      'fileinto "B";',
      '}',
    ].join('\n');
    const expected = [
      'if condition1 {',
      '  fileinto "A";',
      '} elsif condition2 {',
      '  fileinto "B";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('handles } else { correctly', () => {
    const input = [
      'if condition {',
      'fileinto "A";',
      '} else {',
      'keep;',
      '}',
    ].join('\n');
    const expected = [
      'if condition {',
      '  fileinto "A";',
      '} else {',
      '  keep;',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('handles nested blocks', () => {
    const input = [
      'if outer {',
      'if inner {',
      'stop;',
      '}',
      'keep;',
      '}',
    ].join('\n');
    const expected = [
      'if outer {',
      '  if inner {',
      '    stop;',
      '  }',
      '  keep;',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('preserves lines inside multi-line [...] verbatim', () => {
    // Items inside [...] should not be re-indented by this pass.
    const input = [
      'if condition {',
      'fileinto [',
      '"A",',
      '"B"',
      '];',
      '}',
    ].join('\n');
    const expected = [
      'if condition {',
      '  fileinto [',
      '"A",',   // preserved verbatim
      '"B"',    // preserved verbatim
      '];',     // preserved verbatim
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('preserves empty lines', () => {
    const input = 'if condition {\n\nfileinto "Inbox";\n}';
    const expected = 'if condition {\n\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('handles a # comment after { on the same line', () => {
    const input = 'if condition { # open\nfileinto "Inbox";\n}';
    const expected = 'if condition { # open\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('does not change top-level statements with no blocks', () => {
    const input = 'require ["fileinto"];\nfileinto "Inbox";';
    assert.strictEqual(indentBlocks(input), input);
  });
});

describe('normalizeBlankLines', () => {
  it('collapses 3 consecutive newlines (2 blank lines) to 2 (1 blank line)', () => {
    assert.strictEqual(normalizeBlankLines('a\n\n\nb'), 'a\n\nb');
  });

  it('collapses 4+ newlines down to 2', () => {
    assert.strictEqual(normalizeBlankLines('a\n\n\n\nb'), 'a\n\nb');
  });

  it('does not change a single blank line', () => {
    const input = 'a\n\nb';
    assert.strictEqual(normalizeBlankLines(input), input);
  });

  it('is idempotent', () => {
    const once = normalizeBlankLines('a\n\n\n\nb');
    assert.strictEqual(normalizeBlankLines(once), once);
  });
});

describe('formatDocument — expandLists: false', () => {
  it('still removes trailing commas', () => {
    assert.strictEqual(
      formatDocument('["a", "b",]', { expandLists: false }),
      '["a", "b"]'
    );
  });

  it('leaves multi-item lists on a single line', () => {
    const input = 'if address :is "From" ["alice@example.com", "bob@example.com"] {';
    assert.strictEqual(formatDocument(input, { expandLists: false }), input);
  });

  it('alwaysExpandRequire has no effect when expandLists is false', () => {
    const input = 'require ["fileinto", "imap4flags"];';
    assert.strictEqual(
      formatDocument(input, { expandLists: false, alwaysExpandRequire: true }),
      input
    );
  });
});

describe('formatDocument — indentBlocks: false', () => {
  it('leaves block indentation untouched', () => {
    const input = 'if condition {\nfileinto "Inbox";\n}';
    assert.strictEqual(formatDocument(input, { indentBlocks: false }), input);
  });
});

describe('formatDocument — normalizeBlankLines: false', () => {
  it('leaves multiple blank lines untouched', () => {
    const input = 'require ["fileinto"];\n\n\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input, { normalizeBlankLines: false }), input);
  });
});

describe('formatDocument', () => {
  it('removes trailing commas and expands multi-item lists', () => {
    const input = 'fileinto ["Inbox","Spam",];';
    const expected = 'fileinto [\n  "Inbox",\n  "Spam"\n];';
    assert.strictEqual(formatDocument(input), expected);
  });

  it('returns the original text unchanged when already formatted', () => {
    const input = 'fileinto "Inbox";';
    assert.strictEqual(formatDocument(input), input);
  });

  it('does not expand require by default (single-item, bare string)', () => {
    const input = 'require "fileinto";\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input), input);
  });

  it('does not expand require by default (single-item, list form)', () => {
    const input = 'require ["fileinto"];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input), input);
  });

  it('does not expand require by default (multi-item)', () => {
    const input = 'require ["fileinto", "imap4flags"];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input), input);
  });

  it('expands multi-item require when alwaysExpandRequire is true', () => {
    const input = 'require ["fileinto", "imap4flags"];\nfileinto "Inbox";';
    const expected = 'require [\n  "fileinto",\n  "imap4flags"\n];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), expected);
  });

  it('does not expand single-item require even when alwaysExpandRequire is true', () => {
    const input = 'require ["fileinto"];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), input);
  });

  it('indents the body of an if/elsif/else block', () => {
    const input = [
      'if address :is "From" "spam@evil.com" {',
      'fileinto "Spam";',
      'stop;',
      '} elsif address :is "From" "boss@company.com" {',
      'fileinto "Important";',
      '} else {',
      'keep;',
      '}',
    ].join('\n');

    const expected = [
      'if address :is "From" "spam@evil.com" {',
      '  fileinto "Spam";',
      '  stop;',
      '} elsif address :is "From" "boss@company.com" {',
      '  fileinto "Important";',
      '} else {',
      '  keep;',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input), expected);
  });

  it('normalizes multi-line list indentation after block re-indent', () => {
    // After indentBlocks, `fileinto [` is at 2-space indent.
    // normalizeMultilineListIndentation then fixes items to 4-space.
    const input = [
      'if condition {',
      'fileinto ["INBOX", "Spam"];',
      '}',
    ].join('\n');

    const expected = [
      'if condition {',
      '  fileinto [',
      '    "INBOX",',
      '    "Spam"',
      '  ];',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input), expected);
  });

  it('is idempotent on a fully formatted document', () => {
    const formatted = [
      'require ["fileinto", "imap4flags"];',
      '',
      'if address :is "From" [',
      '  "alice@example.com",',
      '  "bob@example.com"',
      '] {',
      '  fileinto "Team";',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(formatted), formatted);
  });

  it('collapses multiple blank lines', () => {
    const input = 'require ["fileinto"];\n\n\n\nfileinto "Inbox";';
    const expected = 'require ["fileinto"];\n\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input), expected);
  });

  it('handles a realistic Sieve rule (require not expanded by default)', () => {
    const input = [
      'require ["fileinto", "imap4flags",];',
      '',
      'if address :is "From" ["alice@example.com", "bob@example.com",] {',
      'fileinto "Team";',
      '}',
    ].join('\n');

    const expected = [
      'require ["fileinto", "imap4flags"];',
      '',
      'if address :is "From" [',
      '  "alice@example.com",',
      '  "bob@example.com"',
      '] {',
      '  fileinto "Team";',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input), expected);
  });

  it('handles a realistic Sieve rule with alwaysExpandRequire', () => {
    const input = [
      'require ["fileinto", "imap4flags",];',
      '',
      'if address :is "From" ["alice@example.com", "bob@example.com",] {',
      'fileinto "Team";',
      '}',
    ].join('\n');

    const expected = [
      'require [',
      '  "fileinto",',
      '  "imap4flags"',
      '];',
      '',
      'if address :is "From" [',
      '  "alice@example.com",',
      '  "bob@example.com"',
      '] {',
      '  fileinto "Team";',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), expected);
  });
});
