import * as assert from 'assert';
import {
  removeTrailingCommas,
  expandListsToMultiline,
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

  it('handles a realistic Sieve rule (require not expanded by default)', () => {
    const input = [
      'require ["fileinto", "imap4flags",];',
      '',
      'if address :is "From" ["alice@example.com", "bob@example.com",] {',
      '  fileinto "Team";',
      '}',
    ].join('\n');

    const expected = [
      'require ["fileinto", "imap4flags"];',
      '',
      'if address :is "From" [\n  "alice@example.com",\n  "bob@example.com"\n] {',
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
      '  fileinto "Team";',
      '}',
    ].join('\n');

    const expected = [
      'require [\n  "fileinto",\n  "imap4flags"\n];',
      '',
      'if address :is "From" [\n  "alice@example.com",\n  "bob@example.com"\n] {',
      '  fileinto "Team";',
      '}',
    ].join('\n');

    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), expected);
  });
});
