# cresus
Application simple de prévision de trésorerie pour les indépendants

## Connecter Claude Code

Ma Tréso embarque un serveur MCP (Streamable HTTP, sur `/mcp`) : Claude Code peut consulter ta trésorerie et gérer tes clients, congés et charges, au nom de ton compte. La connexion passe par OAuth 2.1 (PKCE), avec ton compte Ma Tréso.

```bash
claude mcp add --transport http cresus https://cresus.gagnaire.dev/mcp
```

Puis, dans Claude Code, ouvre `/mcp`, choisis `cresus` et clique sur « Authenticate ». Le navigateur s’ouvre sur l’écran de consentement de Ma Tréso (connecte-toi d’abord si besoin) : vérifie l’adresse vers laquelle tu seras renvoyé, puis clique sur « Autoriser ». Pour révoquer l’accès, déconnecte-toi de l’app MCP depuis Claude Code (`/mcp`).

En développement (`npm run dev`), le même serveur répond sur `http://localhost:3000/mcp`.

| Outil | Rôle |
| --- | --- |
| `get_overview` | Projection sur 15 mois (encaissements, charges, résultat, solde, état), synthèse et solde actuel. |
| `get_month` | Détail d’un mois : encaissements et charges. |
| `get_profile` · `update_profile` | Profil (statut juridique, net mensuel, options micro, pistes, alertes). |
| `set_balance` | Nouveau solde du compte. |
| `list_clients` · `create_client` · `update_client` · `delete_client` | Missions et clients (avec tarifs). |
| `add_rate` · `delete_rate` | Tarifs historisés d’un client. |
| `list_leaves` · `add_leaves` · `delete_leaves` | Congés (périodes, coût, mois d’impact). |
| `list_charges` · `create_charge` · `update_charge` · `delete_charge` | Charges. |
| `export_data` | Sauvegarde JSON complète. |

Les montants sont en euros, les dates au format `YYYY-MM-DD` et les mois au format `YYYY-MM`.
