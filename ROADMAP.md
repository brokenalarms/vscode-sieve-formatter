# Roadmap

## Handle `text:` heredoc string literals

Currently all formatter passes treat `text:` content as ordinary code, which may corrupt vacation bodies and similar multi-line string literals.

In Sieve (RFC 5228 §2.4.2), `text:` begins a multi-line string that ends at a lone `.` on a line by itself (CRLF-terminated):

```sieve
vacation :reason text:
I am on holiday.
Please expect a delayed response.
.
;
```

The passes that need heredoc awareness:

- **`indentBlocks`** — would incorrectly re-indent body lines
- **`expandListsToMultiline`** — could match `[...]` inside the message text
- **`normalizeMultilineListIndentation`** — same risk

The fix requires threading an `inHeredoc` state flag through each pass, similar to how `inBlockComment` is tracked in `indentBlocks`. A line matching `/^text:\s*$/` opens the heredoc; a line matching `/^\.$/` closes it.
