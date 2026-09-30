# Test files for "Upload an edited copy of the Constitution"

These files exercise the upload path in wizard Step 2 (**New proposal → CAP →
Step 2 → Upload edited (.md)**). Each one is the current ratified constitution
with a specific kind of edit or damage applied. Upload it and compare what the
portal shows with the *Expected* column.

`backend/tests/test_api.py` runs every file in this table through the backend
and checks the same expectations, so the files and this table cannot drift
apart. Regenerate the files after the base constitution changes:

```
py -3 docs/upload-test-files/make_fixtures.py
```

`15-too-large.md` is not committed (it is over 1 MB by design); the command
above creates it.

| File | What it contains | Expected |
|---|---|---|
| `01-one-word.md` | One word changed in the Preamble | 1 replacement |
| `02-editor-noise-only.md` | No real edits. Saved by a markdown editor: `*` bullets, backslash escapes, curly quotes, trailing spaces, Windows line endings, BOM | "No differences found" |
| `03-editor-noise-plus-three-edits.md` | Same noise as 02, plus one sentence appended, TENET 10 deleted, one paragraph added | 1 replacement, 1 addition, 1 deletion |
| `04-deletions.md` | A whole `### Section 4 Transparency and Conduct` section removed, one list item removed, one Preamble paragraph removed | 3 deletions |
| `05-additions.md` | New text before the title, under a heading, a new list item, and at the very end | 1 replacement, 3 additions. Text before the first line has nothing to anchor to, so it becomes a replacement of that first line |
| `06-repeated-lines.md` | Edits to lines that occur several times in the base (the 4th `##### GUARDRAILS`, the 2nd "maximum transaction size" bullet) | 2 replacements. Each selection includes the unchanged line above it so the change lands in the right place |
| `07-hard-wrapped.md` | Every long line wrapped at 80 columns, plus the edit from 01 | 1 replacement |
| `08-section-rewrite.md` | The whole "Section 1 Amendment Rules" body rewritten | 1 replacement (adjacent changed lines merge) |
| `09-oversize-change.md` | One new paragraph longer than 100,000 characters | 1 addition plus a warning. Submitting the proposal is rejected until the change is split |
| `10-wrong-file.md` | An unrelated markdown document | Rejected: "does not look like an edited copy of the current constitution" |
| `11-empty.md` | An empty file | Rejected: "The uploaded file is empty" |
| `12-gutted.md` | Only the first ten lines kept | Rejected: "does not look like..." |
| `13-swapped-articles.md` | Articles III and IV swapped, no wording changed | A deletion and an addition (the moved block). The draft ends up in the new order |
| `14-whitespace-only.md` | Tabs, trailing spaces, extra blank lines, Windows line endings. No real edits | "No differences found" |
| `15-too-large.md` | The constitution plus one million extra characters | Rejected before upload: "That file is too large (max 1 MB)" |
| `16-numbered-items.md` | Two numbered list items edited | 2 replacements shown without the `7.` / `3.` marker, like a highlight of the page. The draft keeps the numbering |
| `17-renumbered-item.md` | Only a list number changed (`7.` to `8.`) | 1 replacement, marker kept in the selection |
| `18-no-blank-line.md` | A new line typed directly under a paragraph, no blank line between | 1 replacement: markdown treats it as part of that paragraph |

For every accepted file, applying the derived revisions to the base must
reproduce the uploaded text (ignoring editor noise). The test checks that too.

## What the upload path does not handle

- Word, PDF or `.docx` files. Only plain markdown text; export to markdown first.
- A copy of an older constitution version. Always start from the current
  download.
- Rewriting the whole document. If fewer than half of the lines still match,
  the file is rejected as "not an edited copy".
- Moved text shows as a deletion plus an addition rather than a "move".
