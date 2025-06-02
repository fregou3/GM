from typing import Literal, Optional
from pydantic import BaseModel
from datetime import datetime

from .localisation import Localisation


class Tracabilite(BaseModel):
    date: datetime
    localisation: Optional[Localisation] = None
    type: Literal["Envoi Amiens", "Envoi Filiale"]
    emballage: Literal["UNI", "PK", "PA"]
    code_parallele: str
