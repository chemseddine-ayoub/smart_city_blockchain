import { createPublicClient, createWalletClient, custom, defineChain, getAddress, http, isAddress } from 'viem'
import abi from './registry-abi.json'

const rpcUrl = 'http://127.0.0.1:8545'
export const localChain = defineChain({
  id: 31337,
  name: 'Hardhat local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
})

const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl, { retryCount: 0 }), cacheTime: 0 })
const pageSize = 30n

export const statuses = ['Signalé', 'Affecté', 'En cours', 'Résolu', 'Clôturé']
export const priorities = ['Faible', 'Moyenne', 'Élevée']
export const spreadsheetStatuses = ['Reported', 'Assigned', 'InProgress', 'Resolved', 'Closed']
export const spreadsheetPriorities = ['Low', 'Medium', 'High']
export const workflowActions = ['Affecter une équipe', 'Démarrer l’intervention', 'Marquer comme résolu', 'Clôturer le dossier']

export const fieldLimits = {
  issueId: 40, issueType: 60, location: 120, description: 500, reportedBy: 80, assignedTo: 80, comment: 240,
}

export function walletProvider() {
  const provider = window.ethereum
  return provider?.providers?.find((candidate) => candidate.isMetaMask) ?? provider
}

export function sameAddress(first, second) {
  return Boolean(first && second && first.toLowerCase() === second.toLowerCase())
}

export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export async function switchNetwork(provider) {
  const chainId = `0x${localChain.id.toString(16)}`
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (error) {
    if (error.code !== 4902 && error.data?.originalError?.code !== 4902) throw error
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId, chainName: localChain.name, rpcUrls: [rpcUrl], nativeCurrency: localChain.nativeCurrency }],
    })
    const activeChainId = await provider.request({ method: 'eth_chainId' })
    if (Number(activeChainId) !== localChain.id) {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
    }
  }
}

export async function loadDeployment() {
  const response = await fetch(`${import.meta.env.BASE_URL}deployment.json`, { cache: 'no-store' })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Déployez le contrat avec npm run deploy:local, puis actualisez la page.')
  }
  const deployment = await response.json()
  if (!isAddress(deployment.address) || deployment.chainId !== localChain.id) {
    throw new Error('La configuration du déploiement local est invalide.')
  }
  return deployment
}

function read(address, functionName, args, blockNumber) {
  return publicClient.readContract({ address, abi, functionName, args, blockNumber })
}

export async function loadRegistry() {
  const deployment = await loadDeployment()
  let chainId
  try {
    chainId = await publicClient.getChainId()
  } catch {
    throw new Error('Le réseau Hardhat local est inaccessible. Lancez npm run node, puis actualisez la page.')
  }
  if (chainId !== localChain.id) throw new Error('Le RPC local doit utiliser le réseau 31337.')

  const { address } = deployment
  const blockNumber = await publicClient.getBlockNumber()
  if (!await publicClient.getCode({ address, blockNumber })) {
    throw new Error('Le contrat est absent du réseau local. Relancez npm run deploy:local après tout redémarrage de Hardhat.')
  }
  const [municipality, count] = await Promise.all([
    read(address, 'municipality', [], blockNumber), read(address, 'getIssueCount', [], blockNumber),
  ])
  const issues = []
  for (let offset = 0n; offset < count; offset += pageSize) {
    const ids = await read(address, 'getIssueIds', [offset, pageSize], blockNumber)
    const page = await Promise.all(ids.map(async (id) => {
      const issue = await read(address, 'getIssue', [id], blockNumber)
      return { id, ...issue }
    }))
    issues.push(...page)
  }
  return { ...deployment, municipality, issues: issues.reverse(), blockNumber }
}

export async function loadIssueDetails({ address, blockNumber }, id) {
  const [history, source] = await Promise.all([
    read(address, 'getHistory', [id], blockNumber), read(address, 'getImportSource', [id], blockNumber),
  ])
  return { history, source }
}

export async function writeIssue({ address, account, functionName, args, onSent }) {
  const provider = walletProvider()
  if (!provider || !account) throw new Error('Connectez votre portefeuille pour continuer.')
  const [accounts, chain] = await Promise.all([
    provider.request({ method: 'eth_accounts' }), provider.request({ method: 'eth_chainId' }),
  ])
  if (!sameAddress(accounts[0], account) || Number(chain) !== localChain.id) {
    throw new Error('Le compte ou le réseau a changé. Vérifiez votre portefeuille et réessayez.')
  }

  const wallet = createWalletClient({ chain: localChain, transport: custom(provider) })
  const { request } = await publicClient.simulateContract({ address, abi, functionName, args, account: getAddress(account) })
  const hash = await wallet.writeContract(request)
  onSent?.(hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
  if (receipt.status !== 'success') throw new Error('La transaction a été annulée par le contrat.')
  return hash
}

export function messageFor(error) {
  const rejected = error.code === 4001 || error.walk?.((cause) => cause.code === 4001)
  if (rejected) return 'Vous avez refusé la demande dans le portefeuille.'
  return error.walk?.((cause) => Boolean(cause.reason))?.reason ?? error.shortMessage ?? error.message
}
