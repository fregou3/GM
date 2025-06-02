from pydantic import BaseModel
from typing import Optional


class Localisation(BaseModel):
    adresse: str
    code_postal: str
    ville: str
    pays: str
    code_pays: str
    code_client: str
    code_faci: Optional[str] = None
    code_site: Optional[str] = None
