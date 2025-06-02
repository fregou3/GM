import os
from fastapi import FastAPI, HTTPException
from typing import List
from fastapi import Security, Depends
from fastapi.security.api_key import APIKeyHeader, APIKey
from dotenv import load_dotenv

from DataModels.article import Article
from DataModels.tracabilite import Tracabilite
from DataModels.conditionnement import Unite, Prepack, Palette
from GMDATA.article import get_article as gm_get_article
from GMDATA.conditionnement import get_palette as gm_get_palette
from GMDATA.conditionnement import get_prepack as gm_get_prepack
from GMDATA.conditionnement import get_unite as gm_get_unite
from GMDATA.tracabilite import get_tracabilite as gm_get_tracabilite

load_dotenv()

API_KEY = os.getenv("API_KEY")
API_KEY_NAME = "authorization"

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)
app = FastAPI(root_path=os.getenv("ROOT_PATH", ""))


async def get_api_key(
    api_key_header: str = Security(api_key_header),
):
    if api_key_header == API_KEY:
        return api_key_header
    else:
        raise HTTPException(status_code=403, detail="Token non valide")


@app.get("/article/{code}")
async def api_get_article(code: str, api_key: APIKey = Depends(get_api_key)) -> Article:
    article = gm_get_article(code)
    if article is None:
        raise HTTPException(status_code=404, detail="L'article n'as pas été retrouvé")

    return article


@app.get("/tracabilite/unite/{code_para}")
async def api_get_tracabilite(
    code_para, api_key: APIKey = Depends(get_api_key)
) -> List[Tracabilite]:
    tracabilite = gm_get_tracabilite(code_para)
    if len(tracabilite) == 0:
        raise HTTPException(
            status_code=404, detail="Pas de tracabilité pour cette unité."
        )

    return tracabilite


@app.get("/palette/{code_para}")
async def api_get_palette(
    code_para: str, api_key: APIKey = Depends(get_api_key)
) -> Palette:
    palette = gm_get_palette(code_para)
    if palette is None:
        raise HTTPException(status_code=404, detail="La palette n'as pas été retrouvée")
    return palette


@app.get("/prepack/{code_para}")
async def api_get_prepack(
    code_para: str, api_key: APIKey = Depends(get_api_key)
) -> Prepack:
    prepack = gm_get_prepack(code_para)
    if prepack is None:
        raise HTTPException(status_code=404, detail="Le prepack n'a pas été retrouvé")

    return prepack


@app.get("/unite/{code_para}")
async def api_get_unite(
    code_para: str, api_key: APIKey = Depends(get_api_key)
) -> Unite:
    unite = gm_get_unite(code_para)
    if unite is None:
        raise HTTPException(status_code=404, detail="L'unité n'a pas été retrouvée")

    return unite
