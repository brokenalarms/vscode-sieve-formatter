import * as assert from 'assert';
import {
  removeTrailingCommas,
  expandListsToMultiline,
  expandRequireToMultiline,
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
});

describe('expandRequireToMultiline', () => {
  it('expands bare-string require to multi-line', () => {
    assert.strictEqual(
      expandRequireToMultiline('require "fileinto";'),
      'require [\n  "fileinto"\n];'
    );
  });

  it('expands single-item list require to multi-line', () => {
    assert.strictEqual(
      expandRequireToMultiline('require ["fileinto"];'),
      'require [\n  "fileinto"\n];'
    );
  });

  it('is idempotent on already-expanded require', () => {
    const input = 'require [\n  "fileinto"\n];';
    assert.strictEqual(expandRequireToMultiline(input), input);
  });

  it('does not touch multi-item require (already handled by expandListsToMultiline)', () => {
    // After expandListsToMultiline runs, multi-item require is already multi-line
    const input = 'require [\n  "fileinto",\n  "imap4flags"\n];';
    assert.strictEqual(expandRequireToMultiline(input), input);
  });

  it('respects the provided indent string', () => {
    assert.strictEqual(
      expandRequireToMultiline('require "fileinto";', '\t'),
      'require [\n\t"fileinto"\n];'
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

  it('does not expand single-item require by default', () => {
    const input = 'require "fileinto";\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input), input);
  });

  it('expands single-item require when alwaysExpandRequire is true', () => {
    const input = 'require "fileinto";\nfileinto "Inbox";';
    const expected = 'require [\n  "fileinto"\n];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), expected);
  });

  it('expands single-item list require when alwaysExpandRequire is true', () => {
    const input = 'require ["fileinto"];\nfileinto "Inbox";';
    const expected = 'require [\n  "fileinto"\n];\nfileinto "Inbox";';
    assert.strictEqual(formatDocument(input, { alwaysExpandRequire: true }), expected);
  });

  it('handles a realistic Sieve rule', () => {
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

    assert.strictEqual(formatDocument(input), expected);
  });
});
