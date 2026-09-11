#!/usr/bin/env python3
"""
DB Setup Script: Creates 'talentx' database and runs migrations.
Run this after pgvector is installed.
Usage: python3 db/setup_db.py
"""
import subprocess
import sys
import os

DB_NAME = "talentx"
MIGRATION_FILE = os.path.join(os.path.dirname(__file__), "migrations", "001_initial_schema.sql")

def run(cmd, check=True, capture=False):
    result = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if check and result.returncode != 0:
        print(f"ERROR: {cmd}\n{result.stderr}")
        sys.exit(1)
    return result

def main():
    print("=== TalentX DB Setup ===")

    # Create database if it doesn't exist
    res = run(f'psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname=\'{DB_NAME}\'"', capture=True, check=False)
    if "1" not in res.stdout:
        print(f"Creating database '{DB_NAME}'...")
        run(f"createdb {DB_NAME}")
    else:
        print(f"Database '{DB_NAME}' already exists.")

    # Run migration
    print(f"Running migration: {MIGRATION_FILE}")
    run(f'psql {DB_NAME} -f "{MIGRATION_FILE}"')
    print("Migration applied successfully!")

    # Verify tables
    result = run(f"psql {DB_NAME} -c \"\\dt\"", capture=True)
    print("\nTables created:")
    print(result.stdout)
    print("=== DB Setup Complete! ===")

if __name__ == "__main__":
    main()
