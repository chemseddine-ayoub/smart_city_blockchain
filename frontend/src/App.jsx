import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, ChartNoAxesCombined, CheckCircle2, CircleAlert, Database, FileSpreadsheet, LoaderCircle, ShieldCheck, Wallet, X } from 'lucide-react'
import ImportView from './ImportView'
import { CreateView, IssueDetail, RegistryView } from './IssueViews'
import { loadRegistry, localChain, messageFor, sameAddress, shortAddress, switchNetwork, walletProvider, writeIssue } from './registry'
import './App.css'

function currentRoute() {
  return window.location.hash.slice(1) || '/'
}

function decodeIssue(route) {
  try {
    return decodeURIComponent(route.slice('/signalement/'.length))
  } catch {
    return ''
  }
}

function App() {
  const [route, setRoute] = useState(currentRoute)
  const [data, setData] = useState(null)
  const [readError, setReadError] = useState('')
  const [refreshing, setRefreshing] = useState(true)
  const [session, setSession] = useState({ account: '', chain: 0 })
  const [connecting, setConnecting] = useState(false)
  const [pending, setPending] = useState(null)
  const [notice, setNotice] = useState(null)
  const refreshId = useRef(0)
  const transactionActive = useRef(false)
  const wallet = walletProvider()

  const refresh = useCallback(async () => {
    const id = ++refreshId.current
    try {
      const next = await loadRegistry()
      if (id === refreshId.current) {
        setData(next)
        setReadError('')
      }
    } catch (error) {
      if (id === refreshId.current) setReadError(messageFor(error))
    } finally {
      if (id === refreshId.current) setRefreshing(false)
    }
  }, [])

  function reload() {
    setRefreshing(true)
    void refresh()
  }

  useEffect(() => {
    function onRouteChange() {
      setRoute(currentRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onRouteChange)
    return () => window.removeEventListener('hashchange', onRouteChange)
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!wallet) return
    let active = true
    let accountsChanged = false
    let chainChanged = false
    function onAccounts(accounts) {
      accountsChanged = true
      setSession((current) => ({ ...current, account: accounts[0] ?? '' }))
    }
    function onChain(chain) {
      chainChanged = true
      setSession((current) => ({ ...current, chain: Number(chain) }))
    }
    function onDisconnect() {
      accountsChanged = true
      chainChanged = true
      setSession({ account: '', chain: 0 })
    }
    wallet.on?.('accountsChanged', onAccounts)
    wallet.on?.('chainChanged', onChain)
    wallet.on?.('disconnect', onDisconnect)
    void wallet.request({ method: 'eth_accounts' }).then((accounts) => {
      if (active && !accountsChanged) onAccounts(accounts)
    }, () => {})
    void wallet.request({ method: 'eth_chainId' }).then((chain) => {
      if (active && !chainChanged) onChain(chain)
    }, () => {})
    return () => {
      active = false
      wallet.removeListener?.('accountsChanged', onAccounts)
      wallet.removeListener?.('chainChanged', onChain)
      wallet.removeListener?.('disconnect', onDisconnect)
    }
  }, [wallet])

  const isMunicipality = sameAddress(session.account, data?.municipality)
  const wrongChain = Boolean(session.account) && session.chain !== localChain.id
  const writable = Boolean(data && !readError && session.account && !wrongChain)
  const busy = connecting || Boolean(pending)
  const walletLabel = wrongChain ? 'Passer sur Hardhat' : 'Connecter MetaMask'
  const isImport = route === '/importer'

  function go(next) {
    window.location.hash = next
  }

  async function connect() {
    if (connecting) return
    if (!wallet) {
      setNotice({ type: 'error', text: 'Installez l’extension MetaMask, puis rechargez cette page.' })
      return
    }
    setConnecting(true)
    setNotice(null)
    try {
      const accounts = await wallet.request({ method: 'eth_requestAccounts' })
      if (!accounts.length) throw new Error('Aucun compte autorisé dans le portefeuille.')
      const chain = await wallet.request({ method: 'eth_chainId' })
      setSession({ account: accounts[0], chain: Number(chain) })
      if (Number(chain) !== localChain.id) await switchNetwork(wallet)
      const activeChain = await wallet.request({ method: 'eth_chainId' })
      setSession((current) => ({ ...current, chain: Number(activeChain) }))
    } catch (error) {
      setNotice({ type: 'error', text: messageFor(error) })
    } finally {
      setConnecting(false)
    }
  }

  async function run(action) {
    if (transactionActive.current || !writable) return false
    transactionActive.current = true
    setNotice(null)
    let sentHash = ''
    async function send(functionName, args, label) {
      setPending({ text: `${label} · Confirmez dans le portefeuille.` })
      sentHash = ''
      const hash = await writeIssue({
        address: data.address, account: session.account, functionName, args,
        onSent: (value) => {
          sentHash = value
          setPending({ text: `${label} · Attente de confirmation sur la blockchain.`, hash: value })
        },
      })
      sentHash = ''
      return hash
    }

    try {
      const text = await action(send)
      setNotice({ type: 'success', text })
      return true
    } catch (error) {
      setNotice({ type: 'error', text: messageFor(error), hash: sentHash })
      return false
    } finally {
      await refresh()
      setPending(null)
      transactionActive.current = false
    }
  }

  const actionProps = { writable, busy, run, onConnect: connect, walletLabel, registryReady: Boolean(data && !readError) }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/" aria-label="Cité Signal, accueil">
            <span className="brand-icon"><Building2 size={23} /></span><span>Cité<span className="brand-accent">Signal</span></span>
          </a>
          <nav aria-label="Navigation principale">
            <a href="#/" className={!isImport ? 'nav-active' : ''} aria-current={route === '/' ? 'page' : undefined}><ChartNoAxesCombined size={18} /> Registre public</a>
            <a href="#/importer" className={isImport ? 'nav-active' : ''} aria-current={isImport ? 'page' : undefined}><FileSpreadsheet size={18} /> Import Excel / CSV</a>
          </nav>
          <div className="topbar-actions">
            <span className="network-tag"><i className={data && !readError ? 'online' : ''} aria-hidden="true" /> Hardhat local</span>
            {session.account && !wrongChain ? (
              <span className="wallet-tag" title={session.account}>
                {isMunicipality ? <ShieldCheck size={18} /> : <Wallet size={18} />}
                <span><span>{isMunicipality ? 'Municipalité' : 'Compte citoyen'}</span><small className="mono">{shortAddress(session.account)}</small></span>
              </span>
            ) : <button type="button" className="connect-button" disabled={connecting} onClick={connect}><Wallet size={18} /> {walletLabel}</button>}
          </div>
        </div>
      </header>
      <main className="shell">
        {readError && <div className="notice notice-error" role="alert"><CircleAlert size={20} /><p>{readError}</p><button type="button" disabled={refreshing} onClick={reload}>Réessayer</button></div>}
        {pending ? <div className="notice notice-pending" role="status"><LoaderCircle className="spinner" size={20} /><p>{pending.text}
          {pending.hash && <code className="address">{pending.hash}</code>}</p></div> : notice && (
          <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
            {notice.type === 'success' ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
            <p>{notice.text}{notice.hash && <code className="address">{notice.hash}</code>}</p>
            <button type="button" className="icon-button" aria-label="Fermer le message" onClick={() => setNotice(null)}><X size={17} /></button>
          </div>
        )}
        {isImport ? <ImportView {...actionProps} issues={data?.issues ?? []} />
          : route === '/nouveau' ? <CreateView {...actionProps} go={go} />
            : route.startsWith('/signalement/') ? <IssueDetail key={route} {...actionProps} id={decodeIssue(route)} data={data} refreshing={refreshing} isMunicipality={isMunicipality} />
              : <RegistryView data={data} refreshing={refreshing} refresh={reload} />}
      </main>
      <footer className="site-footer"><div><span><Database size={15} /> CitéSignal · Registre des services urbains</span>
        {data && <span>Contrat <code className="mono address" title={data.address}>{data.address}</code></span>}</div></footer>
    </>
  )
}

export default App
