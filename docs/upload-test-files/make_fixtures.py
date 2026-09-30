#!/usr/bin/env python3
"""Generate test files for the "Upload an edited copy of the Constitution"
feature (wizard Step 2). Each file is the current base constitution with a
specific kind of edit or damage applied. EXPECTED describes what the portal
should do with it; backend/tests/test_api.py checks the same table, so the
files and their expectations cannot drift apart.

Run from anywhere:   py -3 docs/upload-test-files/make_fixtures.py
Regenerate after the base constitution changes."""
import re, sys, textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE_FILE = HERE.parent.parent / "backend" / "data" / "constitution" / "cardano-constitution-v1.md"


def _idx(lines, prefix, nth=0):
    hits = [i for i, l in enumerate(lines) if l.startswith(prefix)]
    return hits[nth]


def _section_span(lines, heading):
    """(start, end) of a '### ...' section: its heading line up to the next heading."""
    start = _idx(lines, heading)
    end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("#"))
    return start, end


def editor_noise(lines):
    """What a markdown editor (Typora, Obsidian, ...) does to a file on save."""
    out = []
    quote_open = True
    for l in lines:
        l = re.sub(r"^- ", "* ", l)                          # bullet style
        l = re.sub(r"^(#+ \d+)\. ", r"\1\\. ", l)             # "### 1\. Introduction"
        l = l.replace("[", "\\[").replace("~", "\\~")        # escapes
        buf = []
        for ch in l:                                         # curly quotes
            if ch == '"':
                buf.append("“" if quote_open else "”"); quote_open = not quote_open
            else:
                buf.append(ch)
        out.append("".join(buf) + "  ")                      # trailing spaces
    return out


def hard_wrap(lines, width=80):
    out = []
    for l in lines:
        if l.strip() and not l.startswith("#") and len(l) > width:
            m = re.match(r"^(\d+\.|[-*+])\s+", l)
            indent = "  " if m else ""
            out.extend(textwrap.wrap(l, width=width, subsequent_indent=indent, break_long_words=False, break_on_hyphens=False))
        else:
            out.append(l)
    return out


