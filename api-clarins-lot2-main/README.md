# Documentation de l'API

Cette API FastAPI permet d'accéder à des information de la base GMDATA.

## Installation de l'application

```bash
pip install pdm
pdm install
```

```env
DB_NAME=***
DB_USER=***
DB_PWD=***
DB_HOST=***
DB_PORT=***
# Api key qui sera utilisee pour authentifier les appels
API_KEY=***

# Root URL si derriere un reverse proxy
ROOT_PATH=/my-url/
```

Pour le test en local
```bash
pdm run start
```

Pour la run en prod
```bash
pdm run start_prod
```

## Endpoints

### `/article/{code}`

**Méthode**: GET

**Description**: Récupère les détails d'un article.

**Paramètres**:
- `code` (string): Code identifiant l'article

**Réponse**: Un objet `Article` avec les propriétés suivantes:
- `code`: Identifiant de l'article
- `designation`: Description de l'article en français
- `designation_en`: Description de l'article en anglais
- `quantite_pk`: Nombre d'unités dans un prepack
- `quantite_pa`: Nombre d'unités dans une palette
- `actif`: Statut d'activité de l'article

**Tables consultées**:
- `martip00`: Table des articles 
  - Colonnes: `maarti`, `madesi`, `maname`, `maqtpk`, `maqtpa`, `maacti`

**Codes d'erreur**:
- 404: L'article n'a pas été retrouvé

### `/tracabilite/unite/{code_para}`

**Méthode**: GET

**Description**: Récupère l'historique de traçabilité d'une unité.

**Paramètres**:
- `code_para` (string): Code de l'unité

**Réponse**: Une liste d'objets `Tracabilite` avec les propriétés suivantes:
- `date`: Date et heure de l'événement
- `localisation`: Informations sur la localisation (optionnel)
  - `adresse`: Adresse physique
  - `code_postal`: Code postal
  - `ville`: Ville
  - `pays`: Nom du pays
  - `code_pays`: Code du pays (format ISO alpha-2)
  - `code_client`: Identifiant du client
  - `code_faci`: Code de la facilité (optionnel)
  - `code_site`: Code du site (optionnel)
- `type`: Type d'envoi ("Envoi Amiens" ou "Envoi Filiale")
- `emballage`: Type d'emballage ("UNI", "PK", ou "PA")
- `code_parallele`: Code de référence

**Tables consultées**:
- Fonction SQL `get_envois()`: Récupère les informations d'envoi
  - Cette fonction nécessite l'accès aux tables:
    - Envois d'Amiens: `aparap00`, `aeprep00`
    - Envoi filiale: `fparap00`
    - Conditionnement: `cpkunp00`, `cpapkp00`
- `acliep00`: Table des clients pour les envois vers Amiens
  - Colonnes: `aclvcd`, `aclnom`, `aclad2`, `aclad1`, `aclpos`, `aclvil`, `accpay`, `acfaci`
- `fcliep00`: Table des clients pour les envois vers une filiale
  - Colonnes: `fccusf`, `fcnomf`, `fcadrf`, `fccodf`, `fcvilf`, `fcpayf`, `fcsite`
- `world.csv`: Fichier de correspondance entre codes pays et noms de pays

**Codes d'erreur**:
- 404: Pas de traçabilité pour cette unité

### `/palette/{code_para}`

**Méthode**: GET

**Description**: Récupère les informations d'une palette à partir de son code.

**Paramètres**:
- `code_para` (string): Code identifiant la palette

**Réponse**: Un objet `Palette` avec les propriétés suivantes:
- `code_para`: Code identifiant de la palette
- `code_article`: Code de l'article contenu
- `lot`: Numéro de lot
- `date_creation`: Date et heure de création de la palette

**Tables consultées**:
- `cpalep00`: Table des palettes
  - Colonnes: `cppale`, `cparti`, `cpbano`, `cpdate`

**Codes d'erreur**:
- 404: La palette n'a pas été retrouvée

### `/prepack/{code_para}`

**Méthode**: GET

**Description**: Récupère les informations d'un prepack à partir de son code.

**Paramètres**:
- `code_para` (string): Code identifiant le prepack

**Réponse**: Un objet `Prepack` avec les propriétés suivantes:
- `code_para`: Code identifiant du prepack
- `code_article`: Code de l'article contenu
- `lot`: Numéro de lot
- `date_creation`: Date et heure de création du prepack
- `palette`: Informations sur la palette contenant ce prepack (optionnel)

**Tables consultées**:
- `cparap00`: Table des prepacks
- `cpapkp00`: Table de liaison entre prepacks et palettes
- `cpalep00`: Table des palettes
  - Colonnes consultées: `cppale`, `cparti`, `cpbano`, `cpdate`, `cppara`

**Codes d'erreur**:
- 404: Le prepack n'a pas été retrouvé

### `/unite/{code_para}`

**Méthode**: GET

**Description**: Récupère les informations d'une unité à partir de son code.

**Paramètres**:
- `code_para` (string): Code identifiant l'unité

**Réponse**: Un objet `Unite` avec les propriétés suivantes:
- `code_para`: Code identifiant de l'unité
- `prepack`: Informations sur le prepack contenant cette unité (optionnel)
  - Inclut également les informations sur la palette si disponible

**Tables consultées**:
- `cpkunp00`: Table des unités
- `cparap00`: Table des prepacks
- `cpapkp00`: Table de liaison entre prepacks et palettes
- `cpalep00`: Table des palettes
  - Colonnes: `cppale`, `cparti`, `cpbano`, `cpdate`, `cppara`, `cpunit`

**Codes d'erreur**:
- 404: L'unité n'a pas été retrouvée