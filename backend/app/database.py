import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
configured_database_path = os.getenv("DATABASE_PATH")
if configured_database_path:
    _database_path = Path(configured_database_path).expanduser()
    DATABASE_PATH = (
        _database_path
        if _database_path.is_absolute()
        else BACKEND_DIR / _database_path
    )
else:
    DATABASE_PATH = DATA_DIR / "cropproof.db"
STORIES_PATH = DATA_DIR / "seed_stories.json"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS incident_cases (
    id TEXT PRIMARY KEY,
    farmer_alias TEXT,
    crop TEXT,
    calamity_type TEXT,
    incident_date TEXT,
    village TEXT,
    district TEXT,
    state TEXT,
    affected_area_acres REAL,
    insurance_status TEXT,
    confirmation_status TEXT,
    crop_stage TEXT,
    is_confirmed INTEGER NOT NULL DEFAULT 0,
    current_step INTEGER NOT NULL DEFAULT 1,
    manual_status TEXT,
    acknowledgement_ref TEXT,
    gps_lat REAL,
    gps_lon REAL,
    gps_accuracy_m REAL,
    weather_summary TEXT,
    rainfall_mm_72h REAL,
    rainfall_source TEXT,
    weather_observed_at TEXT,
    dossier_id TEXT,
    dossier_generated_at TEXT,
    dossier_sha256 TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_files (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    category TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT,
    farmer_caption TEXT,
    FOREIGN KEY (case_id) REFERENCES incident_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS farmer_stories (
    id TEXT PRIMARY KEY,
    farmer_name TEXT NOT NULL,
    location_state TEXT NOT NULL,
    publisher TEXT NOT NULL,
    source_url TEXT NOT NULL,
    trust_label TEXT NOT NULL,
    calamity_tags TEXT NOT NULL,
    crop_tags TEXT NOT NULL,
    scheme_tag TEXT NOT NULL,
    known_facts TEXT NOT NULL,
    unknown_facts TEXT NOT NULL,
    takeaway TEXT NOT NULL,
    premium_paid_display TEXT,
    payout_received_display TEXT,
    pib_release_note TEXT,
    video_reference_title TEXT,
    video_reference_url TEXT
);
"""


def initialize_database(db_path: str | Path = DATABASE_PATH) -> None:
    database_path = Path(db_path)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database_path)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(_SCHEMA)
        existing_case_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(incident_cases)")
        }
        case_columns = {
            "crop_stage": "TEXT",
            "is_confirmed": "INTEGER NOT NULL DEFAULT 0",
            "current_step": "INTEGER NOT NULL DEFAULT 1",
            "manual_status": "TEXT",
            "acknowledgement_ref": "TEXT",
            "gps_lat": "REAL",
            "gps_lon": "REAL",
            "gps_accuracy_m": "REAL",
            "weather_summary": "TEXT",
            "rainfall_mm_72h": "REAL",
            "rainfall_source": "TEXT",
            "weather_observed_at": "TEXT",
            "dossier_id": "TEXT",
            "dossier_generated_at": "TEXT",
            "dossier_sha256": "TEXT",
        }
        for column, definition in case_columns.items():
            if column not in existing_case_columns:
                connection.execute(
                    f"ALTER TABLE incident_cases ADD COLUMN {column} {definition}"
                )
        existing_story_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(farmer_stories)")
        }
        story_columns = {
            "premium_paid_display": "TEXT",
            "payout_received_display": "TEXT",
            "pib_release_note": "TEXT",
            "video_reference_title": "TEXT",
            "video_reference_url": "TEXT",
        }
        for column, definition in story_columns.items():
            if column not in existing_story_columns:
                connection.execute(
                    f"ALTER TABLE farmer_stories ADD COLUMN {column} {definition}"
                )
        with STORIES_PATH.open(encoding="utf-8") as stories_file:
            stories = json.load(stories_file)
        connection.executemany(
            """
            INSERT INTO farmer_stories (
                id, farmer_name, location_state, publisher, source_url,
                trust_label, calamity_tags, crop_tags, scheme_tag,
                known_facts, unknown_facts, takeaway, premium_paid_display,
                payout_received_display, pib_release_note, video_reference_title,
                video_reference_url
            ) VALUES (
                :id, :farmer_name, :location_state, :publisher, :source_url,
                :trust_label, :calamity_tags, :crop_tags, :scheme_tag,
                :known_facts, :unknown_facts, :takeaway, :premium_paid_display,
                :payout_received_display, :pib_release_note, :video_reference_title,
                :video_reference_url
            )
            ON CONFLICT(id) DO UPDATE SET
                farmer_name = excluded.farmer_name,
                location_state = excluded.location_state,
                publisher = excluded.publisher,
                source_url = excluded.source_url,
                trust_label = excluded.trust_label,
                calamity_tags = excluded.calamity_tags,
                crop_tags = excluded.crop_tags,
                scheme_tag = excluded.scheme_tag,
                known_facts = excluded.known_facts,
                unknown_facts = excluded.unknown_facts,
                takeaway = excluded.takeaway,
                premium_paid_display = excluded.premium_paid_display,
                payout_received_display = excluded.payout_received_display,
                pib_release_note = excluded.pib_release_note,
                video_reference_title = excluded.video_reference_title,
                video_reference_url = excluded.video_reference_url
            """,
            [
                {
                    **story,
                    "premium_paid_display": story.get("premium_paid_display"),
                    "payout_received_display": story.get("payout_received_display"),
                    "pib_release_note": story.get("pib_release_note"),
                    "video_reference_title": story.get("video_reference_title"),
                    "video_reference_url": story.get("video_reference_url"),
                    "calamity_tags": json.dumps(story["calamity_tags"]),
                    "crop_tags": json.dumps(story["crop_tags"]),
                    "known_facts": json.dumps(story["known_facts"]),
                    "unknown_facts": json.dumps(story["unknown_facts"]),
                }
                for story in stories
            ],
        )
        connection.commit()


def init_db(db_path: str | Path = DATABASE_PATH) -> None:
    initialize_database(db_path)


def get_connection(db_path: str | Path = DATABASE_PATH) -> sqlite3.Connection:
    initialize_database(db_path)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


initialize_database()
