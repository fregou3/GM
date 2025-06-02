import sys
import os
import pandas as pd
from pymongo import MongoClient
import boto3
from tqdm import tqdm
import numpy as np
from dotenv import load_dotenv

load_dotenv()
MONGO_CLIENT = os.getenv("MONGO_CLIENT")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
MONGO_COLLEC_NAME = os.getenv("MONGO_COLLEC_NAME")
BOTO3_SESSION = os.getenv("BOTO3_SESSION")


if len(sys.argv) < 2:
    print("Missing parameter: input csv path")
    sys.exit()

CSV_PATH = sys.argv[1]

client = MongoClient(MONGO_CLIENT)
db = client[MONGO_DB_NAME]
collection = db[MONGO_COLLEC_NAME]

print(BOTO3_SESSION)

session = boto3.Session(profile_name=BOTO3_SESSION)
client = session.client("location")

cols = [
    "fccusf",
    "fcnomf",
    "fcadrf",
    "fccodf",
    "fcvilf",
    "fcpayf",
    "fcsite",
    "pays",
    "continent",
]
all_loc_df = pd.read_csv(CSV_PATH, dtype={col: str for col in cols}).fillna("")

i = 0

relevance_col = []
all_results = []

pays = sorted(all_loc_df.pays.unique().tolist())

for p in pays:

    loc_df = all_loc_df[all_loc_df.pays == p]

    for _, row in tqdm(loc_df.iterrows(), total=loc_df.shape[0], desc=p):
        code = row["fccusf"].strip().lower()
        nom = row["fcnomf"].strip().lower()
        adresse = row["fcadrf"].strip().lower()
        cp = row["fccodf"].strip().lower()
        ville = row["fcvilf"].strip().lower()
        pays = row["pays"].strip().lower()
        site = row["fcsite"].strip().lower()
        conti = row["continent"].strip().upper()

        adresse_full = f"{adresse}, {cp} {ville}, {pays}"

        response = client.search_place_index_for_text(
            IndexName="geocoding-clients", Text=adresse_full
        )

        if len(response["Results"]) > 0:
            relevance_col.append(response["Results"][0]["Relevance"])
        else:
            relevance_col.append(0)

        response["code"] = code
        response["site"] = site
        response["country"] = p
        response["continent"] = "EUROPE"
        del response["ResponseMetadata"]
        all_results.append(response)

        i += 1
        # loc_df["relevance"] = np.nan
        # loc_df.iloc[:len(relevance_col),-1] = relevance_col
        # loc_df.to_csv("test.csv", index=False)

        if i % 64 == 0:
            collection.insert_many(all_results)
            all_results = []

if len(all_results) > 0:
    collection.insert_many(all_results)
