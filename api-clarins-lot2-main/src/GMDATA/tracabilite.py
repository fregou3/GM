import psycopg2
from datetime import datetime
from typing import Tuple, Any
import pandas as pd
from .db import conn_params
from DataModels.tracabilite import Tracabilite
from DataModels.localisation import Localisation

type_envoi = {"envoi_amiens": "Envoi Amiens", "envoi_filiale": "Envoi Filiale"}
world_df = pd.read_csv("src/GMDATA/world.csv")


def country_alpha2_to_name(alpha2: str) -> str:
    if alpha2 in world_df["alpha2"].unique():
        return world_df.loc[world_df.alpha2 == alpha2, ["eplibf"]].values[0][0]
    return None


def country_name_to_alpha2(name: str) -> str:
    if name in world_df["eplibf"].unique():
        return world_df.loc[world_df.eplibf == name, ["alpha2"]].values[0][0]
    if name in world_df["eplibe"].unique():
        return world_df.loc[world_df.eplibe == name, ["alpha2"]].values[0][0]

    return None


def row_to_tracabilite(row: Tuple[Any]) -> Tracabilite:
    tracabilite = Tracabilite(
        date=datetime.strptime(row[4], "%Y%m%d%H%M%S"),
        type=type_envoi[row[0]],
        emballage=row[3],
        code_parallele=row[1],
    )

    return tracabilite


def row_aclie_to_localisation(row: Tuple[Any]) -> Localisation:
    if row is None:
        return None

    return Localisation(
        adresse=f"{row[1]} {row[3]}{row[2]}",
        code_postal=row[4],
        ville=row[5],
        code_pays=row[6],
        pays=country_alpha2_to_name(row[6]),
        code_client=row[0],
        code_faci=row[7],
    )


def row_fclie_to_localisation(row: Tuple[Any]) -> Localisation:
    if row is None:
        return None

    return Localisation(
        adresse=f"{row[1]} {row[2]}",
        code_postal=row[3],
        ville=row[4],
        code_pays=country_name_to_alpha2(row[5]),
        pays=row[5],
        code_client=row[0],
        code_site=row[6],
    )


def get_tracabilite(code_para: str):
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    query = "select * from get_envois(%s);"
    cur.execute(query, (code_para,))
    rows = cur.fetchall()

    points_tracabilite = []
    for row_traca in rows:
        tracabilite = row_to_tracabilite(row_traca)
        if tracabilite.type == "Envoi Amiens":
            query = (
                "select trim(aclvcd), trim(aclnom), trim(aclad2), trim(aclad1), trim(aclpos), "
                "trim(aclvil), trim(accpay), trim(acfaci) "
                "from acliep00 where aclvcd=%s and acfaci=%s limit 1;"
            )
            cur.execute(query, (row_traca[5], row_traca[6]))
            row_loc = cur.fetchone()
            localisation = row_aclie_to_localisation(row_loc)
            tracabilite.localisation = localisation
        elif tracabilite.type == "Envoi Filiale":
            query = (
                "select trim(fccusf), trim(fcnomf), trim(fcadrf), trim(fccodf), "
                "trim(fcvilf), trim(fcpayf), trim(fcsite) "
                "from fcliep00 where fccusf=%s and fcsite=%s limit 1;"
            )
            cur.execute(query, (row_traca[5], row_traca[7]))
            row_loc = cur.fetchone()
            localisation = row_fclie_to_localisation(row_loc)
            tracabilite.localisation = localisation
        points_tracabilite.append(tracabilite)
    cur.close()
    conn.close()

    return points_tracabilite
