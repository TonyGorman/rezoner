import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { parseCSV, serializeCSV, moveRows, reverseByY, searchReplace, convertZToAlpha } from './utils.js'
import styles from './App.module.css'

const ROW_HEIGHT = 24
const OVERSCAN_ROWS = 6
const VIRTUALIZE_THRESHOLD = 100

export default function App() {
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [filename, setFilename] = useState('')
  const [anchorRow, setAnchorRow] = useState(null)
  const [selectedRange, setSelectedRange] = useState(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [findText, setFindText] = useState('')
  const [findStatus, setFindStatus] = useState('')
  const [searchPattern, setSearchPattern] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [searchError, setSearchError] = useState('')
  const [loadStats, setLoadStats] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const tableRef = useRef(null)
  const rafRef = useRef(null)
  const pendingScrollTopRef = useRef(0)
  const editorRef = useRef(null)

  const malformedCount = useMemo(
    () => rows.reduce((count, row) => count + (row.malformed ? 1 : 0), 0),
    [rows]
  )
  const hasSelection = selectedRange !== null
  const shouldVirtualize = rows.length > VIRTUALIZE_THRESHOLD

  useEffect(() => {
    const tableEl = tableRef.current
    if (!tableEl) return

    const updateViewport = () => setViewportHeight(tableEl.clientHeight)
    updateViewport()

    const observer = new ResizeObserver(updateViewport)
    observer.observe(tableEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editingCell || !editorRef.current) return
    editorRef.current.focus()
    editorRef.current.select()
  }, [editingCell])

  useEffect(() => {
    const tableEl = tableRef.current
    if (!tableEl) return
    const head = tableEl.querySelector('thead')
    setHeaderHeight(head ? head.offsetHeight : 0)
  }, [headers.length, rows.length])

  const effectiveScrollTop = Math.max(0, scrollTop - headerHeight)
  const visibleRowsCount = Math.max(
    1,
    Math.ceil(Math.max(0, viewportHeight - headerHeight) / ROW_HEIGHT) + OVERSCAN_ROWS * 2
  )
  const virtualStart = shouldVirtualize
    ? Math.max(0, Math.floor(effectiveScrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
    : 0
  const virtualEnd = shouldVirtualize
    ? Math.min(rows.length, virtualStart + visibleRowsCount)
    : rows.length
  const visibleRows = shouldVirtualize ? rows.slice(virtualStart, virtualEnd) : rows
  const topSpacerHeight = shouldVirtualize ? virtualStart * ROW_HEIGHT : 0
  const bottomSpacerHeight = shouldVirtualize ? (rows.length - virtualEnd) * ROW_HEIGHT : 0

  function handleFileOpen(e) {
    const file = e.target.files[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const { headers: h, rows: r, stats } = parseCSV(ev.target.result)
      flushSync(() => {
        setHeaders(h)
        setRows(r)
        setLoadStats(stats)
        setSelectedRange(null)
        setAnchorRow(null)
        setEditingCell(null)
        setEditingValue('')
        setScrollTop(0)
      })
      if (tableRef.current) tableRef.current.scrollTop = 0
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-opened
    e.target.value = ''
  }

  function handleRowClick(i, e) {
    if (editingCell) return
    if (e.shiftKey && anchorRow !== null) {
      setSelectedRange([Math.min(anchorRow, i), Math.max(anchorRow, i)])
    } else {
      setAnchorRow(i)
      setSelectedRange([i, i])
    }
  }

  function handleMove() {
    if (!hasSelection || moveTarget === '') return
    const n = Math.max(0, Math.min(parseInt(moveTarget, 10), rows.length))
    if (isNaN(n)) return
    // UI is 1-based; 0 = move to top (insertAfterIndex -1)
    const insertAfterIndex = n - 1
    const [start, end] = selectedRange
    if (insertAfterIndex >= start && insertAfterIndex <= end) return
    const selCount = end - start + 1
    setRows(moveRows(rows, start, end, insertAfterIndex))
    const newStart = insertAfterIndex < start
      ? insertAfterIndex + 1
      : insertAfterIndex - selCount + 1
    setSelectedRange([newStart, newStart + selCount - 1])
    setAnchorRow(newStart)
  }

  function handleReverseY() {
    if (!hasSelection) return
    const [start, end] = selectedRange
    setRows([
      ...rows.slice(0, start),
      ...reverseByY(rows.slice(start, end + 1)),
      ...rows.slice(end + 1),
    ])
  }

  function rowContainsText(row, text) {
    const needle = text.toLowerCase()
    return row.fields.some(field => field.toLowerCase().includes(needle))
  }

  function scrollRowIntoView(index) {
    const tableEl = tableRef.current
    if (!tableEl) return
    const target = Math.max(0, headerHeight + (index * ROW_HEIGHT) - (ROW_HEIGHT * 2))
    tableEl.scrollTop = target
    pendingScrollTopRef.current = target
    setScrollTop(target)
  }

  function handleFindNext() {
    const query = findText.trim()
    if (!query || rows.length === 0) return

    const start = selectedRange ? selectedRange[1] + 1 : 0
    const total = rows.length

    for (let offset = 0; offset < total; offset += 1) {
      const idx = (start + offset) % total
      if (rowContainsText(rows[idx], query)) {
        setSelectedRange([idx, idx])
        setAnchorRow(idx)
        setFindStatus(`Found row ${idx + 1}`)
        scrollRowIntoView(idx)
        return
      }
    }

    setFindStatus('No matches')
  }

  function startEditingCell(rowIndex, colIndex) {
    if (!rows[rowIndex] || typeof rows[rowIndex].fields[colIndex] !== 'string') return
    setEditingCell({ row: rowIndex, col: colIndex })
    setEditingValue(rows[rowIndex].fields[colIndex])
    setSelectedRange([rowIndex, rowIndex])
    setAnchorRow(rowIndex)
  }

  function applyCellEdit() {
    if (!editingCell) return
    const { row: rowIndex, col: colIndex } = editingCell

    setRows(prevRows => {
      if (!prevRows[rowIndex] || prevRows[rowIndex].fields[colIndex] === undefined) {
        return prevRows
      }
      const nextRows = [...prevRows]
      const nextFields = [...nextRows[rowIndex].fields]
      nextFields[colIndex] = editingValue
      nextRows[rowIndex] = {
        ...nextRows[rowIndex],
        fields: nextFields,
      }
      return nextRows
    })

    setEditingCell(null)
    setEditingValue('')
  }

  function cancelCellEdit() {
    setEditingCell(null)
    setEditingValue('')
  }

  function handleEditorKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyCellEdit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelCellEdit()
    }
  }

  function handleSearchReplace() {
    if (!searchPattern) return
    setSearchError('')
    try {
      setRows(searchReplace(rows, searchPattern, replaceWith))
    } catch (err) {
      setSearchError('Invalid regex: ' + err.message)
    }
  }

  function handleAlphaZ() {
    if (!rows.length) return
    if (editingCell) {
      applyCellEdit()
    }
    setRows(prevRows => convertZToAlpha(prevRows))
  }

  function handleSave() {
    const csv = serializeCSV(headers, rows)
    const suggested = filename || 'pickwalk.csv'
    const requestedName = window.prompt('Save as filename:', suggested)
    if (requestedName === null) return
    const trimmedName = requestedName.trim()
    if (!trimmedName) return
    const finalName = trimmedName.toLowerCase().endsWith('.csv') ? trimmedName : `${trimmedName}.csv`

    const blob = new Blob([csv], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = finalName
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleTableScroll(e) {
    pendingScrollTopRef.current = e.currentTarget.scrollTop
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setScrollTop(pendingScrollTopRef.current)
    })
  }

  const isSelected = i => hasSelection && i >= selectedRange[0] && i <= selectedRange[1]

  return (
    <div className={styles.app}>
      <div className={styles.toolbar}>

        <div className={styles.toolbarGroup}>
          <label className={styles.openBtn}>
            Open CSV
            <input type="file" accept=".csv,.txt" onChange={handleFileOpen} hidden />
          </label>
          {filename && <span className={styles.filename}>{filename}</span>}
          {malformedCount > 0 && (
            <span className={styles.warning}>
              ⚠ {malformedCount} malformed row{malformedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <span className={styles.sep} />

        <div className={styles.toolbarGroup}>
          <label>Move after row</label>
          <input
            type="number"
            min="0"
            className={styles.numInput}
            value={moveTarget}
            placeholder="row #"
            onChange={e => setMoveTarget(e.target.value)}
            disabled={!hasSelection}
          />
          <button onClick={handleMove} disabled={!hasSelection || moveTarget === ''}>
            Move
          </button>
          <button onClick={handleReverseY} disabled={!hasSelection}>
            Reverse Y
          </button>
          <button onClick={handleAlphaZ} disabled={!rows.length}>
            Alpha Z
          </button>
        </div>

        <span className={styles.sep} />

        <div className={styles.toolbarGroup}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Find text"
            value={findText}
            onChange={e => { setFindText(e.target.value); setFindStatus('') }}
          />
          <button onClick={handleFindNext} disabled={!rows.length || !findText.trim()}>
            Find Next
          </button>
          {findStatus && <span className={styles.filename}>{findStatus}</span>}
        </div>

        <span className={styles.sep} />

        <div className={styles.toolbarGroup}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Search (regex)"
            value={searchPattern}
            onChange={e => { setSearchPattern(e.target.value); setSearchError('') }}
          />
          <input
            type="text"
            className={styles.textInput}
            placeholder="Replace with"
            value={replaceWith}
            onChange={e => setReplaceWith(e.target.value)}
          />
          <button onClick={handleSearchReplace} disabled={!rows.length || !searchPattern}>
            Replace All
          </button>
          {searchError && <span className={styles.warning}>{searchError}</span>}
        </div>

        <span className={styles.sep} />

        <div className={styles.toolbarGroup}>
          <button onClick={handleSave} disabled={!rows.length}>
            Save CSV
          </button>
        </div>

      </div>

      <div
        className={styles.tableWrapper}
        ref={tableRef}
        onScroll={handleTableScroll}
      >
        {rows.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th className={styles.rowNum}>#</th>
                {headers.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td className={styles.spacerCell} colSpan={headers.length + 1} style={{ height: topSpacerHeight }} />
                </tr>
              )}

              {visibleRows.map((row, offset) => {
                const i = shouldVirtualize ? virtualStart + offset : offset
                return (
                <tr
                  key={i}
                  className={[
                    isSelected(i) ? styles.selected : '',
                    row.malformed ? styles.malformed : '',
                  ].filter(Boolean).join(' ')}
                  onClick={e => handleRowClick(i, e)}
                >
                  <td className={styles.rowNum}>{i + 1}</td>
                  {row.fields.map((f, j) => {
                    const isEditing = editingCell && editingCell.row === i && editingCell.col === j
                    return (
                      <td
                        key={j}
                        onDoubleClick={e => {
                          e.stopPropagation()
                          startEditingCell(i, j)
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={editorRef}
                            type="text"
                            className={styles.cellEditor}
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={applyCellEdit}
                            onKeyDown={handleEditorKeyDown}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          f
                        )}
                      </td>
                    )
                  })}
                </tr>
                )
              })}

              {bottomSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td className={styles.spacerCell} colSpan={headers.length + 1} style={{ height: bottomSpacerHeight }} />
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Open a CSV file to begin.</p>
        )}
      </div>

      {loadStats && (
        <div
          className={styles.statsFooter}
          title={`${loadStats.loadedRowCount} rows loaded from ${loadStats.inputRowCount} rows in file. ${loadStats.alreadyPlacedErrorsRemoved} already placed paths removed. ${loadStats.primaryLocationFixes} Primary location fixes.`}
        >
          {loadStats.loadedRowCount} rows loaded / {loadStats.inputRowCount} in file | {loadStats.alreadyPlacedErrorsRemoved} already placed paths removed | {loadStats.primaryLocationFixes} Primary location fixes
        </div>
      )}
    </div>
  )
}
