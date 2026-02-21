# vscode-sieve-formatter

A VS Code extension that provides **syntax highlighting** and **auto-formatting** for [Sieve](https://www.rfc-editor.org/rfc/rfc5228) email filter scripts — useful if you manage Proton Mail rules (or any other Sieve-based filter system) in a git repository.

## Features

### Syntax highlighting

Full TextMate grammar covering:

- Control keywords: `if`, `elsif`, `else`, `require`
- Actions: `fileinto`, `redirect`, `keep`, `discard`, `stop`, `reject`, `vacation`, `notify`, and more
- Tests: `address`, `header`, `envelope`, `size`, `exists`, `allof`, `anyof`, `body`, `date`, and more
- Tagged arguments: `:is`, `:contains`, `:matches`, `:localpart`, `:domain`, etc.
- String literals with escape sequences
- Block comments (`/* ... */`) and line comments (`#`)
- Numeric literals with quantifiers (`K`, `M`, `G`)

### Trailing comma removal

Removes trailing commas from string lists so you don't have to think about them while writing rules:

```sieve
# Before
require ["fileinto", "imap4flags",];

# After
require ["fileinto", "imap4flags"];
```

### Multi-line list expansion

Lists with 2 or more items are automatically expanded to one-item-per-line, making git diffs much cleaner:

```sieve
# Before
if address :is "From" ["alice@example.com", "bob@example.com"] {

# After
if address :is "From" [
  "alice@example.com",
  "bob@example.com"
] {
```

`require` is left on a single line by default — see [Settings](#settings) to opt it in.

### Block indentation

Re-indents `if`, `elsif`, and `else` block bodies based on `{`/`}` nesting depth:

```sieve
# Before
if header :contains "Subject" "spam" {
discard;
} elsif address :is "From" "boss@example.com" {
fileinto "Important";
} else {
keep;
}

# After
if header :contains "Subject" "spam" {
  discard;
} elsif address :is "From" "boss@example.com" {
  fileinto "Important";
} else {
  keep;
}
```

Interior lines of `/* ... */` block comments are preserved verbatim.

### `} elsif` / `} else` joining

Merges a lone `}` onto the same line as a following `elsif` or `else`, consuming any blank lines between them:

```sieve
# Before
}
elsif address :is "From" "boss@example.com" {

# After
} elsif address :is "From" "boss@example.com" {
```

### Blank line normalisation

Collapses runs of more than one consecutive blank line into a single blank line.

---

All transformations run when you format a document (`Shift+Alt+F` / **Format Document**) or on save when **Format On Save** is enabled.

## Settings

| Setting | Default | Description |
|---|---|---|
| `sieve.formatter.expandLists` | `true` | Expand string lists with 2 or more items to one-item-per-line, and normalise indentation of already-multi-line lists. Disable to leave all list formatting untouched. |
| `sieve.formatter.alwaysExpandRequire` | `false` | Apply the same expansion rule to `require [...]`. Single-item `require` is never expanded. Has no effect when `expandLists` is disabled. |
| `sieve.formatter.indentBlocks` | `true` | Re-indent the contents of `if`, `elsif`, and `else` blocks based on brace nesting depth. |
| `sieve.formatter.joinElsifElse` | `true` | Join a lone `}` line with a following `elsif` or `else` onto the same line. |
| `sieve.formatter.normalizeBlankLines` | `true` | Collapse runs of more than one consecutive blank line into a single blank line. |
| `sieve.formatter.sortRequire` | `false` | Sort extensions inside `require [...]` alphabetically. Has no effect on a bare `require "string"` or a single-extension list. |

The indentation inside expanded lists and block bodies respects your VS Code editor settings (spaces vs. tabs, tab size).

## Usage

1. Install the extension
2. Open a `.sieve` file
3. Format with `Shift+Alt+F` (or enable **Format On Save** in VS Code settings)

## Development

See [CLAUDE.md](./CLAUDE.md) for full development guidance. Quick start:

```bash
npm install
npm run compile   # build
npm test          # run unit tests
npm run lint      # lint
```

Press **F5** to launch an Extension Development Host with the extension loaded.

## Roadmap

- Handle `text:` heredoc string literals in all formatter passes (currently treated as code)
- Sort `require` extensions alphabetically (opt-in setting)

## Contributing

PRs welcome. CI (lint + compile + tests) must pass. See [CLAUDE.md](./CLAUDE.md) for the PR checklist.
