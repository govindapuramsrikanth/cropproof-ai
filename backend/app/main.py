import json
import logging
import math
import os
import sqlite3
import tempfile
from contextlib import asynccontextmanager, closing
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import urllib.parse
import urllib.request
from uuid import uuid4

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from .ai_service import (
    AudioTranscriptionError,
    AudioTranscriptionUnavailable,
    extract_incident_info,
    transcribe_audio,
)
from .database import BACKEND_DIR, get_connection, init_db
from .pdf_generator import create_dossier_integrity, generate_evidence_pdf
from .policy_service import get_guidance_for_case
from .rules_engine import evaluate_case, is_within_72h_window


UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MAX_AUDIO_UPLOAD_BYTES = 20 * 1024 * 1024
logger = logging.getLogger(__name__)

TELANGANA_DISTRICT_COORDINATES = {
    "Nalgonda": (17.0575, 79.2684),
    "Warangal": (17.9689, 79.5941),
    "Khammam": (17.2473, 80.1514),
    "Karimnagar": (18.4386, 79.1288),
    "Nizamabad": (18.6725, 78.0941),
    "Hyderabad": (17.3850, 78.4867),
}
DEFAULT_FIELD_COORDINATES = (16.8732, 79.5631)
INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))
_RAINFALL_FALLBACK_CACHE: dict[tuple[float, float, str], float] = {}

