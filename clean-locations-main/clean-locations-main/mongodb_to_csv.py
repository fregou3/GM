import sys
import os
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_CLIENT=os.getenv("MONGO_CLIENT")
MONGO_DB_NAME=os.getenv("MONGO_DB_NAME")
MONGO_COLLEC_NAME=os.getenv("MONGO_COLLEC_NAME")

if len(sys.argv) < 2:
    print("Missing parameter: output csv path")
    sys.exit()
CSV_PATH = sys.argv[1]

client = MongoClient(MONGO_CLIENT)
db = client[MONGO_DB_NAME]
collection = db[MONGO_COLLEC_NAME]

entries = collection.find({"continent": "EUROPE"})

csv_rows = []

place_attrs = [
    "AddressNumber",
    "Country",
    "Municipality",
    "PostalCode",
    "Region",
    "SubRegion",
    "Street"
]

for i, entry in enumerate(entries):
    
    raw_address = entry["Summary"]["Text"]

    for res in entry["Results"]:
        csv_row = {}
        place = res["Place"]
        for place_attr in place_attrs:
            if place_attr in place:
                csv_row[place_attr.lower()] = place[place_attr]
            else:
                #print("=======")
                #print(entry["code"], entry["faci"])
                #print(raw_address)
                #print(place_attr)
                #print(place)
                csv_row[place_attr.lower()] = None

        #if entry["code"] == "800629":
        #    print(place)

        csv_row["long"] = place["Geometry"]["Point"][0]
        csv_row["lat"] = place["Geometry"]["Point"][1]
        csv_row["relevance"] = res["Relevance"]
        csv_row["raw_address"] = raw_address
        csv_row["code"] = entry["code"]
        csv_row["faci"] = entry["faci"]
        csv_rows.append(csv_row)

df = pd.DataFrame.from_dict(csv_rows)
df.to_csv(CSV_PATH, index=False)
