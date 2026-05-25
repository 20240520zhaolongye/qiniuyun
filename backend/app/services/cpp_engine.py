import json
import subprocess
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[3]
CLI_PATH = ROOT_DIR / "build" / "spriteforge_cli.exe"


class CppEngineError(RuntimeError):
    pass


def create_plan(payload: dict[str, Any]) -> dict[str, Any]:
    if not CLI_PATH.exists():
        raise CppEngineError(f"C++ CLI not found: {CLI_PATH}")

    process = subprocess.run(
        [str(CLI_PATH)],
        input=json.dumps(payload, ensure_ascii=True),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )

    if process.returncode != 0:
        detail = process.stderr.strip() or process.stdout.strip() or "C++ CLI failed"
        raise CppEngineError(detail)

    try:
        return json.loads(process.stdout)
    except json.JSONDecodeError as exc:
        raise CppEngineError(f"Invalid C++ JSON output: {exc}") from exc
