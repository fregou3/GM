This project is designed to process and manage location data using AWS GeoCoding and MongoDB. The workflow involves feeding data into MongoDB using two scripts (aws_loc_aclie.py and aws_loc_fclie.py), and then exporting the processed data from MongoDB to a CSV file using the mongodb_to_csv.py script.

Use the following .env file:

```dotenv
MONGO_CLIENT=
MONGO_DB_NAME=
MONGO_COLLEC_NAME=
BOTO3_SESSION=
ANTHROPIC_API_KEY=
```
# 1. Feeding Data into MongoDB

`aws_loc_aclie.py`
This script processes location data from a CSV file (typically latest updates from table acliep00 in GMDATA) and inserts it into the MongoDB collection as intermediate storage. It uses AWS Location Service to enrich the data with geocoding information.

```bash
python aws_loc_aclie.py <input_csv_path>
```

Input:
A CSV file containing location data with the following columns:
aclvcd, aclnom, aclad2, aclad1, aclpos, aclvil, accpay, acfaci.

Output:
Enriched location data is inserted into the MongoDB collection.

`aws_loc_fclie.py`

Same as `aws_loc_aclie.py`, but for table fcliep00.

Input:

fccusf, fcnomf, fcadrf, fccodf, fcvilf, fcpayf, fcsite, pays, continent

# 2. Exporting Data from MongoDB to CSV

```bash
python mongodb_to_csv.py <output_csv_path>
```

Output:

addressnumber, country, municipality, postalcode, region, subregion, street, long, lat, relevance, raw_address, code, faci, site.

# 3. Workflow

1. Prepare the input CSV files for aws_loc_aclie.py and aws_loc_fclie.py.
2. Run the scripts to feed data into MongoDB :
python aws_loc_aclie.py <input_csv_path>
python aws_loc_fclie.py <input_csv_path>
3. Export the data from MongoDB to a CSV file:
python mongodb_to_csv.py <output_csv_path>
