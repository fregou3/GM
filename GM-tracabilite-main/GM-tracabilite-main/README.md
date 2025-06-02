# Génération de tableau de traçabilité.

## Description

Cette app permet de compléter les données de scan de QR codes avec les informations de traçabilité obtenues depuis la base PostgreSQL (GMDATA).
Les résultats sont enregistrés au fur et à mesure dans un fichier CSV qui est automatiquement uploadé sur un bucket AWS S3.

## Prérequis

Python 3.12
Un accès PostgreSQL
Un accès S3

## Installation

```bash
pip install -r requirements.txt
```

```
DB_NAME=nom_de_la_base
DB_USER=utilisateur_db
DB_PWD=mot_de_passe_db
DB_HOST=hote_db
DB_PORT=port_db
AWS_ACCESS_KEY_ID=votre_cle_acces_aws
AWS_SECRET_ACCESS_KEY=votre_cle_secrete_aws
```

```bash
streamlit run streamlit_app.py
```
