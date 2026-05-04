# scripts/load_oulad.py
import pandas as pd
from sqlalchemy import create_engine
import os, sys

DB_URL = os.environ.get("DB_URL", "mysql+pymysql://root@localhost:3306/oulad")
engine = create_engine(DB_URL)
csv_dir = "./data/oulad"

CHUNK_THRESHOLD = 500_000

files = ["courses.csv","assessments.csv","vle.csv","studentInfo.csv","studentRegistration.csv","studentAssessment.csv","studentVle.csv"]
for f in files:
    path = os.path.join(csv_dir, f)
    if not os.path.exists(path):
        print("Missing:", path); continue
    table = f.replace(".csv","")
    row_count = sum(1 for _ in open(path)) - 1
    print(f"Loading {f} ({row_count:,} rows) -> {table}")

    if row_count > CHUNK_THRESHOLD:
        chunks = pd.read_csv(path, chunksize=100_000)
        for i, chunk in enumerate(chunks):
            chunk.to_sql(table, engine, if_exists="append" if i > 0 else "replace", index=False)
            print(f"  chunk {i+1}: {(i+1)*100_000:,} rows")
    else:
        df = pd.read_csv(path)
        df.to_sql(table, engine, if_exists="replace", index=False)

    print(f"  Done: {table}")
print("All tables loaded.")
