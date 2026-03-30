# scripts/load_oulad.py
import pandas as pd
from sqlalchemy import create_engine
import os, sys

DB_URL = "mysql+pymysql://root:rootpass@localhost:3306/oulad"
engine = create_engine(DB_URL)
csv_dir = "./data/oulad"

files = ["courses.csv","assessments.csv","vle.csv","studentInfo.csv","studentRegistration.csv","studentAssessment.csv","studentVle.csv"]
for f in files:
    path = os.path.join(csv_dir, f)
    if not os.path.exists(path):
        print("Missing:", path); continue
    print("Loading", f)
    df = pd.read_csv(path)
    df.to_sql(f.replace(".csv",""), engine, if_exists="replace", index=False)
print("Done")