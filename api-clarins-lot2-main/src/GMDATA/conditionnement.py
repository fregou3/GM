import psycopg2
from datetime import datetime
from typing import Tuple, Any

from DataModels.conditionnement import Palette, Prepack, Unite
from .db import conn_params


def row_to_palette(row: Tuple[Any]) -> Palette:
    if row is None:
        return None
    palette = Palette(
        code_para=row[0],
        code_article=row[1],
        lot=row[2],
        date_creation=datetime.strptime(row[3], "%Y%m%d%H%M%S"),
    )
    return palette


def row_to_prepack(row: Tuple[Any]) -> Prepack:
    if row is None:
        return None

    palette = None
    if row[0] is not None:
        palette = Palette(
            code_para=row[0],
            code_article=row[1],
            lot=row[2],
            date_creation=datetime.strptime(row[3], "%Y%m%d%H%M%S"),
        )
    prepack = Prepack(
        code_para=row[4],
        code_article=row[5],
        lot=row[6],
        date_creation=datetime.strptime(row[7], "%Y%m%d%H%M%S"),
        palette=palette,
    )
    return prepack


def row_to_unite(row: Tuple[Any]) -> Unite:
    if row is None:
        return None

    palette = None
    if row[0] is not None:
        palette = Palette(
            code_para=row[0],
            code_article=row[1],
            lot=row[2],
            date_creation=datetime.strptime(row[3], "%Y%m%d%H%M%S"),
        )
    prepack = None
    if row[4] is not None:
        prepack = Prepack(
            code_para=row[4],
            code_article=row[5],
            lot=row[6],
            date_creation=datetime.strptime(row[7], "%Y%m%d%H%M%S"),
            palette=palette,
        )
    unite = Unite(code_para=row[7], prepack=prepack)
    return unite


def get_palette(code_para: str) -> Palette:
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    query = (
        "select trim(cppale), trim(cparti), trim(cpbano), trim(cpdate)"
        "from cpalep00 where cppale=%s limit 1;"
    )
    cur.execute(query, (code_para,))
    row = cur.fetchone()

    cur.close()
    conn.close()

    return row_to_palette(row)


def get_prepack(code_para: str) -> Prepack:
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    query = (
        "select trim(pa.cppale), trim(pa.cparti), trim(pa.cpbano), trim(pa.cpdate), "
        "trim(pk.cppara), trim(pk.cparti), trim(pk.cpbano), trim(pk.cpdate) "
        "from cparap00 as pk "
        "left join cpapkp00 as papk on (papk.cppara=pk.cppara) "
        "left join cpalep00 as pa on (papk.cppale=pa.cppale) "
        "where pk.cppara=%s limit 1;"
    )
    cur.execute(query, (code_para,))
    row = cur.fetchone()

    cur.close()
    conn.close()

    return row_to_prepack(row)


def get_unite(code_para: str) -> Prepack:
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    query = (
        "select trim(pa.cppale), trim(pa.cparti), trim(pa.cpbano), trim(pa.cpdate), "
        "trim(pk.cppara), trim(pk.cparti), trim(pk.cpbano), trim(pk.cpdate), "
        "trim(uni.cpunit) "
        "from cpkunp00 as uni "
        "left join cparap00 as pk on (pk.cppara=uni.cppara)"
        "left join cpapkp00 as papk on (papk.cppara=pk.cppara) "
        "left join cpalep00 as pa on (papk.cppale=pa.cppale) "
        "where uni.cpunit=%s limit 1;"
    )
    cur.execute(query, (code_para,))
    row = cur.fetchone()

    cur.close()
    conn.close()

    return row_to_unite(row)
