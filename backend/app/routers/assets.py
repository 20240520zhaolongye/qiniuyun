from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.database import create_asset_record, get_asset_record, list_asset_records
from app.schemas import GeneratePayload, GenerateResponse
from app.services.cpp_engine import CppEngineError, create_plan
from app.services.exporter import EXPORT_DIR, write_metadata
from app.services.mock_generator import save_outputs

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/plan")
def plan_asset(payload: GeneratePayload) -> dict:
    try:
        return create_plan(payload.model_dump())
    except CppEngineError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/generate", response_model=GenerateResponse)
def generate_asset(payload: GeneratePayload) -> GenerateResponse:
    try:
        plan = create_plan(payload.model_dump())
    except CppEngineError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    metadata = plan["metadata"]
    output_dir = EXPORT_DIR / metadata["assetName"]
    generated_files = save_outputs(plan, output_dir)
    metadata_path = write_metadata(plan, output_dir)
    stored_files = {
        "png": generated_files["png"],
        "sheet": generated_files["sheet"],
        "metadata": metadata_path,
    }
    asset_id = create_asset_record(
        asset_name=metadata["assetName"],
        asset_type=metadata["assetType"],
        style=metadata["style"],
        request=payload.request.model_dump(),
        style_profile=payload.styleProfile.model_dump(),
        plan=plan,
        files=stored_files,
    )
    public_files = {
        "png": f"/api/assets/{asset_id}/download/png",
        "sheet": f"/api/assets/{asset_id}/download/sheet",
        "metadata": f"/api/assets/{asset_id}/download/json",
    }
    return GenerateResponse(id=asset_id, plan=plan, files=public_files)


@router.get("")
def list_assets() -> list[dict]:
    return list_asset_records()


@router.get("/{asset_id}")
def get_asset(asset_id: int) -> dict:
    record = get_asset_record(asset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Asset not found")
    return record


@router.get("/{asset_id}/download/{kind}")
def download_asset(asset_id: int, kind: str) -> FileResponse:
    record = get_asset_record(asset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Asset not found")
    path_by_kind = {
        "png": record["png_path"],
        "sheet": record["sheet_path"],
        "json": record["metadata_path"],
    }
    if kind not in path_by_kind:
        raise HTTPException(status_code=404, detail="Unknown download kind")
    path = Path(path_by_kind[kind])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name)
