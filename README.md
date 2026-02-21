# vscode-sieve-formatter

A VS Code formatter extension for [Sieve](https://www.rfc-editor.org/rfc/rfc5228) email filter scripts — useful if you manage Proton Mail rules (or any other Sieve-based filter system) in a git repository.

Surprised no formatting extension existed for Sieve, so here we are.

## Features

### Trailing comma removal

Removes trailing commas from string lists and argument groups so you don't have to think about them while writing rules:

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

Both transformations run together when you format a document (`Shift+Alt+F` / Format Document).

`require` is left on a single line by default — see [Settings](#settings) to opt it in.

## Settings

| Setting | Default | Description |
|---|---|---|
| `sieve.formatter.alwaysExpandRequire` | `false` | Expand `require` to multi-line when it lists 2 or more extensions, using the same rule as other lists. Single-item `require` is never expanded. |

With `alwaysExpandRequire` enabled:

```sieve
# Before
require ["fileinto", "imap4flags"];

# After
require [
  "fileinto",
  "imap4flags"
];
```

## Usage

1. Install the extension
2. Open a `.sieve` file
3. Format with `Shift+Alt+F` (or enable **Format On Save** in VS Code settings)

The indentation inside expanded lists respects your VS Code editor settings (spaces vs. tabs, tab size).

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

- [ ] Normalise indentation of lists that are already multi-line but inconsistently indented
- [ ] `sieve.formatter.expandLists` setting to opt out of multi-line expansion
- [ ] Syntax highlighting

## Contributing

PRs welcome. CI (lint + compile + tests) must pass. See [CLAUDE.md](./CLAUDE.md) for the PR checklist.
