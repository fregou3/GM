import json
import os
import sys

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate
from tqdm import tqdm


def remove_idem_entries(json_dic):
    return {k: v for k, v in json_dic.items() if v != k}


def get_prompt(parser):
    example_input = [
        "Aragón",
        "Asturias",
        "Baleares",
        "Balearic Islands",
        "Islas Baleares",
        "Islas Canarias",
        "Catalunya",
        "Cataluña",
        "Канары сакъадæхтæ",
    ]
    example_output = {
        "Aragón": "Aragón",
        "Asturias": "Asturias",
        "Baleares": "Islas Baleares",
        "Balearic Islands": "Islas Baleares",
        "Islas Baleares": "Islas Baleares",
        "Islas Canarias": "Islas Canarias",
        "Catalunya": "Cataluña",
        "Cataluña": "Cataluña",
        "Канары сакъадæхтæ": "Islas Canarias",
    }

    examples = [
        {"example_input": str(example_input), "example_output": str(example_output)}
    ]

    example_prompt = ChatPromptTemplate.from_messages(
        [("human", "{example_input}"), ("ai", "{example_output}")]
    )

    few_shot_prompt = FewShotChatMessagePromptTemplate(
        example_prompt=example_prompt, examples=examples
    )

    messages = [
        (
            "human",
            """
            You are an assistant for data cleaning. You are given a list of regions or subregions in various format and language. 
            You are asked to build a dictionary that maps each region in the list to its standard name.
            The standard name itself must be part of the list whatever the format.
            The input is a list of string.
            {format_instructions}
            """,
        ),
        few_shot_prompt,
        ("human", "{input}"),
    ]

    prompt = ChatPromptTemplate.from_messages(messages).partial(
        format_instructions=parser.get_format_instructions()
    )

    return prompt


def get_data(csv_path):
    df = pd.read_csv(csv_path)
    df = df[
        (df["country"].notna()) & (df["region"].notna()) & (df["subregion"].notna())
    ]
    return df


def get_corrections(df, llm, countries):
    all_correction_dic = {}
    for country in countries:

        country_df = df[df["country"] == country].copy()

        if country_df.shape[0] == 0:
            continue

        correction_dic = {"region": {}, "subregion": {}}

        orig_regions = sorted(country_df.region.unique().tolist())
        correction_region = chain.invoke({"input": str(orig_regions)})
        correction_dic["region"] |= remove_idem_entries(correction_region)

        country_df.region = country_df.region.replace(correction_region)
        cleaned_regions = sorted(country_df.region.unique().tolist())

        for region in tqdm(
            cleaned_regions, total=len(cleaned_regions), desc=f"Processing {country}"
        ):
            region_df = country_df[country_df["region"] == region]
            orig_subregions = sorted(region_df.subregion.unique().tolist())
            correction_subregion = chain.invoke({"input": str(orig_subregions)})
            correction_dic["subregion"] |= remove_idem_entries(correction_subregion)

        all_correction_dic[country] = correction_dic

    return all_correction_dic


if len(sys.argv) < 3:
    print("Usage: python clean_regions.py <input_csv> <output_json>")
    sys.exit(1)

input_csv = sys.argv[1]
output_json = sys.argv[2]

load_dotenv()

claude_version = "claude-3-5-sonnet-20240620"
# claude_version = "claude-3-haiku-20240307"


llm = ChatAnthropic(
    model_name=claude_version,
    temperature=0,
)
parser = JsonOutputParser()
prompt = get_prompt(parser)
chain = prompt | llm | parser

df = get_data(input_csv)
countries = ["AUT"]

corrections = get_corrections(df, llm, countries)

with open(output_json, "w") as f:
    json.dump(corrections, f, indent=2)
