# CitéSignal · Smart City & Blockchain

CitéSignal est une application décentralisée qui permet aux citoyens de déclarer des incidents urbains, à la municipalité de piloter les interventions et au public de suivre leur historique. Le projet utilise Solidity, Hardhat 3, React, Vite, viem, MetaMask et SheetJS.

## Lancer l’application

Prérequis recommandés pour cette remise : Node.js 24 LTS, npm, Git et MetaMask dans le navigateur. Sous Windows, utilisez `npm.cmd` si PowerShell bloque `npm.ps1`.

Depuis la racine, installez les dépendances et exécutez les vérifications.

```sh
npm ci
npm --prefix frontend ci
npm run build:contracts
npm run typecheck
npm test
```

Ouvrez trois terminaux à la racine du projet. Gardez le premier en cours d’exécution.

| Terminal | Commande | Résultat |
| --- | --- | --- |
| 1 | `npm run node` | Réseau Hardhat sur `http://127.0.0.1:8545` |
| 2 | `npm run deploy:local` | Déploiement du contrat et génération de `frontend/public/deployment.json` |
| 2, facultatif | `npm run seed:local` | Quatre dossiers fictifs dans différents états |
| 3 | `npm --prefix frontend run dev` | Interface à l’adresse affichée par Vite, généralement `http://127.0.0.1:5173` |

Le réseau Hardhat conserve ses données pendant la session du nœud. Chaque lancement de `deploy:local` crée un nouveau registre. Après un redémarrage du nœud, relancez le déploiement et actualisez l’interface. Si MetaMask conserve une ancienne activité, effacez l’activité du réseau local dans ses paramètres ou recréez ce réseau.

## Déploiement de référence

| Information | Valeur |
| --- | --- |
| Réseau | Hardhat local |
| URL RPC | `http://127.0.0.1:8545` |
| ID de chaîne | `31337` |
| Symbole | `ETH` |
| Contrat | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Municipalité | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Bloc de déploiement | `1` |

Cette adresse correspond au premier déploiement sur un nœud Hardhat neuf avec les comptes par défaut. Les informations de la transaction de référence sont dans [deployment-local.json](docs/deployment-local.json). Le fichier de configuration généré par votre déploiement donne l’adresse utilisée par votre session.

## Démontrer le scénario

1. Consultez le registre et les dossiers sans connecter de portefeuille. La recherche accepte l’identifiant, le type, la localisation et la description.
2. Dans MetaMask, ajoutez le réseau local avec les paramètres du tableau. Importez les comptes de test **#0** et **#1** à partir des clés affichées par votre propre nœud Hardhat. Utilisez ces comptes de développement exclusivement sur le réseau local. Les clés ne sont pas intégrées au projet.
3. Sélectionnez le compte **#1**, cliquez sur **Connecter MetaMask**, ouvrez **Nouveau signalement**, puis créez un dossier avec une localisation, une description et une priorité fictives. Confirmez la transaction dans MetaMask.
4. Passez au compte **#0** dans MetaMask. Le bandeau affiche **Municipalité**. Ouvrez le dossier, saisissez une équipe et confirmez **Affecter une équipe**, puis faites progresser le dossier jusqu’à sa clôture. Ajoutez un commentaire à chaque étape pour illustrer l’historique.
5. Sélectionnez **Import Excel / CSV**, chargez [urban_issues.xlsx](frontend/public/urban_issues.xlsx), vérifiez l’aperçu et importez deux lignes de votre choix. Confirmez une transaction par ligne. Retrouvez les dossiers dans le registre et ouvrez l’un d’eux pour consulter les valeurs du fichier source.

## Import Excel et CSV

SheetJS lit la première feuille dans le navigateur. La taille maximale est de 5 Mo et le fichier accepte jusqu’à 500 lignes de données. Les en-têtes obligatoires sont `issueId`, `issueType`, `location`, `description` et `priority`. Le modèle contient également `reportDate`, `reportedBy`, `assignedTo` et `status`. Les priorités acceptées sont `Low`, `Medium` et `High`. Les dates peuvent être des dates Excel ou du texte `AAAA-MM-JJ`.

L’aperçu signale les champs invalides, les doublons du fichier et les identifiants déjà présents dans le registre. Vous pouvez sélectionner ou désélectionner chaque ligne valide. En cas de refus ou d’échec d’une transaction, l’import s’arrête et conserve les lignes déjà confirmées. Vérifiez l’état dans le registre avant de relancer une transaction envoyée dont la confirmation est en attente.

Un signalement importé commence à l’état **Signalé** avec l’adresse du portefeuille signataire et l’horodatage du bloc. Les champs historiques du fichier sont archivés dans **Données du fichier importé**. Les actions municipales créent leurs propres entrées d’historique.

## Contrat et vérifications

- [UrbanIssueRegistry.sol](contracts/UrbanIssueRegistry.sol) contient le registre, l’index paginé des identifiants, l’historique et les événements de création, d’affectation et de changement de statut.
- [UrbanIssueRegistry.t.sol](contracts/UrbanIssueRegistry.t.sol) couvre la création, les identifiants dupliqués ou inconnus, les droits municipaux, l’ordre des statuts, l’historique, le nombre d’événements et la provenance des imports.
- Le cycle est **Signalé → Affecté → En cours → Résolu → Clôturé**. Le contrat applique les droits d’écriture et conserve le commentaire, l’équipe, la date et l’adresse de l’acteur à chaque étape.
- `npm --prefix frontend run lint` vérifie le code du frontend. `npm --prefix frontend run build` produit la version Vite dans `frontend/dist/`.

Les données de la démonstration sont fictives. Les champs saisis et les adresses des comptes sont lisibles sur la blockchain locale.

## Captures et vidéo

- [Registre public](docs/captures/01-registre-public.png)
- [Déclaration citoyenne](docs/captures/02-declaration.png)
- [Gestion municipale et historique](docs/captures/03-gestion-municipale.png)
- [Aperçu et validation Excel](docs/captures/04-import-excel.png)

La vidéo présente des transactions confirmées par le nœud Hardhat. La capture utilise un portefeuille de test compatible EIP-1193 avec les comptes fictifs du nœud. Pour la démonstration interactive, utilisez l’extension MetaMask en suivant les étapes ci-dessus.

Documentation technique · [Hardhat 3](https://hardhat.org/docs) · [viem](https://viem.sh/) · [Intégration SheetJS et React](https://docs.sheetjs.com/docs/demos/frontend/react/) · [Réseau local avec MetaMask](https://docs.metamask.com/metamask-connect/evm/guides/best-practices/run-devnet/)