_WEATHER_CODE_DESCRIPTIONS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def _allowed_origins() -> list[str]:
    local_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    configured_origins = [
        origin.strip().rstrip("/")
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if "*" in configured_origins:
        return ["*"]
    return list(dict.fromkeys([*local_origins, *configured_origins]))


app = FastAPI(title="CropProof AI API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


class CreateCaseRequest(BaseModel):
    language: str = "te"
    demo: bool = False


class ExtractRequest(BaseModel):
    transcript: str
    language: str = "te"


class ConfirmCaseRequest(BaseModel):
    farmer_alias: str | None = None
    crop: str | None = None
    calamity_type: str | None = None
    incident_date: str | None = None
    village: str | None = None
    district: str | None = None
    state: str | None = None
    affected_area_acres: float | None = None
    insurance_status: str | None = None
    crop_stage: str | None = None


class CaseStatusRequest(BaseModel):
    manual_status: str | None = None
    acknowledgement_ref: str | None = None


class LiveProofRequest(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    lon: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    accuracy_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)


def _case_row(connection: sqlite3.Connection, case_id: str) -> dict:
    row = connection.execute(
        "SELECT * FROM incident_cases WHERE id = ?", (case_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return dict(row)


def _evidence_rows(connection: sqlite3.Connection, case_id: str) -> list[dict]:
    rows = connection.execute(
        """
        SELECT id, case_id, category, file_name, file_path, uploaded_at, farmer_caption
        FROM evidence_files
        WHERE case_id = ?
        ORDER BY uploaded_at, id
        """,
        (case_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def _case_with_evidence(connection: sqlite3.Connection, case_id: str) -> dict:
    case = _case_row(connection, case_id)
    case["evidence"] = _evidence_rows(connection, case_id)
    return case


def _get_or_create_dossier_integrity(
    connection: sqlite3.Connection,
    case: dict,
) -> dict:
    dossier_id = case.get("dossier_id")
    generated_at = case.get("dossier_generated_at")
    stored_hash = case.get("dossier_sha256")
    if dossier_id and generated_at and stored_hash:
        existing = create_dossier_integrity(
            case,
            dossier_id=dossier_id,
            generated_at=generated_at,
        )
        if existing["sha256_hash"] == stored_hash:
            return existing

    metadata = create_dossier_integrity(case)
    connection.execute(
        """
        UPDATE incident_cases
        SET dossier_id = ?, dossier_generated_at = ?, dossier_sha256 = ?
        WHERE id = ?
        """,
        (
            metadata["dossier_id"],
            metadata["generated_at"],
            metadata["sha256_hash"],
            case["id"],
        ),
    )
    connection.commit()
    return metadata


def _decode_story(row: sqlite3.Row | dict) -> dict:
    story = dict(row)
    for field in ("calamity_tags", "crop_tags", "known_facts", "unknown_facts"):
        story[field] = json.loads(story[field])
    return story


def _safe_case_upload_dir(case_id: str) -> Path:
    root = UPLOADS_DIR.resolve()
    case_dir = (UPLOADS_DIR / case_id).resolve()
    if not case_dir.is_relative_to(root):
        raise HTTPException(status_code=400, detail="Invalid case identifier")
    return case_dir


def _local_timestamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _yesterday_in_india_iso() -> str:
    return (datetime.now(INDIA_TIMEZONE).date() - timedelta(days=1)).isoformat()


def _observation_timestamp(current_time: object, utc_offset_seconds: object) -> str:
    if current_time:
        try:
            observed_at = datetime.fromisoformat(str(current_time).replace("Z", "+00:00"))
            if observed_at.tzinfo is None:
                offset = int(utc_offset_seconds or 0)
                observed_at = observed_at.replace(
                    tzinfo=timezone(timedelta(seconds=offset))
                )
            return observed_at.isoformat(timespec="seconds")
        except (OverflowError, TypeError, ValueError):
            logger.warning("Open-Meteo returned an invalid observation timestamp")
    return _local_timestamp()


def _fetch_weather(lat: float, lon: float) -> tuple[float | None, str, str]:
    parameters = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,precipitation,weather_code",
        "daily": "precipitation_sum",
        "past_days": 3,
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }
    url = f"https://api.open-meteo.com/v1/forecast?{urllib.parse.urlencode(parameters)}"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            payload = json.load(response)
        current = payload["current"]
        daily = payload["daily"]
        daily_times = daily.get("time", [])
        daily_precipitation = daily.get("precipitation_sum", [])
        current_date = str(current.get("time", "")).split("T", 1)[0]
        past_readings = [
            precipitation
            for day, precipitation in zip(daily_times, daily_precipitation)
            if current_date and day < current_date
        ][-3:]
        if not current_date:
            past_readings = daily_precipitation[:3]
        numeric_readings = [
            float(value)
            for value in past_readings
            if value is not None and math.isfinite(float(value))
        ]
        rainfall_mm_72h = sum(numeric_readings) if numeric_readings else None

        weather_code = current.get("weather_code")
        description = _WEATHER_CODE_DESCRIPTIONS.get(
            weather_code, f"Weather code {weather_code}"
        )
        temperature = current.get("temperature_2m")
        precipitation = current.get("precipitation")
        summary = (
            f"Open-Meteo Live: {description}; "
            f"current temperature {_format_weather_value(temperature, '°C')}; "
            f"current precipitation {_format_weather_value(precipitation, 'mm')}."
        )
        observed_at = _observation_timestamp(
            current.get("time"), payload.get("utc_offset_seconds")
        )
        return rainfall_mm_72h, summary, observed_at
    except (OSError, TypeError, ValueError, KeyError) as error:
        logger.warning("Open-Meteo telemetry unavailable: %s", error)
        return (
            None,
            "Open-Meteo live weather unavailable; offline fallback used.",
            _local_timestamp(),
        )


def _fallback_rainfall_estimate(
    latitude: float,
    longitude: float,
    queried_date: date,
) -> float:
    cache_key = (round(latitude, 4), round(longitude, 4), queried_date.isoformat())
    cached_value = _RAINFALL_FALLBACK_CACHE.get(cache_key)
    if cached_value is not None:
        return cached_value

    seed = (
        round(abs(latitude) * 1000) * 31
        + round(abs(longitude) * 1000) * 17
        + queried_date.toordinal() * 13
    )
    estimate = round(5.0 + (seed % 200) / 10, 1)
    _RAINFALL_FALLBACK_CACHE[cache_key] = estimate
    return estimate


def _fetch_incident_rainfall(
    latitude: float,
    longitude: float,
    queried_date: date,
) -> tuple[float, str, str]:
    today = datetime.now(INDIA_TIMEZONE).date()
    is_recent_or_forecast = today - timedelta(days=3) <= queried_date <= today + timedelta(days=7)
    endpoint = (
        "https://api.open-meteo.com/v1/forecast"
        if is_recent_or_forecast
        else "https://archive-api.open-meteo.com/v1/archive"
    )
    parameters = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "precipitation_sum",
        "timezone": "Asia/Kolkata",
    }
    if is_recent_or_forecast:
        parameters.update({"past_days": 3, "forecast_days": 7})
    else:
        parameters.update(
            {
                "start_date": queried_date.isoformat(),
                "end_date": queried_date.isoformat(),
            }
        )
    url = f"{endpoint}?{urllib.parse.urlencode(parameters)}"

    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            payload = json.load(response)
        daily = payload["daily"]
        days = daily["time"]
        precipitation_values = daily["precipitation_sum"]
        precipitation = next(
            (
                value
                for day, value in zip(days, precipitation_values)
                if day == queried_date.isoformat()
            ),
            None,
        )
        if precipitation is None:
            raise ValueError("Open-Meteo did not return precipitation for the requested date")
        rainfall = float(precipitation)
        if not math.isfinite(rainfall) or rainfall < 0:
            raise ValueError("Open-Meteo returned an invalid precipitation value")
        return (
            round(rainfall, 1),
            "open-meteo",
            "Daily precipitation_sum returned by Open-Meteo.",
        )
    except (OSError, TimeoutError, ValueError, TypeError, KeyError, OverflowError) as error:
        logger.warning("Open-Meteo incident rainfall unavailable: %s", error)
        estimate = _fallback_rainfall_estimate(latitude, longitude, queried_date)
        return (
            estimate,
            "fallback_cache",
            "Offline deterministic estimate; not verified by Open-Meteo.",
        )


def _format_weather_value(value: object, unit: str) -> str:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return f"{value:g} {unit}"
    return f"unavailable {unit}"


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "date": "2026-11-22"}


@app.get("/api/weather/verify")
def verify_incident_rainfall(
    latitude: float = Query(..., ge=-90, le=90, allow_inf_nan=False),
    longitude: float = Query(..., ge=-180, le=180, allow_inf_nan=False),
    incident_date: date | None = Query(default=None),
) -> dict:
    queried_date = incident_date or datetime.now(INDIA_TIMEZONE).date()
    rainfall_mm, source, note = _fetch_incident_rainfall(
        latitude,
        longitude,
        queried_date,
    )
    return {
        "precipitation_mm": rainfall_mm,
        "precipitation_sum": rainfall_mm,
        "latitude": latitude,
        "longitude": longitude,
        "queried_date": queried_date.isoformat(),
        "source": source,
        "within_72h_window": is_within_72h_window(queried_date),
        "note": note,
    }


@app.get("/api/stories")
def list_stories() -> list[dict]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM farmer_stories ORDER BY id"
        ).fetchall()
        return [_decode_story(row) for row in rows]


@app.post("/api/cases")
def create_case(request: CreateCaseRequest | None = None) -> dict:
    request = request or CreateCaseRequest()
    case_id = str(uuid4())
    values = {
        "id": case_id,
        "farmer_alias": None,
        "crop": None,
        "calamity_type": None,
        "incident_date": None,
        "village": None,
        "district": None,
        "state": None,
        "affected_area_acres": None,
        "insurance_status": None,
        "confirmation_status": None,
        "crop_stage": None,
        "is_confirmed": 0,
        "current_step": 1,
        "manual_status": None,
        "acknowledgement_ref": None,
        "rainfall_source": None,
    }
    if request.demo:
        values.update(
            {
                "farmer_alias": "Ramesh Reddy (Demo)",
                "crop": "Paddy",
                "calamity_type": "flood_inundation",
                "incident_date": _yesterday_in_india_iso(),
                "village": "Miryalaguda",
                "district": "Nalgonda",
                "state": "Telangana",
                "affected_area_acres": 2.5,
                "insurance_status": "enrolled_loanee",
                "confirmation_status": "Farmer confirmed",
                "crop_stage": "Flowering / Grain Filling",
                "is_confirmed": 1,
                "current_step": 3,
                "gps_lat": 16.8732,
                "gps_lon": 79.5631,
                "gps_accuracy_m": 12.0,
                "rainfall_mm_72h": 74.2,
                "rainfall_source": "demo_seed",
                "weather_summary": "Heavy Rain / Inundation Telemetry (Open-Meteo Live)",
                "weather_observed_at": "2026-11-22T12:15:00+05:30",
            }
        )
    columns = tuple(values)
    placeholders = ", ".join("?" for _ in columns)
    with closing(get_connection()) as connection:
        connection.execute(
            f"INSERT INTO incident_cases ({', '.join(columns)}) "
            f"VALUES ({placeholders})",
            tuple(values[column] for column in columns),
        )
        connection.commit()
        return _case_with_evidence(connection, case_id)


@app.post("/api/cases/{case_id}/live-proof")
def capture_live_proof(
    case_id: str, request: LiveProofRequest | None = None
) -> dict:
    with closing(get_connection()) as connection:
        case = _case_row(connection, case_id)
        if request and request.lat is not None and request.lon is not None:
            lat, lon = request.lat, request.lon
            accuracy_m = request.accuracy_m
        else:
            district = str(case.get("district") or "").strip().casefold()
            coordinates = next(
                (
                    value
                    for name, value in TELANGANA_DISTRICT_COORDINATES.items()
                    if name.casefold() == district
                ),
                DEFAULT_FIELD_COORDINATES,
            )
            lat, lon = coordinates
            accuracy_m = None

    rainfall_mm_72h, weather_summary, observed_at = _fetch_weather(lat, lon)
    rainfall_source = (
        "open-meteo"
        if rainfall_mm_72h is not None
        and "open-meteo" in weather_summary.casefold()
        else "fallback_cache"
    )
    with closing(get_connection()) as connection:
        _case_row(connection, case_id)
        connection.execute(
            """
            UPDATE incident_cases
            SET gps_lat = ?, gps_lon = ?, gps_accuracy_m = ?,
                rainfall_mm_72h = ?, rainfall_source = ?, weather_summary = ?,
                weather_observed_at = ?
            WHERE id = ?
            """,
            (
                lat,
                lon,
                accuracy_m,
                rainfall_mm_72h,
                rainfall_source,
                weather_summary,
                observed_at,
                case_id,
            ),
        )
        connection.commit()
        return _case_with_evidence(connection, case_id)


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict:
    with closing(get_connection()) as connection:
        return _case_with_evidence(connection, case_id)


@app.post("/api/cases/{case_id}/extract")
def extract_case(case_id: str, request: ExtractRequest) -> dict:
    with closing(get_connection()) as connection:
        current_case = _case_row(connection, case_id)
        extraction = extract_incident_info(
            request.transcript, current_case, request.language
        )
        draft_fields = (
            "farmer_alias",
            "crop",
            "calamity_type",
            "incident_date",
            "village",
            "district",
            "state",
            "affected_area_acres",
            "insurance_status",
            "crop_stage",
        )
        connection.execute(
            """
            UPDATE incident_cases
            SET crop = ?, calamity_type = ?, incident_date = ?, village = ?,
                district = ?, state = ?, affected_area_acres = ?,
                insurance_status = ?, crop_stage = ?, farmer_alias = ?
            WHERE id = ?
            """,
            (
                *(extraction.get(field) for field in draft_fields[1:]),
                extraction.get(draft_fields[0]),
                case_id,
            ),
        )
        connection.commit()
        updated_case = _case_row(connection, case_id)
        return {
            **updated_case,
            "next_question_en": extraction.get("next_question_en"),
            "next_question_te": extraction.get("next_question_te"),
            "ai_mode": extraction.get("ai_mode"),
            "mandal": extraction.get("mandal"),
            "farmer_name": extraction.get("farmer_name"),
            "summary": extraction.get("summary"),
            "hours_elapsed": extraction.get("hours_elapsed"),
            "hours_remaining": extraction.get("hours_remaining"),
            "within_72h_window": extraction.get("within_72h_window"),
        }


@app.post("/api/claims/intake")
def parse_claim_intake(request: ExtractRequest) -> dict:
    extraction = extract_incident_info(request.transcript, {}, request.language)
    return {
        "crop_type": extraction.get("crop"),
        "calamity_type": extraction.get("calamity_type"),
        "loss_date": extraction.get("incident_date"),
        "affected_area_acres": extraction.get("affected_area_acres"),
        "village": extraction.get("village"),
        "mandal": extraction.get("mandal"),
        "district": extraction.get("district"),
        "farmer_name": extraction.get("farmer_name"),
        "summary": extraction.get("summary"),
        "hours_elapsed": extraction.get("hours_elapsed"),
        "hours_remaining": extraction.get("hours_remaining"),
        "within_72h_window": extraction.get("within_72h_window"),
        "ai_mode": extraction.get("ai_mode"),
    }


@app.post("/api/claims/transcribe")
def transcribe_claim_audio(
    file: UploadFile = File(...),
    language: str = Form("te-IN"),
) -> dict:
    if language not in {"te-IN", "en-IN"}:
        raise HTTPException(
            status_code=422, detail="language must be te-IN or en-IN"
        )

    try:
        audio_bytes = file.file.read(MAX_AUDIO_UPLOAD_BYTES + 1)
    finally:
        file.file.close()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="The audio recording is empty")
    if len(audio_bytes) > MAX_AUDIO_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail="Audio recording exceeds the 20 MB limit"
        )
    mime_type = file.content_type or "audio/webm"
    if not mime_type.lower().startswith("audio/"):
        raise HTTPException(
            status_code=415, detail="Upload an audio recording such as audio/webm"
        )

    try:
        transcript = transcribe_audio(audio_bytes, mime_type, language)
    except AudioTranscriptionUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AudioTranscriptionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "transcript": transcript,
        "language": language,
        "source": "gemini_live",
    }


