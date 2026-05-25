import json
import sqlite3
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DATA_DIR / "spriteforge.db"


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS assets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              asset_name TEXT NOT NULL,
              asset_type TEXT NOT NULL,
              style TEXT NOT NULL,
              request_json TEXT NOT NULL,
              style_json TEXT NOT NULL,
              plan_json TEXT NOT NULL,
              png_path TEXT NOT NULL,
              sheet_path TEXT NOT NULL,
              metadata_path TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def create_asset_record(
    *,
    asset_name: str,
    asset_type: str,
    style: str,
    request: dict[str, Any],
    style_profile: dict[str, Any],
    plan: dict[str, Any],
    files: dict[str, str],
) -> int:
    with sqlite3.connect(DB_PATH) as connection:
        cursor = connection.execute(
            """
            INSERT INTO assets (
              asset_name, asset_type, style, request_json, style_json, plan_json,
              png_path, sheet_path, metadata_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset_name,
                asset_type,
                style,
                json.dumps(request, ensure_ascii=False),
                json.dumps(style_profile, ensure_ascii=False),
                json.dumps(plan, ensure_ascii=False),
                files["png"],
                files["sheet"],
                files["metadata"],
            ),
        )
        return int(cursor.lastrowid)


def get_asset_record(asset_id: int) -> dict[str, Any] | None:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
        return dict(row) if row else None


def list_asset_records(limit: int = 20) -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            "SELECT * FROM assets ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
