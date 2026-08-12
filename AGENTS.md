# Pickwalk Editor — Agent Guidelines

## Stack
- Vite + React (plain JS, no TypeScript)
- Vitest for tests — `npm run test` runs once, `npm run test:watch` watches
- CSS Modules (`App.module.css`) — no Tailwind, no other UI libraries

## File Structure
| File | Purpose |
|---|---|
| `utils.js` | All pure logic — no React imports |
| `utils.test.js` | Vitest unit tests — one test block per exported function |
| `App.jsx` | State, event handlers, render — no business logic |
| `App.module.css` | Scoped component styles |
| `index.css` | Global reset, element styles (table, button, input, body font) |

No sub-components. Everything stays in `App.jsx`.

## CSV Format
- Delimiter is semicolon (`;`) — never comma
- Columns (0-indexed): `Zone;X;Y;Z;Path;PT;Name;Sorted;Role`
  - Index 0: Zone, Index 1: X (aisle), Index 2: Y (bay), Index 3: Z (shelf)
- **Row order is critical** — top-to-bottom order defines the pickwalk route. No operation may silently reorder rows. Only explicit user actions (Move, Reverse Y) may change order.
- Empty/blank lines must be filtered on parse and never emitted on save
- The `;` delimiter is critical for the external upload system — protect it

## Parse Errors
- Rows with wrong field count load with `malformed: true`
- Malformed rows render with `.malformed` CSS class (red highlight)
- Toolbar shows count: "N malformed rows" when N > 0
- User can still edit and save malformed files — do not block

## Business Logic Rules
- **Reverse by Y**: group rows by Y field (index 2), reverse group order, preserve Z order within each group, X unchanged
- **Search & replace**: apply regex per-field — never on the raw semicolon-joined line, to protect the delimiter
- **Move rows**: insert selected block after a target row index; selection highlight follows the moved block

## Testing Rules
- Write a test for every function added to `utils.js` before moving on
- Use realistic CSV data in fixtures (9-field rows matching the actual column structure)
- Cover: happy path, edge cases (empty input, single row, trailing newlines), malformed rows
