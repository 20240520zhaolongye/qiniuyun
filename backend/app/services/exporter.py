import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[3]
EXPORT_DIR = ROOT_DIR / "backend" / "exports"


def write_metadata(plan: dict[str, Any], output_dir: Path) -> str:
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_name = plan["metadata"]["assetName"]
    metadata_path = output_dir / f"{asset_name}.json"
    export_text = plan.get("exportJson")
    if isinstance(export_text, str):
        parsed = json.loads(export_text)
    else:
        parsed = plan.get("export", plan.get("metadata", {}))
    metadata_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(metadata_path)
