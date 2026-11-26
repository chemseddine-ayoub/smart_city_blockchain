import { network } from "hardhat";
import { writeFile } from "node:fs/promises";

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();
if (chainId !== 31337) throw new Error("Ce script configure uniquement Hardhat local.");

const { contract, deploymentTransaction } = await viem.sendDeploymentTransaction("UrbanIssueRegistry");
const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTransaction.hash });
const deployment = {
  chainId,
  address: contract.address,
  municipality: await contract.read.municipality(),
  transaction: receipt.transactionHash,
  block: Number(receipt.blockNumber),
};

await writeFile(new URL("../frontend/public/deployment.json", import.meta.url), JSON.stringify(deployment, null, 2) + "\n");
console.log(JSON.stringify(deployment, null, 2));
