import { readFile, writeFile } from "node:fs/promises";

const artifact = new URL("../artifacts/contracts/UrbanIssueRegistry.sol/UrbanIssueRegistry.json", import.meta.url);
const output = new URL("../frontend/src/registry-abi.json", import.meta.url);
const { abi } = JSON.parse(await readFile(artifact, "utf8"));
await writeFile(output, JSON.stringify(abi, null, 2) + "\n");
