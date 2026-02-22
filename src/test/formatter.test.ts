import * as assert from 'assert';
import {
  removeTrailingCommas,
  expandListsToMultiline,
  normalizeMultilineListIndentation,
  indentBlocks,
  normalizeBlankLines,
  joinElsifElse,
  sortRequireExtensions,
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

  it('does not remove a comma that is inside a string value', () => {
    // The ,] sequence is inside the quoted string — must not be touched.
    const input = 'if header :matches "Subject" ["pattern,]"] {';
    assert.strictEqual(removeTrailingCommas(input), input);
  });
});

describe('removeTrailingCommas — text: heredoc handling', () => {
  it('does not remove ,] inside a heredoc body', () => {
    const input = [
      'vacation :reason text:',
      'Please reply to the list [members, owners,].',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(removeTrailingCommas(input), input);
  });

  it('does not remove ,) inside a heredoc body', () => {
    const input = [
      'vacation :reason text:',
      'Call foo(bar,) for details.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(removeTrailingCommas(input), input);
  });

  it('still removes trailing commas in code outside the heredoc', () => {
    const input = [
      'require ["vacation",];',
      'vacation :reason text:',
      'body',
      '.',
      ';',
    ].join('\n');

    const expected = [
      'require ["vacation"];',
      'vacation :reason text:',
      'body',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(removeTrailingCommas(input), expected);
  });

  it('is idempotent on a heredoc with comma-like prose', () => {
    const input = [
      'vacation :reason text:',
      'Items [a, b,] are listed above.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(removeTrailingCommas(removeTrailingCommas(input)), input);
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

  it('preserves inline # comments on item lines', () => {
    const input = 'fileinto [\n"INBOX", # main inbox\n"Spam" # junk\n]';
    const expected = 'fileinto [\n  "INBOX", # main inbox\n  "Spam" # junk\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), expected);
  });

  it('is idempotent on items with inline comments', () => {
    const input = 'fileinto [\n  "INBOX", # main inbox\n  "Spam" # junk\n]';
    assert.strictEqual(normalizeMultilineListIndentation(input), input);
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

  it('preserves lines inside multi-line allof(...) verbatim', () => {
    const input = [
      'if allof(',
      '  header :is "X-Spam" "yes",',
      '  not header :is "From" "trusted@example.com"',
      ') {',
      'fileinto "Spam";',
      '}',
    ].join('\n');
    const expected = [
      'if allof(',
      '  header :is "X-Spam" "yes",',
      '  not header :is "From" "trusted@example.com"',
      ') {',
      '  fileinto "Spam";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('preserves indentation of [...] lists nested inside allof(...)', () => {
    const input = [
      'if allof(',
      '  header :regex "Subject" [',
      '    "spam",',
      '    "offer"',
      '  ],',
      '  not header :is "From" "trusted@example.com"',
      ') {',
      'fileinto "Spam";',
      '}',
    ].join('\n');
    const expected = [
      'if allof(',
      '  header :regex "Subject" [',
      '    "spam",',
      '    "offer"',
      '  ],',
      '  not header :is "From" "trusted@example.com"',
      ') {',
      '  fileinto "Spam";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('is idempotent on allof(...) with nested lists', () => {
    const input = [
      'if allof(',
      '  header :regex "Subject" [',
      '    "spam",',
      '    "offer"',
      '  ],',
      '  not header :is "From" "trusted@example.com"',
      ') {',
      '  fileinto "Spam";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), input);
  });

  it('re-indents ]) { to match the if statement when over-indented', () => {
    // ]) { at 2-space indent should move to 0 (same level as the if),
    // and block body at 4-space indent should normalise to 2.
    const input = [
      'if allof(',
      '  header :regex "Subject" [',
      '    "spam"',
      '  ],',
      '  not header :is "From" "trusted@example.com"',
      '  ]) {',
      '    fileinto "Spam";',
      '}',
    ].join('\n');
    const expected = [
      'if allof(',
      '  header :regex "Subject" [',
      '    "spam"',
      '  ],',
      '  not header :is "From" "trusted@example.com"',
      ']) {',
      '  fileinto "Spam";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), expected);
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

  it('joins lone } + elsif when on separate lines', () => {
    const input = [
      'if condition {',
      'fileinto "A";',
      '}',
      'elsif condition2 {',
      'fileinto "B";',
      '}',
    ].join('\n');

    const expected = [
      'if condition {',
      '  fileinto "A";',
      '} elsif condition2 {',
      '  fileinto "B";',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input), expected);
  });

  it('is idempotent with already-joined } elsif / } else', () => {
    const formatted = [
      'if condition {',
      '  fileinto "A";',
      '} elsif condition2 {',
      '  fileinto "B";',
      '} else {',
      '  keep;',
      '}',
    ].join('\n');
    assert.strictEqual(formatDocument(formatted), formatted);
  });
});

describe('indentBlocks — block comment handling', () => {
  it('re-indents a single-line /* comment */ like normal content', () => {
    const input = 'if condition {\n/* inline */\nfileinto "Inbox";\n}';
    const expected = 'if condition {\n  /* inline */\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('preserves interior lines of a multi-line block comment verbatim', () => {
    const input = [
      '/*',
      ' * top-level comment',
      ' */',
      'if condition {',
      'fileinto "Inbox";',
      '}',
    ].join('\n');

    const expected = [
      '/*',
      ' * top-level comment',  // preserved verbatim
      ' */',
      'if condition {',
      '  fileinto "Inbox";',
      '}',
    ].join('\n');

    assert.strictEqual(indentBlocks(input), expected);
  });

  it('is idempotent on already-indented code with block comments', () => {
    const input = [
      '/*',
      ' * comment',
      ' */',
      'if condition {',
      '  fileinto "Inbox";',
      '}',
    ].join('\n');
    assert.strictEqual(indentBlocks(input), input);
  });

  it('detects { after /* comment */ on the same line', () => {
    // The block comment wraps the condition; the { is still the block opener.
    const input = 'if /* comment */ condition {\nfileinto "Inbox";\n}';
    const expected = 'if /* comment */ condition {\n  fileinto "Inbox";\n}';
    assert.strictEqual(indentBlocks(input), expected);
  });

  it('does not re-indent code inside a block comment that opens mid-line', () => {
    const input = [
      'if condition { /*',
      '  still inside the comment',
      '*/ fileinto "Inbox";',
      '}',
    ].join('\n');

    // The opening line is re-indented (level 0), interior preserved verbatim,
    // and the closing line (* / ...) is also preserved verbatim.
    const expected = [
      'if condition { /*',
      '  still inside the comment',
      '*/ fileinto "Inbox";',
      '}',
    ].join('\n');

    assert.strictEqual(indentBlocks(input), expected);
  });
});

describe('joinElsifElse', () => {
  it('joins } + elsif onto one line', () => {
    const input = 'if c {\naction;\n}\nelsif c2 {\naction2;\n}';
    const expected = 'if c {\naction;\n} elsif c2 {\naction2;\n}';
    assert.strictEqual(joinElsifElse(input), expected);
  });

  it('joins } + else onto one line', () => {
    const input = 'if c {\naction;\n}\nelse {\nkeep;\n}';
    const expected = 'if c {\naction;\n} else {\nkeep;\n}';
    assert.strictEqual(joinElsifElse(input), expected);
  });

  it('consumes blank lines between } and elsif', () => {
    const input = 'if c {\naction;\n}\n\nelsif c2 {\naction2;\n}';
    const expected = 'if c {\naction;\n} elsif c2 {\naction2;\n}';
    assert.strictEqual(joinElsifElse(input), expected);
  });

  it('is idempotent: } elsif already on one line is not changed', () => {
    const input = 'if c {\naction;\n} elsif c2 {\naction2;\n}';
    assert.strictEqual(joinElsifElse(input), input);
  });

  it('does not merge } when followed by non-elsif/else', () => {
    const input = 'if c {\naction;\n}\nfileinto "Inbox";';
    assert.strictEqual(joinElsifElse(input), input);
  });

  it('preserves leading indentation on the } line', () => {
    const input = 'if outer {\n  if inner {\n    action;\n  }\n  elsif c2 {\n    action2;\n  }\n}';
    const expected = 'if outer {\n  if inner {\n    action;\n  } elsif c2 {\n    action2;\n  }\n}';
    assert.strictEqual(joinElsifElse(input), expected);
  });
});

describe('joinElsifElse — text: heredoc handling', () => {
  it('does not merge a lone } followed by else inside a heredoc body', () => {
    const input = [
      'require ["vacation"];',
      'vacation :reason text:',
      '}',
      'else use this address.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(joinElsifElse(input), input);
  });

  it('does not merge a lone } followed by elsif inside a heredoc body', () => {
    const input = [
      'require ["vacation"];',
      'vacation :reason text:',
      '}',
      'elsif you prefer, call instead.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(joinElsifElse(input), input);
  });

  it('still merges } + elsif in real code outside the heredoc', () => {
    const input = [
      'if header :is "X-Spam" "yes" {',
      '  discard;',
      '}',
      'elsif header :is "X-List" "dev" {',
      '  fileinto "Dev";',
      '}',
      'vacation :reason text:',
      '}',
      'else see above.',
      '.',
      ';',
    ].join('\n');

    const expected = [
      'if header :is "X-Spam" "yes" {',
      '  discard;',
      '} elsif header :is "X-List" "dev" {',
      '  fileinto "Dev";',
      '}',
      'vacation :reason text:',
      '}',
      'else see above.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(joinElsifElse(input), expected);
  });

  it('is idempotent on a heredoc containing } / else lines', () => {
    const input = [
      'vacation :reason text:',
      '}',
      'else try again.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(joinElsifElse(joinElsifElse(input)), input);
  });
});

describe('sortRequireExtensions', () => {
  it('sorts extensions alphabetically', () => {
    assert.strictEqual(
      sortRequireExtensions('require ["vacation", "fileinto", "imap4flags"];'),
      'require ["fileinto", "imap4flags", "vacation"];'
    );
  });

  it('is idempotent on already-sorted extensions', () => {
    const input = 'require ["fileinto", "imap4flags", "vacation"];';
    assert.strictEqual(sortRequireExtensions(input), input);
  });

  it('does not change a single-extension list', () => {
    const input = 'require ["fileinto"];';
    assert.strictEqual(sortRequireExtensions(input), input);
  });

  it('does not change a bare string require', () => {
    const input = 'require "fileinto";';
    assert.strictEqual(sortRequireExtensions(input), input);
  });

  it('sorts case-insensitively', () => {
    assert.strictEqual(
      sortRequireExtensions('require ["Vacation", "fileinto"];'),
      'require ["fileinto", "Vacation"];'
    );
  });

  it('collapses a multi-line require to single-line before sorting', () => {
    const input = 'require [\n  "vacation",\n  "fileinto"\n];';
    assert.strictEqual(
      sortRequireExtensions(input),
      'require ["fileinto", "vacation"];'
    );
  });
});

describe('sortRequireExtensions — text: heredoc handling', () => {
  it('does not sort a require-like list inside a heredoc body', () => {
    const input = [
      'require ["vacation"];',
      'vacation :reason text:',
      'require ["z", "a", "m"] for details.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(sortRequireExtensions(input), input);
  });

  it('still sorts the real require statement before the heredoc', () => {
    const input = [
      'require ["vacation", "fileinto"];',
      'vacation :reason text:',
      'require ["z", "a"] in body.',
      '.',
      ';',
    ].join('\n');

    const expected = [
      'require ["fileinto", "vacation"];',
      'vacation :reason text:',
      'require ["z", "a"] in body.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(sortRequireExtensions(input), expected);
  });

  it('is idempotent on a script with a heredoc', () => {
    const input = [
      'require ["fileinto", "vacation"];',
      'vacation :reason text:',
      'require ["z", "a"] in body.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(sortRequireExtensions(sortRequireExtensions(input)), input);
  });
});

describe('formatDocument — sortRequire: true', () => {
  it('sorts and expands require when both options are on', () => {
    const input = 'require ["vacation", "fileinto", "imap4flags"];\nkeep;';
    const expected = 'require [\n  "fileinto",\n  "imap4flags",\n  "vacation"\n];\nkeep;';
    assert.strictEqual(formatDocument(input, { sortRequire: true, alwaysExpandRequire: true }), expected);
  });

  it('sorts require but keeps it single-line when alwaysExpandRequire is off', () => {
    const input = 'require ["vacation", "fileinto"];\nkeep;';
    const expected = 'require ["fileinto", "vacation"];\nkeep;';
    assert.strictEqual(formatDocument(input, { sortRequire: true }), expected);
  });

  it('is idempotent on already-sorted and expanded require', () => {
    const formatted = 'require [\n  "fileinto",\n  "vacation"\n];\nkeep;';
    assert.strictEqual(
      formatDocument(formatted, { sortRequire: true, alwaysExpandRequire: true }),
      formatted
    );
  });
});

describe('formatDocument — joinElsifElse: false', () => {
  it('leaves } and elsif on separate lines', () => {
    const input = 'if c {\naction;\n}\nelsif c2 {\naction2;\n}';
    // indentBlocks will still run and indent, but the structure stays separate
    const result = formatDocument(input, { joinElsifElse: false });
    assert.ok(result.includes('\nelsif c2 {'), 'elsif should remain on its own line');
  });
});

// ---------------------------------------------------------------------------
// text: heredoc handling
// ---------------------------------------------------------------------------

describe('indentBlocks — text: heredoc handling', () => {
  it('preserves heredoc body lines verbatim inside a block', () => {
    const input = [
      'if condition {',
      'vacation :reason text:',
      'I am on holiday.',
      'Please expect a delayed response.',
      '.',
      ';',
      '}',
    ].join('\n');

    const expected = [
      'if condition {',
      '  vacation :reason text:',
      'I am on holiday.',          // verbatim — heredoc body at column 0
      'Please expect a delayed response.',
      '.',                          // closing dot verbatim
      '  ;',
      '}',
    ].join('\n');

    assert.strictEqual(indentBlocks(input), expected);
  });

  it('preserves a blank line inside the heredoc body', () => {
    const input = [
      'vacation :reason text:',
      'Line one.',
      '',
      'Line two.',
      '.',
      ';',
    ].join('\n');

    // The blank line inside the heredoc must not be stripped.
    const result = indentBlocks(input);
    assert.strictEqual(result, input);
  });

  it('resumes normal indentation after the heredoc closes', () => {
    const input = [
      'if condition {',
      'vacation :reason text:',
      'body',
      '.',
      ';',
      'stop;',
      '}',
    ].join('\n');

    const expected = [
      'if condition {',
      '  vacation :reason text:',
      'body',
      '.',
      '  ;',
      '  stop;',
      '}',
    ].join('\n');

    assert.strictEqual(indentBlocks(input), expected);
  });

  it('is idempotent on already-indented code with a heredoc', () => {
    const input = [
      'if condition {',
      '  vacation :reason text:',
      'body',
      '.',
      '  ;',
      '}',
    ].join('\n');

    assert.strictEqual(indentBlocks(input), input);
  });
});

describe('expandListsToMultiline — text: heredoc handling', () => {
  it('does not expand [...] inside a heredoc body', () => {
    // The vacation body happens to contain bracket-like text.
    const input = [
      'vacation :reason text:',
      'See [section 1, section 2] for details.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(expandListsToMultiline(input), input);
  });

  it('still expands [...] on lines before the heredoc opener', () => {
    const input = [
      'if address :is "To" ["alice@example.com", "bob@example.com"] {',
      'vacation :reason text:',
      'body',
      '.',
      ';',
      '}',
    ].join('\n');

    assert.ok(expandListsToMultiline(input).startsWith('if address :is "To" [\n'));
    // The heredoc body remains untouched.
    assert.ok(expandListsToMultiline(input).includes('\nbody\n.\n'));
  });

  it('still expands [...] on lines after the heredoc closes', () => {
    const input = [
      'vacation :reason text:',
      'body',
      '.',
      'fileinto ["INBOX", "Archive"];',
    ].join('\n');

    const result = expandListsToMultiline(input);
    assert.ok(result.includes('[\n  "INBOX",\n  "Archive"\n]'));
    assert.ok(result.includes('\nbody\n.\n'));
  });
});

describe('normalizeMultilineListIndentation — text: heredoc handling', () => {
  it('does not reindent multi-line [...] content inside a heredoc body', () => {
    // Contrived case: heredoc body contains [...] spanning multiple lines.
    const input = [
      'vacation :reason text:',
      'See [',
      'section 1,',
      'section 2',
      '] for details.',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(normalizeMultilineListIndentation(input), input);
  });
});

describe('normalizeBlankLines — text: heredoc handling', () => {
  it('preserves multiple consecutive blank lines inside a heredoc body', () => {
    const input = [
      'vacation :reason text:',
      'Paragraph one.',
      '',
      '',
      'Paragraph two.',
      '.',
      ';',
    ].join('\n');

    // Two blank lines inside the heredoc must not be collapsed.
    assert.strictEqual(normalizeBlankLines(input), input);
  });

  it('still collapses multiple blank lines outside the heredoc', () => {
    const input = [
      'require ["vacation"];',
      '',
      '',
      'vacation :reason text:',
      'body',
      '.',
      ';',
    ].join('\n');

    const expected = [
      'require ["vacation"];',
      '',
      'vacation :reason text:',
      'body',
      '.',
      ';',
    ].join('\n');

    assert.strictEqual(normalizeBlankLines(input), expected);
  });
});

describe('formatDocument — text: heredoc end-to-end', () => {
  it('formats a vacation rule without corrupting the heredoc body', () => {
    const input = [
      'require ["vacation",];',
      '',
      'if header :contains "X-Spam-Flag" ["YES", "TRUE",] {',
      'discard;',
      '} else {',
      'vacation :days 7 :reason text:',
      'I am on holiday.',
      '',
      'Please expect a delayed response.',
      '.',
      ';',
      '}',
    ].join('\n');

    const expected = [
      'require ["vacation"];',
      '',
      'if header :contains "X-Spam-Flag" [',
      '  "YES",',
      '  "TRUE"',
      '] {',
      '  discard;',
      '} else {',
      '  vacation :days 7 :reason text:',
      'I am on holiday.',
      '',                                   // blank line inside heredoc preserved
      'Please expect a delayed response.',
      '.',
      '  ;',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input), expected);
  });

  it('is idempotent on a formatted vacation rule', () => {
    const formatted = [
      'require ["vacation"];',
      '',
      'if header :contains "X-Spam-Flag" [',
      '  "YES",',
      '  "TRUE"',
      '] {',
      '  discard;',
      '} else {',
      '  vacation :days 7 :reason text:',
      'I am on holiday.',
      '',
      'Please expect a delayed response.',
      '.',
      '  ;',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(formatted), formatted);
  });
});
