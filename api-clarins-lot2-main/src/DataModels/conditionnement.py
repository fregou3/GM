from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class Palette(BaseModel):
    code_para: str
    code_article: str
    lot: str
    date_creation: datetime


class Prepack(Palette):
    palette: Optional[Palette] = None


class Unite(BaseModel):
    code_para: str
    prepack: Optional[Prepack] = None