def build(base_text):
    L = base_text.split("\n")
    cases = []

    def add(name, what, expect, lines, eol="\n", bom=False):
        text = eol.join(lines)
        if bom:
            text = "﻿" + text
        cases.append({"file": name, "what": what, "expect": expect, "text": text})

    # 01 one word
    e = L[:]; i = _idx(L, "Cardano is a decentralized"); e[i] = e[i].replace("decentralized ecosystem", "decentralised ecosystem")
    add("01-one-word.md", "One word changed in the Preamble.",
        {"status": 200, "counts": {"replacements": 1, "additions": 0, "deletions": 0}}, e)

    # 02 editor noise only
    add("02-editor-noise-only.md", "No real edits. Saved by a markdown editor: '*' bullets, backslash escapes, curly quotes, trailing spaces, Windows line endings, BOM.",
        {"status": 200, "counts": {"replacements": 0, "additions": 0, "deletions": 0}}, editor_noise(L), eol="\r\n", bom=True)

    # 03 noise + three edits
    e = L[:]
    i = _idx(L, "With these purposes in mind"); e[i] = e[i] + " Hello."
    del e[_idx(L, "TENET 10")]
    j = _idx(e, "### Section 1 Amendment Rules") + 2; e.insert(j, "A new paragraph inserted under the amendment rules.\n")
    add("03-editor-noise-plus-three-edits.md", "Same editor noise as 02, plus one sentence appended, one paragraph (TENET 10) deleted, one paragraph added.",
        {"status": 200, "counts": {"replacements": 1, "additions": 1, "deletions": 1}}, editor_noise(e), eol="\r\n")

    # 04 deletions
    e = L[:]
    s, t = _section_span(L, "### Section 4 Transparency and Conduct")
    del e[s:t]                                                      # whole section (heading + body)
    del e[_idx(e, "- Network security concerns")]                   # one list item
    del e[_idx(e, "Through unbiased processing")]                   # one paragraph
    add("04-deletions.md", "A whole '### Section 4 Transparency and Conduct' section removed, one list item removed, one Preamble paragraph removed.",
        {"status": 200, "counts": {"replacements": 0, "additions": 0, "deletions": 3}}, e)

    # 05 additions
    e = L[:]
    e.append("\nA closing paragraph added at the very end.")
    e.insert(_idx(e, "- Network security concerns") + 1, "- A brand new trigger for change")
    e.insert(_idx(e, "### Section 1 Amendment Rules") + 2, "A new paragraph inserted under the amendment rules.\n")
    e.insert(0, "A preface paragraph added before the title.\n")
    add("05-additions.md", "New text in four places: before the title, under a heading, a new list item, and at the very end.",
        {"status": 200, "counts": {"replacements": 1, "additions": 3, "deletions": 0},
         "note": "Text before the very first line has nothing to anchor to, so it becomes a replacement of that first line."}, e)

    # 06 repeated lines
    e = L[:]
    e[_idx(L, "##### GUARDRAILS", 3)] = "##### GUARDRAILS (revised)"
    e[_idx(L, "- *maximum transaction size*", 1)] = "- *maximum transaction size* (*maxTxSize*) in bytes"
    add("06-repeated-lines.md", "Edits to lines that occur several times in the base: the 4th '##### GUARDRAILS' heading and the 2nd 'maximum transaction size' bullet.",
        {"status": 200, "counts": {"replacements": 2, "additions": 0, "deletions": 0}, "unique_originals": True,
         "note": "Each selection includes the unchanged line above it, so the change lands in the right place."}, e)

    # 07 hard wrapped
    e = L[:]; i = _idx(L, "Cardano is a decentralized"); e[i] = e[i].replace("decentralized ecosystem", "decentralised ecosystem")
    add("07-hard-wrapped.md", "Every long line wrapped at 80 columns (as some editors do on save), plus the one-word edit from 01.",
        {"status": 200, "counts": {"replacements": 1, "additions": 0, "deletions": 0}}, hard_wrap(e))

    # 08 article rewrite
    e = L[:]
    s, t = _section_span(L, "### Section 1 Amendment Rules")
    body = ["### Section 1 Amendment Rules", "",
            "1. This Constitution may be amended only by a governance action of the amendment type.", "",
            "2. Such an action requires the approval thresholds set out in Appendix I and a ratification period of no fewer than ninety days.", "",
            "3. Amendments take effect at the epoch boundary following ratification.", ""]
    e[s:t] = body
    add("08-section-rewrite.md", "The whole 'Section 1 Amendment Rules' body rewritten as new paragraphs.",
        {"status": 200, "counts": {"replacements": 1, "additions": 0, "deletions": 0},
         "note": "Adjacent changed lines merge into a single replacement."}, e)

    # 09 oversize change
    e = L[:]; e.append("\n" + "Lorem ipsum. " * 8_000)   # ~104k chars
    add("09-oversize-change.md", "A single new paragraph longer than the 100,000-character limit.",
        {"status": 200, "counts": {"replacements": 0, "additions": 1, "deletions": 0}, "warnings": 1,
         "note": "Upload succeeds with a warning; submitting the proposal is rejected until the change is split."}, e)

    # 10 wrong file
    add("10-wrong-file.md", "An unrelated markdown document.",
        {"status": 400, "detail": "does not look like"},
        ["# Meeting notes", "", "- Agenda", "- Actions", "", "Nothing to do with the constitution."])

    # 11 empty
    add("11-empty.md", "An empty file.", {"status": 400, "detail": "empty"}, [""])

    # 12 gutted
    add("12-gutted.md", "Only the first ten lines of the constitution kept.",
        {"status": 400, "detail": "does not look like"}, L[:10])

    # 13 swapped sections
    e = L[:]
    s3 = _idx(L, "## ARTICLE III."); s4 = _idx(L, "## ARTICLE IV."); s5 = _idx(L, "## APPENDIX I.")
    e[s3:s5] = L[s4:s5] + L[s3:s4]
    add("13-swapped-articles.md", "Articles III and IV swapped in order, no wording changed.",
        {"status": 200, "counts_any": True,
         "note": "Moved text shows as a deletion plus an addition (or a replacement); the draft still ends up correct."}, e)

    # 14 whitespace only
    e = []
    for l in L:
        e.append(("\t" + l + "   ") if l.strip() else l)
        if l.startswith("#"):
            e.append("")                                     # extra blank lines
    add("14-whitespace-only.md", "Tabs at line starts, trailing spaces, extra blank lines, Windows line endings. No real edits.",
        {"status": 200, "counts": {"replacements": 0, "additions": 0, "deletions": 0}}, e, eol="\r\n")

    # 15 too large (not committed; generated on demand)
    add("15-too-large.md", "The constitution plus one million extra characters (over the 1 MB upload limit).",
        {"status": 400, "detail": "1,000,000"}, L + ["", "x" * 1_000_000])

    # 16 numbered items
    e = L[:]
    i = _idx(L, "7. Net Change Limit."); e[i] = L[i] + " Extra words."
    i = _idx(L, "3. A Net Change Limit must be set."); e[i] = L[i].replace("must be set.", "must be set for each period.")
    add("16-numbered-items.md", "Two numbered list items edited.",
        {"status": 200, "counts": {"replacements": 2, "additions": 0, "deletions": 0}, "no_markers": True,
         "note": "Selections show without the '7.' / '3.' marker, exactly like a highlight of the page; the draft keeps the numbering."}, e)

    # 17 renumbered
    e = L[:]; i = _idx(L, "7. Net Change Limit."); e[i] = "8." + L[i][2:]
    add("17-renumbered-item.md", "Only a list number changed ('7.' to '8.'), wording untouched.",
        {"status": 200, "counts": {"replacements": 1, "additions": 0, "deletions": 0},
         "note": "The marker differs, so it stays in the selection."}, e)

    # 18 wrapped paragraph without blank line
    e = L[:]; i = _idx(L, "Through unbiased processing"); e.insert(i + 1, "Appended directly under the paragraph with no blank line.")
    add("18-no-blank-line.md", "A new line typed directly under a paragraph without a blank line between.",
        {"status": 200, "counts": {"replacements": 1, "additions": 0, "deletions": 0},
         "note": "Markdown treats it as part of the same paragraph, so it appears as that paragraph extended."}, e)

    return cases


NOT_COMMITTED = {"15-too-large.md"}


def main():
    base = BASE_FILE.read_text(encoding="utf-8")
    for c in build(base):
        (HERE / c["file"]).write_text(c["text"], encoding="utf-8", newline="")
        print(f"wrote {c['file']:32} {len(c['text']):>9,} chars")


if __name__ == "__main__":
    main()