@app.patch("/api/cases/{case_id}/confirm")
def confirm_case(case_id: str, request: ConfirmCaseRequest) -> dict:
    values = request.model_dump(exclude_unset=True)
    with closing(get_connection()) as connection:
        _case_row(connection, case_id)
        if values:
            assignments = ", ".join(f"{field} = ?" for field in values)
            connection.execute(
                f"UPDATE incident_cases SET {assignments} WHERE id = ?",
                (*values.values(), case_id),
            )
        connection.execute(
            """
            UPDATE incident_cases
            SET is_confirmed = 1, confirmation_status = ?, current_step = 3
            WHERE id = ?
            """,
            ("Farmer confirmed", case_id),
        )
        connection.commit()
        return _case_with_evidence(connection, case_id)


@app.patch("/api/cases/{case_id}/status")
def update_case_status(case_id: str, request: CaseStatusRequest) -> dict:
    values = request.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(
            status_code=400, detail="Provide manual_status or acknowledgement_ref"
        )
    with closing(get_connection()) as connection:
        _case_row(connection, case_id)
        assignments = ", ".join(f"{field} = ?" for field in values)
        connection.execute(
            f"UPDATE incident_cases SET {assignments} WHERE id = ?",
            (*values.values(), case_id),
        )
        connection.commit()
        return _case_with_evidence(connection, case_id)


