 conceptual_script_copy_function.js
const { Client } = require('pg');

 --- Configuration ---
const sourceDbConfig = {
  user 'postgres',
  host '15.237.20.178',
  database 'gm14012025',
  password 'Neurochain2023',
  port 5432,
};

const targetDbConfig = {
  user 'postgres',
  host '15.237.20.178',
  database 'gm27052025',
  password 'Neurochain2023',
  port 5432,
};

const functionNameToCopy = 'get_envois';
const functionSchema = 'public';  Adaptez si la fonction est dans un autre schéma

 --- Fonctions Utilitaires ---
async function getFunctionDefinition(dbConfig, schema, funcName) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log(`Connecté à la base de données source ${dbConfig.database}`);

     Requête pour obtenir l'OID de la fonction (nécessaire pour pg_get_functiondef)
     Il faut aussi connaître les types d'arguments si la fonction est surchargée.
     Pour simplifier, on suppose qu'elle n'est pas surchargée ou qu'on prend la première trouvée.
     Une meilleure requête identifierait la fonction par sa signature exacte.
    const oidRes = await client.query(
      `SELECT p.oid
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = $1 AND p.proname = $2`,
      [schema, funcName]
    );

    if (oidRes.rows.length === 0) {
      throw new Error(`Fonction ${schema}.${funcName} non trouvée dans la base ${dbConfig.database}.`);
    }
    if (oidRes.rows.length  1) {
         Gérer le cas des fonctions surchargées (même nom, arguments différents)
         Pour cet exemple, on prend la première. Il faudrait affiner la requête SQL
         pour sélectionner la bonne fonction en fonction de ses types d'arguments.
        console.warn(`Attention Plusieurs fonctions nommées ${schema}.${funcName} trouvées. Utilisation de la première.`);
    }
    const functionOid = oidRes.rows[0].oid;

     Récupérer la définition de la fonction
    const funcDefRes = await client.query('SELECT pg_get_functiondef($1oid) as definition', [functionOid]);
    
    if (funcDefRes.rows.length === 0  !funcDefRes.rows[0].definition) {
        throw new Error(`Impossible de récupérer la définition pour la fonction ${schema}.${funcName} (OID ${functionOid}).`);
    }
    console.log(`Définition de la fonction ${schema}.${funcName} récupérée.`);
    return funcDefRes.rows[0].definition;

  } catch (err) {
    console.error(`Erreur lors de la récupération de la définition depuis ${dbConfig.database}`, err.message);
    throw err;  Propage l'erreur
  } finally {
    if (client) {
      await client.end();
      console.log(`Déconnecté de la base de données source ${dbConfig.database}`);
    }
  }
}

async function applyFunctionDefinition(dbConfig, funcDefinition) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log(`Connecté à la base de données cible ${dbConfig.database}`);

     Exécuter la définition de la fonction (CREATE OR REPLACE FUNCTION ...)
    await client.query(funcDefinition);
    console.log(`Définition de la fonction appliquée avec succès à la base ${dbConfig.database}.`);

  } catch (err) {
    console.error(`Erreur lors de l'application de la définition à ${dbConfig.database}`, err.message);
    throw err; 
  } finally {
    if (client) {
      await client.end();
      console.log(`Déconnecté de la base de données cible ${dbConfig.database}`);
    }
  }
}

 --- Exécution du Script ---
async function main() {
  try {
    console.log(`Démarrage du processus de copie pour la fonction ${functionSchema}.${functionNameToCopy}...`);
    const functionDefinition = await getFunctionDefinition(sourceDbConfig, functionSchema, functionNameToCopy);
    
    if (functionDefinition) {
      console.log(n--- Définition de la fonction ---);
      console.log(functionDefinition);
      console.log(--- Fin de la définition ---n);
      
       Demander confirmation avant d'appliquer (sécurité)
       Dans un vrai script, vous pourriez utiliser une bibliothèque pour les prompts
       Pour cet exemple, on continue directement. ATTENTION EN PRODUCTION.
       const readline = require('readline').createInterface({ input process.stdin, output process.stdout });
       await new Promise(resolve = readline.question(`Appliquer cette définition à ${targetDbConfig.database} (ouiNON) `, answer = {
         if (answer.toLowerCase() === 'oui') {
           applyFunctionDefinition(targetDbConfig, functionDefinition).then(resolve).catch(err = { console.error(err); resolve(); });
         } else {
           console.log(Application annulée.);
           resolve();
         }
         readline.close();
       }));
      
       Pour exécution directe (ATTENTION)
       await applyFunctionDefinition(targetDbConfig, functionDefinition);
       console.log(Processus de copie terminé.);

    } else {
      console.log(Aucune définition de fonction n'a été récupérée.);
    }
  } catch (error) {
    console.error(Une erreur générale est survenue dans le script, error.message);
  }
}

main();