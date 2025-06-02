import os
from dotenv import load_dotenv

load_dotenv()

conn_params = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PWD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}
