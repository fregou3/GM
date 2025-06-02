import time
import subprocess
import os
import signal

import streamlit as st
import pandas as pd
from io import BytesIO
from datetime import datetime
from streamlit_autorefresh import st_autorefresh

st.set_page_config(page_title="Traçabilité Scans", page_icon="📍")
st_autorefresh(interval=5000, limit=3000)

LOG_FILE = "logs.csv"


def error(err_message):
    st.error(err_message)
    st.stop()

def clean_input_output():
    for f in os.listdir(os.curdir):
        if (f.startswith("tracabilite-") or f.startswith("scan-")) and f.endswith(".csv"):
            os.remove(f)

def clean_log():
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

def run_background_task(input: str, output: str, logfile: str):
    process = subprocess.Popen(
        [
            "pdm",
            "run",
            "python",
            "tracabilite.py",
            "-i",
            input,
            "-o",
            output,
            "-l",
            logfile,
        ]
    )
    print("PROCESS PID: ", process.pid)

status = "NO_TASK"
if os.path.exists(LOG_FILE):
    status = "TASK_RUNNING"
    log_df = pd.read_csv(LOG_FILE)
    if log_df.shape[0] > 0:
        last_log = log_df.iloc[-1, :]
        if int(last_log["%"])>=100:
            status = "TASK_COMPLETED"
            st.success(f"Tâche complétée avec succès.\nFichier disponible : s3://ptc-phd-s3/qr-tracabilite/{last_log['filename']}")
            clean_input_output()
        else:
            progress_bar = st.progress(last_log["%"]/100, text=last_log["message"])
            if st.button("Stopper la tâche"):
                os.kill(int(last_log["pid"]), signal.SIGTERM)
                clean_log()
                clean_input_output()
                st.rerun()
    else:
        progress_bar = st.progress(0, text="Démarrage du script")


    
if status in ["TASK_COMPLETED", "NO_TASK"]:

    csv_file = st.file_uploader("Fichiers de scans (CSV)", type=["csv"])

    if csv_file is not None:
        scans_df = pd.read_csv(BytesIO(csv_file.read()))
        if "ID 10 N" not in scans_df.columns:
            error("Il manque la colonne 'ID 10 N' dans le fichier fourni")
        if "id" not in scans_df.columns:
            error("Il manque la colonne 'id' dans le fichier fourni")

        st.write(f"le fichier contient `{scans_df.shape[0]}` lignes")
        st.dataframe(scans_df)

        if st.button("Analyser la traçabilité"):
            time_str = datetime.now().strftime("%Y%d%m%H%M%S")
            output_csv = f"tracabilite-{time_str}.csv"
            intput_csv = f"scan-{time_str}.csv"
            scans_df.to_csv(intput_csv, index=False)
            st.write(f"Fichier de sortie: s3://ptc-phd-s3/qr-tracabilite/`{output_csv}`")
            clean_log()
            run_background_task(intput_csv, output_csv, LOG_FILE)