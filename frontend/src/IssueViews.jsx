import { useEffect, useState } from 'react'
import {
  ArrowLeft, CalendarDays, CircleCheck, ClipboardList, Clock3, FilePlus2, MapPin,
  Plus, RotateCw, Search, ShieldCheck, TriangleAlert, UserRound, Wrench,
} from 'lucide-react'
import { issueArgs } from './importIssues'
import { fieldLimits, loadIssueDetails, messageFor, priorities, statuses, workflowActions } from './registry'

const types = ['Éclairage public', 'Voirie', 'Propreté', 'Espaces verts', 'Mobilier urbain', 'Autre']
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

function timestamp(value) {
  return dateFormatter.format(new Date(Number(value) * 1000))
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}><i aria-hidden="true" />{statuses[status]}</span>
}

function Priority({ priority }) {
  return <span className={`priority priority-${priority}`}><span className="priority-bars" aria-hidden="true"><i /><i /><i /></span>{priorities[priority]}</span>
}

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function Stat({ icon, title, value, tone }) {
  const Icon = icon
  return <div className="panel stat"><span className={`tile-icon ${tone}`}><Icon size={20} /></span><div><span>{title}</span><strong>{value ?? '—'}</strong></div></div>
}

export function RegistryView({ data, refreshing, refresh }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const issues = data?.issues ?? []
  const matching = issues.filter((issue) =>
    (!statusFilter || issue.status === Number(statusFilter)) &&
    (!priorityFilter || issue.priority === Number(priorityFilter)) &&
    normalize(`${issue.id} ${issue.issueType} ${issue.location} ${issue.description}`).includes(normalize(query.trim())),
  )
  const lastPage = Math.max(1, Math.ceil(matching.length / 8))
  const visiblePage = Math.min(lastPage, page)

  return (
    <>
      <section className="hero">
        <div className="hero-pattern" aria-hidden="true" />
        <div className="hero-content">
          <h1>Registre urbain</h1>
          <p>Signalez un incident dans votre quartier et suivez les interventions de la municipalité.</p>
          <a className="button button-white" href="#/nouveau"><Plus size={19} /> Nouveau signalement</a>
        </div>
      </section>
      <section className="stats" aria-label="Indicateurs du registre">
        <Stat icon={ClipboardList} title="Total signalements" value={data && issues.length} tone="tone-teal" />
        <Stat icon={TriangleAlert} title="À affecter" value={data && issues.filter((issue) => issue.status === 0).length} tone="tone-amber" />
        <Stat icon={Wrench} title="En traitement" value={data && issues.filter((issue) => issue.status === 1 || issue.status === 2).length} tone="tone-blue" />
        <Stat icon={CircleCheck} title="Résolus ou clôturés" value={data && issues.filter((issue) => issue.status >= 3).length} tone="tone-green" />
      </section>
      <section className="panel list-panel" aria-labelledby="list-title">
        <div className="panel-heading">
          <div><h2 id="list-title">Signalements publics</h2><p>Recherchez un incident et consultez son historique.</p></div>
          <button type="button" onClick={refresh} disabled={refreshing}><RotateCw size={16} /> Actualiser</button>
        </div>
        <div className="filters">
          <label className="search"><Search size={19} aria-hidden="true" />
            <input type="search" aria-label="Rechercher un signalement" placeholder="Rechercher par identifiant, type ou lieu"
              value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
          </label>
          <select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
            <option value="">Tous les statuts</option>{statuses.map((status, index) => <option value={index} key={status}>{status}</option>)}
          </select>
          <select aria-label="Filtrer par priorité" value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }}>
            <option value="">Toutes les priorités</option>{priorities.map((priority, index) => <option value={index} key={priority}>{priority}</option>)}
          </select>
        </div>
        {matching.length > 0 ? (
          <>
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Signalement</th><th scope="col">Localisation</th><th scope="col">Priorité</th><th scope="col">Statut</th><th scope="col">Équipe</th><th scope="col">Dossier</th></tr></thead>
                <tbody>{matching.slice((visiblePage - 1) * 8, visiblePage * 8).map((issue) => (
                  <tr key={issue.id}>
                    <td><strong>{issue.issueType}</strong><span className="mono cell-subtitle">{issue.id}</span></td>
                    <td><span className="cell-location"><MapPin size={16} />{issue.location}</span></td>
                    <td><Priority priority={issue.priority} /></td><td><StatusBadge status={issue.status} /></td>
                    <td>{issue.assignedTo || <span className="muted">À affecter</span>}</td>
                    <td><a className="table-link" href={`#/signalement/${encodeURIComponent(issue.id)}`} aria-label={`Voir le dossier ${issue.id}`}>Voir le dossier</a></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="panel-footer pagination">
              <p>{matching.length} signalement{matching.length === 1 ? '' : 's'}</p>
              {lastPage > 1 && <div><button type="button" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Précédent</button>
                <span>{visiblePage} / {lastPage}</span>
                <button type="button" disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>Suivant</button></div>}
            </div>
          </>
        ) : <div className="empty"><ClipboardList size={26} /><p>{refreshing ? 'Lecture du registre…' : data ? 'Aucun signalement à afficher.' : 'Le registre est indisponible.'}</p></div>}
      </section>
    </>
  )
}

export function CreateView({ writable, busy, run, onConnect, walletLabel, go, registryReady }) {
  const [fieldError, setFieldError] = useState('')
  const [id] = useState(() => `CITY-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)

  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    for (const key of Object.keys(values)) values[key] = values[key].trim()
    if (Object.values(values).some((value) => value === '')) {
      setFieldError('Renseignez tous les champs du formulaire.')
      return
    }
    setFieldError('')
    values.priority = Number(values.priority)
    const success = await run(async (send) => {
      await send('createIssue', issueArgs(values), 'Enregistrement du signalement')
      return `Signalement ${values.issueId} enregistré.`
    })
    if (success) go(`/signalement/${encodeURIComponent(values.issueId)}`)
  }

  return (
    <>
      <div className="page-heading">
        <div><h1>Nouveau signalement</h1><p>Décrivez le problème observé dans l’espace public.</p></div>
        <a className="button" href="#/"><ArrowLeft size={17} /> Retour au registre</a>
      </div>
      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-intro"><span className="tile-icon"><FilePlus2 size={23} /></span><div><h2>Détails de l’incident</h2><p>Les informations sont consultables sur le réseau local.</p></div></div>
        <div className="field-grid">
          <label>Identifiant<input name="issueId" defaultValue={id} required maxLength={fieldLimits.issueId} /></label>
          <label>Type de problème<select name="issueType" defaultValue="" required>
            <option value="" disabled>Choisir un type</option>{types.map((type) => <option key={type}>{type}</option>)}
          </select></label>
          <label>Localisation<input name="location" placeholder="Rue, quartier ou lieu public" required maxLength={fieldLimits.location} /></label>
          <label>Priorité<select name="priority" defaultValue="1">{priorities.map((priority, index) => <option key={priority} value={index}>{priority}</option>)}</select></label>
          <label className="field-wide">Description<textarea name="description" placeholder="Précisez le problème et son emplacement." rows={4} required maxLength={fieldLimits.description} /></label>
        </div>
        {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
        <div className="form-footer"><p>Utilisez uniquement des données fictives pour la démonstration.</p>
          {writable ? <button className="button-primary" type="submit" disabled={busy}><Plus size={18} /> Enregistrer</button>
            : <button className="button-primary" type="button" disabled={busy || !registryReady} onClick={onConnect}>{registryReady ? walletLabel : 'Registre indisponible'}</button>}
        </div>
      </form>
    </>
  )
}

function MunicipalAction({ issue, run, busy }) {
  const [fieldError, setFieldError] = useState('')
  if (issue.status >= 4) return <p className="closed-state"><CircleCheck size={19} /> Le dossier est clôturé.</p>
  const isAssignment = issue.status === 0

  function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const team = String(values.get('team') ?? '').trim()
    const comment = String(values.get('comment') ?? '').trim()
    if (isAssignment && !team) {
      setFieldError('Renseignez le nom de l’équipe.')
      return
    }
    setFieldError('')
    void run(async (send) => {
      const action = workflowActions[issue.status]
      await send(isAssignment ? 'assignIssue' : 'updateStatus', [issue.id, isAssignment ? team : issue.status + 1, comment], action)
      return `${issue.id} · Statut ${statuses[issue.status + 1].toLowerCase()} confirmé.`
    })
  }

  return <form className="intervention-form" onSubmit={submit}>
    {isAssignment && <label>Équipe d’intervention<input name="team" required maxLength={fieldLimits.assignedTo} placeholder="Ex. Équipe éclairage" /></label>}
    <label>Commentaire <span>(facultatif)</span><textarea name="comment" rows={3} maxLength={fieldLimits.comment} placeholder="Note sur l’intervention" /></label>
    {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
    <button type="submit" className="button-primary" disabled={busy}>{workflowActions[issue.status]}</button>
  </form>
}

export function IssueDetail({ id, data, refreshing, isMunicipality, writable, run, busy }) {
  const issue = data?.issues.find((candidate) => candidate.id === id)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!issue) return
    let active = true
    loadIssueDetails(data, id).then(
      (details) => { if (active) setResult({ id, ...details }) },
      (error) => { if (active) setResult({ id, error: messageFor(error) }) },
    )
    return () => { active = false }
  }, [data, id, issue])

  const details = result?.id === id ? result : null
  const { source } = details ?? {}
  const hasSource = source && Object.values(source).some(Boolean)

  if (!issue) return (
    <section className="panel empty empty-detail"><ClipboardList size={27} /><h1>{refreshing ? 'Lecture du dossier…' : 'Signalement introuvable'}</h1>
      <a className="button" href="#/"><ArrowLeft size={17} /> Retour au registre</a></section>
  )

  return (
    <>
      <div className="page-heading">
        <div><div className="detail-id mono">{issue.id}</div><h1>{issue.issueType}</h1><p className="detail-location"><MapPin size={18} /> {issue.location}</p></div>
        <a className="button" href="#/"><ArrowLeft size={17} /> Retour au registre</a>
      </div>
      <div className="detail-grid">
        <div className="detail-column">
          <section className="panel detail-panel">
            <div className="detail-title"><h2>Informations du signalement</h2><StatusBadge status={issue.status} /></div>
            <p className="issue-description">{issue.description}</p>
            <dl className="metadata">
              <div><dt>Priorité</dt><dd><Priority priority={issue.priority} /></dd></div>
              <div><dt><Wrench size={15} /> Équipe</dt><dd>{issue.assignedTo || 'À affecter'}</dd></div>
              <div><dt><CalendarDays size={15} /> Date de création</dt><dd>{timestamp(issue.reportDate)}</dd></div>
              <div><dt><UserRound size={15} /> Auteur</dt><dd className="mono address">{issue.reportedBy}</dd></div>
            </dl>
          </section>
          {hasSource && <section className="panel detail-panel">
            <h2>Données du fichier importé</h2><p className="muted">Valeurs déclarées dans le fichier source.</p>
            <dl className="metadata">
              <div><dt>Date source</dt><dd>{source.reportDate || '—'}</dd></div>
              <div><dt>Auteur source</dt><dd>{source.reportedBy || '—'}</dd></div>
              <div><dt>Équipe source</dt><dd>{source.assignedTo || '—'}</dd></div>
              <div><dt>Statut source</dt><dd>{source.status || '—'}</dd></div>
            </dl>
          </section>}
          <section className="panel detail-panel" aria-labelledby="history-title">
            <div className="detail-title"><h2 id="history-title">Historique des interventions</h2><Clock3 size={20} /></div>
            {details?.error ? <p className="field-error" role="alert">{details.error}</p> : details?.history ? (
              <ol className="timeline">{[...details.history].reverse().map((entry, index) => (
                <li key={details.history.length - index}>
                  <div className="timeline-heading"><StatusBadge status={entry.status} /><time dateTime={new Date(Number(entry.timestamp) * 1000).toISOString()}>{timestamp(entry.timestamp)}</time></div>
                  {entry.comment && <p>{entry.comment}</p>}
                  <p className="timeline-meta">{entry.assignedTo && <span>{entry.assignedTo} · </span>}<span className="mono address">{entry.actor}</span></p>
                </li>
              ))}</ol>
            ) : <p className="muted">Chargement de l’historique…</p>}
          </section>
        </div>
        <aside className="panel detail-panel workflow-panel">
          <div className="form-intro"><span className="tile-icon"><ShieldCheck size={22} /></span><div><h2>Gestion municipale</h2><p>Suivi de l’intervention</p></div></div>
          <ol className="workflow-steps">{statuses.map((status, index) =>
            <li key={status} className={index === issue.status ? 'current' : index < issue.status ? 'complete' : ''}
              aria-current={index === issue.status ? 'step' : undefined}><span aria-hidden="true">{index < issue.status ? '✓' : index + 1}</span>{status}</li>,
          )}</ol>
          {isMunicipality && writable ? <MunicipalAction key={`${issue.id}/${issue.status}`} issue={issue} run={run} busy={busy} />
            : <p className="muted workflow-note">Les mises à jour sont réservées au compte municipal.</p>}
        </aside>
      </div>
    </>
  )
}
