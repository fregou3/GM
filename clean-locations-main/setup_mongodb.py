import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

def setup_mongodb():
    """
    Configure une connexion à MongoDB et crée une base de données et une collection pour l'application clean-locations-main.
    Utilise une connexion locale à MongoDB si disponible, sinon propose d'utiliser MongoDB Atlas.
    """
    print("Configuration de MongoDB pour l'application clean-locations-main...")
    
    # Essayer de se connecter à MongoDB local
    try:
        client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000)
        client.server_info()  # Vérifier la connexion
        print("Connexion réussie à MongoDB local.")
        
        # Créer une base de données et une collection
        db = client['clean_locations_db']
        collection = db['locations']
        
        # Insérer un document de test
        collection.insert_one({'test': 'Connexion réussie'})
        
        # Afficher les informations de connexion
        print("\nUtilisez les paramètres suivants dans votre fichier .env :")
        print("MONGO_CLIENT=mongodb://localhost:27017/")
        print("MONGO_DB_NAME=clean_locations_db")
        print("MONGO_COLLEC_NAME=locations")
        
    except Exception as e:
        print(f"Impossible de se connecter à MongoDB local : {e}")
        print("\nPour utiliser MongoDB Atlas (service cloud) :")
        print("1. Créez un compte sur https://www.mongodb.com/cloud/atlas")
        print("2. Créez un cluster gratuit")
        print("3. Obtenez votre chaîne de connexion")
        print("4. Ajoutez les paramètres suivants dans votre fichier .env :")
        print("   MONGO_CLIENT=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/")
        print("   MONGO_DB_NAME=clean_locations_db")
        print("   MONGO_COLLEC_NAME=locations")

if __name__ == "__main__":
    setup_mongodb()
