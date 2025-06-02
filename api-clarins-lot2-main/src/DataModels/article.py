from pydantic import BaseModel


class Article(BaseModel):
    code: str
    designation: str
    designation_en: str
    quantite_pk: int
    quantite_pa: int
    actif: bool
