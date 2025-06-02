FROM python:3.12-alpine

WORKDIR /app

COPY pdm.lock ./
COPY pyproject.toml ./

RUN pip install --upgrade pip && \
    pip install pdm

RUN pdm install

ADD src ./src
COPY .env ./

EXPOSE 80

ENTRYPOINT [ "pdm", "run", "start_prod" ]