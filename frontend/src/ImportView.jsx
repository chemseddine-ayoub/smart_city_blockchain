import { useState } from 'react'
import { ArrowDownToLine, FileSpreadsheet, Upload } from 'lucide-react'
import { issueArgs, parseIssues } from './importIssues'
import { messageFor, priorities } from './registry'

export default function ImportView({ issues, writable, busy, run, onConnect, walletLabel, registryReady }) {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [confirmed, setConfirmed] = useState(new Map())
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [loading, setLoading] = useState(false)
  const existingIds = new Set(issues.map((issue) => issue.id))
  const canImport = (row) => !row.errors.length && !existingIds.has(row.issueId) && !confirmed.has(row.rowNumber)
  const eligible = rows.filter(canImport)
  const chosen = eligible.filter((row) => selected.has(row.rowNumber))

  async function pickFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setLoading(true)
    setRows([])
    setSelected(new Set())
    setConfirmed(new Map())
    setFileError('')
    setFileName(file.name)
    try {
      const parsed = await parseIssues(file)
      setRows(parsed)
      setSelected(new Set(parsed.filter((row) => !row.errors.length).map((row) => row.rowNumber)))
    } catch (error) {
      setFileError(messageFor(error))
    } finally {
      setLoading(false)
    }
  }

  function toggle(rowNumber) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  function submit() {
    void run(async (send) => {
      let completed = 0
      for (const row of chosen) {
        try {
          const hash = await send('createImportedIssue', [...issueArgs(row), row.source],
            `Importation ${completed + 1} / ${chosen.length} · ${row.issueId}`)
          setConfirmed((previous) => new Map(previous).set(row.rowNumber, hash))
          completed++
        } catch (error) {
          throw new Error(`${completed}/${chosen.length} confirmé(s). Ligne ${row.rowNumber} (${row.issueId}) · ${messageFor(error)}`)
        }
      }
      return `${completed} signalement${completed === 1 ? ' importé' : 's importés'} sur la blockchain.`
    })
  }

  return (
    <>
      <div className="page-heading">
        <div><h1>Importer des signalements</h1><p>Vérifiez le contenu de votre fichier et choisissez les lignes à enregistrer.</p></div>
        <a className="button" href={`${import.meta.env.BASE_URL}urban_issues.xlsx`} download><ArrowDownToLine size={17} /> Télécharger le modèle</a>
      </div>
      <section className="panel upload-panel" aria-labelledby="upload-title">
        <span className="tile-icon"><FileSpreadsheet size={24} /></span>
        <div><h2 id="upload-title">Fichier Excel ou CSV</h2><p>Première feuille, 500 lignes et 5 Mo maximum.</p>
          {fileName && <strong className="file-name">{loading ? 'Lecture de ' : ''}{fileName}</strong>}
        </div>
        <label className="button button-primary upload-button">
          <Upload size={17} /> Choisir un fichier
          <input type="file" aria-label="Choisir un fichier" accept=".xlsx,.csv" disabled={busy || loading} onChange={pickFile} />
        </label>
      </section>
      {fileError && <p className="notice notice-error" role="alert">{fileError}</p>}
      {rows.length > 0 && (
        <section className="panel list-panel" aria-labelledby="preview-title">
          <div className="panel-heading">
            <div><h2 id="preview-title">Aperçu des données</h2><p>{chosen.length} sélectionnée(s) · {confirmed.size} confirmée(s) · {rows.length - eligible.length - confirmed.size} à vérifier</p></div>
            <button type="button" disabled={busy || !eligible.length} onClick={() => setSelected(new Set(
              chosen.length === eligible.length ? [] : eligible.map((row) => row.rowNumber),
            ))}>{chosen.length === eligible.length && eligible.length ? 'Tout désélectionner' : 'Sélectionner les lignes valides'}</button>
          </div>
          <div className="table-scroll import-scroll">
            <table>
              <thead><tr><th scope="col">Choix</th><th scope="col">Ligne / ID</th><th scope="col">Incident</th><th scope="col">Priorité</th><th scope="col">Données source</th><th scope="col">Validation</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td><input type="checkbox" aria-label={`Sélectionner la ligne ${row.rowNumber}`} disabled={!canImport(row) || busy}
                      checked={canImport(row) && selected.has(row.rowNumber)} onChange={() => toggle(row.rowNumber)} /></td>
                    <td><span className="cell-subtitle">Ligne {row.rowNumber}</span><strong className="mono">{row.issueId || '—'}</strong></td>
                    <td><strong>{row.issueType || '—'}</strong><span className="cell-subtitle">{row.location}</span><span className="cell-subtitle">{row.description}</span></td>
                    <td>{priorities[row.priority] ?? '—'}</td>
                    <td className="cell-small">{Object.values(row.source).filter(Boolean).join(' · ') || '—'}</td>
                    <td>{confirmed.has(row.rowNumber) ? <span className="badge status-3" title={confirmed.get(row.rowNumber)}>Confirmé</span>
                      : row.errors.length ? <span className="field-error">{row.errors.join(' · ')}</span>
                        : existingIds.has(row.issueId) ? <span className="field-error">Identifiant déjà enregistré</span>
                          : <span className="badge status-3">Valide</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-footer">
            <p>Chaque ligne sélectionnée demande une confirmation. Les données source sont archivées avec le signalement.</p>
            {writable ? <button type="button" className="button-primary" disabled={!chosen.length || busy} onClick={submit}>
              <Upload size={17} /> Importer la sélection ({chosen.length})
            </button> : <button type="button" className="button-primary" disabled={busy || !registryReady} onClick={onConnect}>{registryReady ? walletLabel : 'Registre indisponible'}</button>}
          </div>
        </section>
      )}
    </>
  )
}
