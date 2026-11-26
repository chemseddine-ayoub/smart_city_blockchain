# Frontend CitéSignal

Ce frontend React/Vite consulte le registre via viem sur Hardhat local et utilise un portefeuille EIP-1193 pour les transactions. Le [guide principal](../README.md) explique le lancement du nœud, le déploiement, la connexion MetaMask et le scénario de démonstration.

```sh
npm ci
npm run dev
npm run lint
npm run build
```

Le déploiement crée `public/deployment.json`. Depuis la racine, `npm run build:contracts` régénère `src/registry-abi.json` à partir du contrat compilé. Le classeur de test est disponible dans `public/urban_issues.xlsx`.
