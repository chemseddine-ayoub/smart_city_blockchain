import { network } from "hardhat";
import { readFile } from "node:fs/promises";
import { getAddress, isAddressEqual } from "viem";

const { viem } = await network.create();
const client = await viem.getPublicClient();
if (await client.getChainId() !== 31337) throw new Error("Scénario réservé à Hardhat local.");

const { address } = JSON.parse(await readFile(new URL("../frontend/public/deployment.json", import.meta.url), "utf8"));
const [municipality, citizen] = await viem.getWalletClients();
const registry = await viem.getContractAt("UrbanIssueRegistry", getAddress(address));
if (!isAddressEqual(await registry.read.municipality(), municipality.account.address)) {
  throw new Error("Le compte municipal local ne correspond pas au déploiement.");
}

const issues = [
  ["CITY-2026-001", "Éclairage public", "Avenue Mohammed V", "Trois lampadaires sont éteints près du passage piéton.", 2],
  ["CITY-2026-002", "Voirie", "Rue des Orangers", "Un nid-de-poule gêne la circulation à proximité du rond-point.", 1],
  ["CITY-2026-003", "Propreté", "Place des Nations", "Les bacs de tri débordent près de l’entrée du parc.", 0],
  ["CITY-2026-004", "Espaces verts", "Jardin Ibn Sina", "Une branche tombée bloque une allée du jardin.", 1],
] as const;

const ids = await registry.read.getIssueIds([0n, await registry.read.getIssueCount()]);
for (const [id, type, location, description, priority] of issues) {
  if (!ids.includes(id)) {
    const hash = await registry.write.createIssue([id, type, location, description, priority], { account: citizen.account });
    await client.waitForTransactionReceipt({ hash });
  }
}

async function progress(id: string, team: string, comments: string[]) {
  let { status } = await registry.read.getIssue([id]);
  if (status === 0) {
    const hash = await registry.write.assignIssue([id, team, "L’équipe municipale a pris en charge le dossier."]);
    await client.waitForTransactionReceipt({ hash });
    status = 1;
  }
  for (let next = status + 1; next <= comments.length + 1; next++) {
    const hash = await registry.write.updateStatus([id, next, comments[next - 2]]);
    await client.waitForTransactionReceipt({ hash });
  }
}

await progress("CITY-2026-002", "Équipe voirie", []);
await progress("CITY-2026-003", "Équipe propreté", ["La collecte est en cours.", "Les bacs ont été vidés."]);
await progress("CITY-2026-004", "Équipe espaces verts", ["L’intervention a commencé."]);
console.log("Quatre signalements fictifs sont prêts pour la démonstration.");
