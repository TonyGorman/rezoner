# Pickwalk Editor

Browser editor for semicolon-delimited pickwalk CSV files.
CSV columns: `Zone;X;Y;Z;Path;PT;Name;Sorted;Role`

## Capabilities

- Open, edit, and save CSV files without reordering rows accidentally.
- Select single rows or ranges, move them, and reverse selected rows by Y.
- Double-click cells to edit them inline.
- Find matching rows and replace text using a regular expression.
- Convert numeric Z values to letters with `Alpha Z`.
- Highlight malformed rows instead of blocking edits or saves.
- Remove duplicate input lines and report automatic Primary/Secondary role fixes.

Click a row to select it; use Shift-click to select a range. Saved files retain the semicolon delimiter and omit blank rows.

## Run

```sh
npm install
npm run dev
```

## Test

```sh
npm test
```
