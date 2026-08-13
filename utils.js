// Y field is at column index 2: Zone;X;Y;Z;Path;PT;Name;Sorted;Role
const Y_INDEX = 2
const Z_INDEX = 3

export function parseCSV(text) {
  // Blank lines are the only rows removed; all others kept in original order
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(';')
  const seen = new Set()
  const uniqueDataLines = []
  for (const line of lines.slice(1)) {
    if (seen.has(line)) continue
    seen.add(line)
    uniqueDataLines.push(line)
  }
  const rows = uniqueDataLines.map(line => {
    const fields = line.split(';')
    return { fields, malformed: fields.length !== headers.length }
  })
  return { headers, rows }
}

export function serializeCSV(headers, rows) {
  const lines = [headers.join(';')]
  for (const row of rows) {
    if (row.fields.some(f => f.trim() !== '')) {
      lines.push(row.fields.join(';'))
    }
  }
  return lines.join('\n')
}

export function moveRows(rows, start, end, insertAfterIndex) {
  if (insertAfterIndex >= start && insertAfterIndex <= end) return rows
  const selected = rows.slice(start, end + 1)
  const without = [...rows.slice(0, start), ...rows.slice(end + 1)]
  const adj = insertAfterIndex > end
    ? insertAfterIndex - (end - start + 1)
    : insertAfterIndex
  const at = Math.max(0, Math.min(adj + 1, without.length))
  return [...without.slice(0, at), ...selected, ...without.slice(at)]
}

export function reverseByY(rows) {
  const groups = []
  let current = null
  for (const row of rows) {
    const y = row.fields[Y_INDEX]
    if (!current || current.y !== y) {
      current = { y, rows: [] }
      groups.push(current)
    }
    current.rows.push(row)
  }
  groups.reverse()
  return groups.flatMap(g => g.rows)
}

export function searchReplace(rows, pattern, replacement) {
  const re = new RegExp(pattern, 'g')
  return rows.map(row => ({
    ...row,
    fields: row.fields.map(f => f.replace(re, replacement)),
  }))
}

export function convertZToAlpha(rows) {
  return rows.map(row => {
    const z = row.fields[Z_INDEX]
    const trimmed = z.trim()
    if (!/^[0-9]$/.test(trimmed)) return row

    const n = Number(trimmed)
    if (n < 0 || n > 9) return row

    const nextFields = [...row.fields]
    nextFields[Z_INDEX] = n === 0 ? 'J' : String.fromCharCode(64 + n)
    return {
      ...row,
      fields: nextFields,
    }
  })
}
