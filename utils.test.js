import { describe, it, expect } from 'vitest'
import { parseCSV, serializeCSV, moveRows, reverseByY, searchReplace, convertZToAlpha } from './utils.js'

const HEADER = 'Zone;X;Y;Z;Path;PT;Name;Sorted;Role'
const mkRow = (zone, x, y, z) => ({
  fields: [zone, x, y, z, '', '', '', 'SORTED', ''],
  malformed: false,
})

describe('parseCSV', () => {
  it('parses headers and data row', () => {
    const { headers, rows } = parseCSV(`${HEADER}\nGrocery;36;R05;A;;;;SORTED;`)
    expect(headers).toEqual(['Zone', 'X', 'Y', 'Z', 'Path', 'PT', 'Name', 'Sorted', 'Role'])
    expect(rows).toHaveLength(1)
    expect(rows[0].fields[0]).toBe('Grocery')
    expect(rows[0].malformed).toBe(false)
  })

  it('filters blank lines', () => {
    const { rows } = parseCSV(`${HEADER}\nGrocery;36;R05;A;;;;SORTED;\n\n   \n`)
    expect(rows).toHaveLength(1)
  })

  it('flags rows with wrong field count as malformed', () => {
    const { rows } = parseCSV(`${HEADER}\nGrocery;36;R05`)
    expect(rows[0].malformed).toBe(true)
  })

  it('returns empty result for empty input', () => {
    const { headers, rows } = parseCSV('')
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })
})

describe('serializeCSV', () => {
  it('round-trips a parsed CSV without change', () => {
    const text = `${HEADER}\nGrocery;36;R05;A;;;;SORTED;`
    const { headers, rows } = parseCSV(text)
    expect(serializeCSV(headers, rows)).toBe(text)
  })

  it('preserves original row order through a parse-serialize round-trip', () => {
    const text = [
      HEADER,
      'Grocery;36;R05;A;;;;SORTED;',
      'Grocery;36;R04;A;;;;SORTED;',
      'Chilled;12;L01;B;;;;SORTED;',
    ].join('\n')
    const { headers, rows } = parseCSV(text)
    expect(serializeCSV(headers, rows)).toBe(text)
  })

  it('never emits blank rows', () => {
    const { headers, rows } = parseCSV(`${HEADER}\nGrocery;36;R05;A;;;;SORTED;\n`)
    const out = serializeCSV(headers, rows)
    expect(out.split('\n').every(l => l.trim() !== '')).toBe(true)
  })
})

describe('moveRows', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map(x => ({ fields: [x], malformed: false }))
  const vals = r => r.map(row => row.fields[0])

  it('moves a block forward', () => {
    expect(vals(moveRows(rows, 0, 1, 3))).toEqual(['c', 'd', 'a', 'b', 'e'])
  })

  it('moves a block backward', () => {
    expect(vals(moveRows(rows, 3, 4, 0))).toEqual(['a', 'd', 'e', 'b', 'c'])
  })

  it('moves a block to the top (insertAfterIndex -1)', () => {
    expect(vals(moveRows(rows, 3, 4, -1))).toEqual(['d', 'e', 'a', 'b', 'c'])
  })

  it('returns unchanged when target is inside the selection', () => {
    expect(vals(moveRows(rows, 1, 3, 2))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('reverseByY', () => {
  it('reverses Y groups while preserving Z order within each group', () => {
    const rows = [
      mkRow('G', '02', 'R01', 'A'),
      mkRow('G', '02', 'R01', 'B'),
      mkRow('G', '02', 'R02', 'A'),
      mkRow('G', '02', 'R02', 'B'),
    ]
    const result = reverseByY(rows)
    expect(result.map(r => r.fields[2])).toEqual(['R02', 'R02', 'R01', 'R01'])
    expect(result.map(r => r.fields[3])).toEqual(['A', 'B', 'A', 'B'])
  })

  it('leaves X field unchanged', () => {
    const rows = [mkRow('G', '36', 'R01', 'A'), mkRow('G', '36', 'R02', 'A')]
    expect(reverseByY(rows).every(r => r.fields[1] === '36')).toBe(true)
  })

  it('handles a single Y group (no-op)', () => {
    const rows = [mkRow('G', '36', 'R01', 'A'), mkRow('G', '36', 'R01', 'B')]
    const result = reverseByY(rows)
    expect(result.map(r => r.fields[3])).toEqual(['A', 'B'])
  })
})

describe('searchReplace', () => {
  it('replaces matching field values', () => {
    const rows = [mkRow('Grocery', '36', 'R05', 'A')]
    expect(searchReplace(rows, 'Grocery', 'GROCERY')[0].fields[0]).toBe('GROCERY')
  })

  it('supports regex patterns', () => {
    const rows = [mkRow('G', '36', 'R05', 'A')]
    expect(searchReplace(rows, 'R\\d+', 'BAY')[0].fields[2]).toBe('BAY')
  })

  it('preserves field count — does not corrupt the delimiter structure', () => {
    const rows = [mkRow('Grocery', '36', 'R05', 'A')]
    const result = searchReplace(rows, 'Grocery', 'X')
    expect(result[0].fields).toHaveLength(9)
  })

  it('applies globally across all rows', () => {
    const rows = [mkRow('Grocery', '36', 'R01', 'A'), mkRow('Grocery', '36', 'R02', 'A')]
    const result = searchReplace(rows, 'Grocery', 'Chilled')
    expect(result.every(r => r.fields[0] === 'Chilled')).toBe(true)
  })
})

describe('convertZToAlpha', () => {
  it('converts 1-9 to A-I', () => {
    const rows = [mkRow('G', '36', 'R01', '1'), mkRow('G', '36', 'R01', '2'), mkRow('G', '36', 'R01', '9')]
    const result = convertZToAlpha(rows)
    expect(result.map(r => r.fields[3])).toEqual(['A', 'B', 'I'])
  })

  it('converts 0 to J', () => {
    const rows = [mkRow('G', '36', 'R01', '0')]
    const result = convertZToAlpha(rows)
    expect(result.map(r => r.fields[3])).toEqual(['J'])
  })

  it('ignores anything outside single-digit 0-9', () => {
    const rows = [mkRow('G', '36', 'R01', '10'), mkRow('G', '36', 'R01', '-1'), mkRow('G', '36', 'R01', 'A')]
    const result = convertZToAlpha(rows)
    expect(result.map(r => r.fields[3])).toEqual(['10', '-1', 'A'])
  })

  it('preserves row order', () => {
    const rows = [mkRow('First', '36', 'R01', '2'), mkRow('Second', '36', 'R01', '1')]
    const result = convertZToAlpha(rows)
    expect(result.map(r => r.fields[0])).toEqual(['First', 'Second'])
    expect(result.map(r => r.fields[3])).toEqual(['B', 'A'])
  })
})
