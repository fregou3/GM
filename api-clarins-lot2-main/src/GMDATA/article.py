import psycopg2
from typing import Tuple, Any

from DataModels.article import Article
from .db import conn_params


def row_to_article(row: Tuple[Any]) -> Article:
    if row is None:
        return None

    article = Article(
        code=row[0],
        designation=row[1],
        designation_en=row[2],
        quantite_pk=int(row[3]),
        quantite_pa=int(row[4]),
        actif=bool(row[5]),
    )
    return article


def get_article(code: str) -> Article:
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    query = (
        "select trim(maarti), trim(madesi), trim(maname), maqtpk, maqtpa, maacti "
        "from martip00 where maarti=%s limit 1;"
    )
    cur.execute(query, (code,))
    row = cur.fetchone()

    cur.close()
    conn.close()

    return row_to_article(row)