@app.get("/api/cases/{case_id}/guidance")
def get_guidance(case_id: str) -> dict:
    with closing(get_connection()) as connection:
        case = _case_row(connection, case_id)
        evidence = _evidence_rows(connection, case_id)
        rows = connection.execute("SELECT * FROM farmer_stories").fetchall()
        stories = [_decode_story(row) for row in rows]
        return get_guidance_for_case(case, evidence, stories)


@app.post("/api/cases/{case_id}/evidence")
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    category: str = Form(...),
    user_caption: str = Form(""),
) -> dict:
    with closing(get_connection()) as connection:
        _case_row(connection, case_id)
        case_dir = _safe_case_upload_dir(case_id)
        case_dir.mkdir(parents=True, exist_ok=True)
        original_name = Path(file.filename or "upload").name
        suffix = Path(original_name).suffix[:20]
        evidence_id = str(uuid4())
        stored_path = case_dir / f"{evidence_id}{suffix}"
        try:
            with stored_path.open("xb") as destination:
                while chunk := await file.read(1024 * 1024):
                    destination.write(chunk)
            uploaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            connection.execute(
                """
                INSERT INTO evidence_files (
                    id, case_id, category, file_name, file_path, uploaded_at,
                    farmer_caption
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    evidence_id,
                    case_id,
                    category,
                    original_name,
                    str(stored_path),
                    uploaded_at,
                    user_caption,
                ),
            )
            connection.commit()
        except Exception:
            stored_path.unlink(missing_ok=True)
            raise
        finally:
            await file.close()
        row = connection.execute(
            "SELECT * FROM evidence_files WHERE id = ?", (evidence_id,)
        ).fetchone()
        return dict(row)


@app.delete("/api/cases/{case_id}/evidence/{evidence_id}")
def delete_evidence(case_id: str, evidence_id: str) -> dict:
    with closing(get_connection()) as connection:
        _case_row(connection, case_id)
        row = connection.execute(
            "SELECT file_path FROM evidence_files WHERE id = ? AND case_id = ?",
            (evidence_id, case_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Evidence not found")
        case_dir = _safe_case_upload_dir(case_id)
        evidence_path = Path(row["file_path"]).resolve()
        if not evidence_path.is_relative_to(case_dir):
            raise HTTPException(status_code=500, detail="Invalid stored evidence path")
        evidence_path.unlink(missing_ok=True)
        connection.execute(
            "DELETE FROM evidence_files WHERE id = ? AND case_id = ?",
            (evidence_id, case_id),
        )
        connection.commit()
        return {"deleted": True, "evidence_id": evidence_id}


@app.get("/api/cases/{case_id}/dossier-integrity")
def get_dossier_integrity(case_id: str) -> dict:
    with closing(get_connection()) as connection:
        case = _case_row(connection, case_id)
        return _get_or_create_dossier_integrity(connection, case)


@app.get("/api/cases/{case_id}/report.pdf")
def get_report(case_id: str) -> FileResponse:
    with closing(get_connection()) as connection:
        case = _case_row(connection, case_id)
        evidence = _evidence_rows(connection, case_id)
        dossier_metadata = _get_or_create_dossier_integrity(connection, case)
    guidance = evaluate_case(case, evidence)
    descriptor, output_path = tempfile.mkstemp(suffix=".pdf")
    os.close(descriptor)
    try:
        generate_evidence_pdf(
            case,
            guidance,
            evidence,
            output_path,
            dossier_metadata=dossier_metadata,
        )
    except Exception:
        Path(output_path).unlink(missing_ok=True)
        raise
    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"cropproof-evidence-dossier-{uuid4().hex[:8]}.pdf",
        headers={
            "X-Dossier-ID": dossier_metadata["dossier_id"],
            "X-Dossier-SHA256": dossier_metadata["sha256_hash"],
            "X-Dossier-Generated-At": dossier_metadata["generated_at"],
        },
        background=BackgroundTask(Path(output_path).unlink, missing_ok=True),
    )
