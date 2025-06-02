import os
import pandas as pd
import csv
from dotenv import load_dotenv
from typing import Callable
import boto3
import requests
from concurrent.futures import ThreadPoolExecutor
import argparse

import threading

load_dotenv()

columns_envoi = [
    "type_envoi",
    "code_parallele",
    "emballage",
]

columns_loc = [
    "date_envoi",
    "adresse_envoi",
    "cp_envoi",
    "ville_envoi",
    "pays_alpha2_envoi",
    "pays_envoi",
]

csv_columns = ["scan_id"] + columns_envoi + columns_loc

s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

S3_DIR = "gm-tracabilite"

csv_lock = threading.Lock()
counter_lock = threading.Lock()
processed_rows = 0
total_rows = 0


def get_tracabilite(code_unite: str):
    headers = {
        "accept": "application/json",
        "authorization": os.getenv("API_CLARINS_LOT2_TOKEN"),
    }
    response = requests.get(
        f"{os.getenv("API_CLARINS_LOT2_ENDPOINT")}/tracabilite/unite/{code_unite}",
        headers=headers,
    )
    if response.status_code == 200:
        return response.json()

    return None

def save_s3(output_file: str):
    s3.upload_file(output_file, "ptc-phd-s3", f"{S3_DIR}/{output_file}")


def process_scans(
    scans_df: pd.DataFrame,
    output_file: str,
    progress_callback: Callable[[int, str], None],
):
    res_dic = {
        "type_envoi": [],
        "code_parallele": [],
        "emballage": [],
        "date_envoi": [],
        "adresse_envoi": [],
        "cp_envoi": [],
        "ville_envoi": [],
        "pays_alpha2_envoi": [],
        "pays_envoi": [],
    }
    i = 0
    for _, row in scans_df.iterrows():
        envois = get_tracabilite(row["ID 10 N"])
        res_dic["scan_id"] = row["ID 10 N"]
        if envois is not None and len(envois) > 0:
            for envoi in envois:
                res_dic["type_envoi"].append(envoi["type"])
                res_dic["code_parallele"].append(envoi["code_parallele"])
                res_dic["emballage"].append(envoi["emballage"])
                res_dic["date_envoi"].append(envoi["date"])
                if "localisation" in envoi and envoi["localisation"] is not None:
                    res_dic["adresse_envoi"].append(envoi["localisation"]["adresse"])
                    res_dic["cp_envoi"].append(envoi["localisation"]["code_postal"])
                    res_dic["ville_envoi"].append(envoi["localisation"]["ville"])
                    res_dic["pays_alpha2_envoi"].append(
                        envoi["localisation"]["code_pays"]
                    )
                    res_dic["pays_envoi"].append(envoi["localisation"]["pays"])
                else:
                    for col in columns_loc:
                        res_dic[col].append(None)
        else:
            for col in columns_envoi + columns_loc:
                res_dic[col].append(None)

        res_df = pd.DataFrame.from_dict(res_dic)
        res_df.to_csv(output_file, columns=csv_columns, index=False)
        progress_callback(
            int(i / scans_df.shape[0] * 100),
            f"Analyse scan {i+1}/{scans_df.shape[0]}",
        )
        i += 1

        if i % 10 == 0:
            save_s3(output_file)
                    


def update_progress(progress_callback):
    global processed_rows
    with counter_lock:
        processed_rows += 1
        percentage = (processed_rows / total_rows) * 100
        progress_callback(
            int(percentage), f"Analyse scan {processed_rows}/{total_rows}"
        )


def append_row_to_csv(row_dict):
    with csv_lock:
        with open("results.csv", "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=csv_columns)
            writer.writerow(row_dict)

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        prog="traceabilite",
    )
    parser.add_argument("-i", "--input")
    parser.add_argument("-o", "--output")
    parser.add_argument("-l", "--log")
    args = parser.parse_args()

    if not args.input or not args.output or not args.log:
        if not args.input:
            print("Argument 'input' (-i) manquant")
        if not args.output:
            print("Argument 'output' (-o) manquant")
        if not args.log:
            print("Argument 'log' (-l) manquant")

        parser.print_help()
        exit(1)

    def progress_callback(progress, message):
        print(f"{progress}%:\t{message}")
        with open(args.log, "a") as f:
            print(f"{os.getpid()},{progress},\"{message}\",\"{args.output}\"", file=f)

    scans_df = pd.read_csv(args.input)
    if "ID 10 N" not in scans_df.columns:
        print("Il manque la colonne 'ID 10 N' dans le fichier fourni")
        exit(1)
    if "id" not in scans_df.columns:
        print("Il manque la colonne 'id' dans le fichier fourni")
        exit(1)

    if os.path.exists(args.log):
        os.remove(args.log)
    with open(args.log, "a+") as f:
        print(f"pid,%,message,filename", file=f)
    
    process_scans(scans_df, args.output, progress_callback)
    progress_callback(100, "Termine")
    save_s3(args.output)
