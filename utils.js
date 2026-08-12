// Y field is at column index 2: Zone;X;Y;Z;Path;PT;Name;Sorted;Role
const Y_INDEX = 2

export function parseCSV(text) {
  // Blank lines are the only rows removed; all others kept in original order
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(';')
  const rows = lines.slice(1).map(line => {
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
