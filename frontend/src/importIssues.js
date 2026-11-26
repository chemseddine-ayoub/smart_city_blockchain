import { fieldLimits, spreadsheetPriorities, spreadsheetStatuses } from './registry'

const required = ['issueId', 'issueType', 'location', 'description', 'priority']
const optional = ['reportDate', 'reportedBy', 'assignedTo', 'status']
export const columns = ['issueId', 'issueType', 'location', 'description', 'reportDate', 'priority', 'reportedBy', 'assignedTo', 'status']

function asText(value) {
  return String(value ?? '').trim()
}

export async function parseIssues(file) {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Formats acceptés .xlsx et .csv.')
  if (file.size > 5_000_000) throw new Error('Le fichier doit faire moins de 5 Mo.')

  const { read, utils, SSF } = await import('xlsx')
  const data = await file.arrayBuffer()
  if (!data.byteLength) throw new Error('Le fichier est vide.')
  const isCsv = /\.csv$/i.test(file.name)
  const input = isCsv ? new TextDecoder().decode(data) : data
  const book = read(input, { type: isCsv ? 'string' : 'array', raw: true, sheetRows: 502 })
  const sheet = book.Sheets[book.SheetNames[0]]
  if (!sheet) throw new Error('Aucune feuille de données trouvée.')
  const [header, ...records] = utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true })
  const labels = (header ?? []).map((label) => asText(label).toLowerCase())
  const indexes = Object.fromEntries(columns.map((column) => [column, labels.indexOf(column.toLowerCase())]))
  const missing = required.filter((column) => indexes[column] === -1)
  if (missing.length) throw new Error(`Colonnes obligatoires manquantes : ${missing.join(', ')}.`)
  if (columns.some((column) => labels.indexOf(column.toLowerCase()) !== labels.lastIndexOf(column.toLowerCase()))) {
    throw new Error('Chaque colonne du modèle doit apparaître une seule fois.')
  }
  const firstRow = utils.decode_range(sheet['!ref']).s.r + 1
  if (records.length > 500) throw new Error('Le fichier est limité à 500 lignes de données.')

  const rows = records.flatMap((record, index) => {
    if (record.every((value) => asText(value) === '')) return []
    const values = Object.fromEntries(columns.map((column) => [column, asText(record[indexes[column]])]))
    const rawDate = record[indexes.reportDate]
    if (typeof rawDate === 'number') {
      const date = SSF.parse_date_code(rawDate, { date1904: book.Workbook?.WBProps?.date1904 })
      if (date) values.reportDate = [date.y, date.m, date.d].map((part, i) => String(part).padStart(i ? 2 : 4, '0')).join('-')
    }
    const errors = required.filter((column) => !values[column]).map((column) => `${column} vide`)
    for (const [column, limit] of Object.entries(fieldLimits)) {
      if (values[column]?.length > limit) errors.push(`${column} dépasse ${limit} caractères`)
    }
    const priority = spreadsheetPriorities.findIndex((value) => value.toLowerCase() === values.priority.toLowerCase())
    if (values.priority && priority === -1) errors.push('priorité attendue : Low, Medium ou High')
    if (values.reportDate) {
      const date = new Date(`${values.reportDate}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.reportDate) || Number.isNaN(date.valueOf()) ||
          date.toISOString().slice(0, 10) !== values.reportDate) errors.push('date attendue : AAAA-MM-JJ')
    }
    const status = spreadsheetStatuses.find((value) => value.toLowerCase() === values.status.toLowerCase())
    if (values.status && !status) errors.push('statut source inconnu')
    if (status) values.status = status
    const source = Object.fromEntries(optional.map((column) => [column, values[column]]))
    const rowNumber = firstRow + index + 1
    return [{ ...values, rowNumber, priority, source, errors }]
  })
  if (!rows.length) throw new Error('Le fichier ne contient aucun signalement.')

  const frequency = new Map()
  for (const { issueId } of rows) frequency.set(issueId, (frequency.get(issueId) ?? 0) + 1)
  for (const row of rows) {
    if (row.issueId && frequency.get(row.issueId) > 1) row.errors.push('identifiant en double dans le fichier')
  }
  return rows
}

export function issueArgs(values) {
  return [values.issueId, values.issueType, values.location, values.description, values.priority]
}
