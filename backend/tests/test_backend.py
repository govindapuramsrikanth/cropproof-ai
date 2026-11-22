import json
from contextlib import closing
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
import sqlite3
import sys
from urllib.parse import parse_qs, urlparse

import fitz
import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import ai_service, main
from app.database import get_connection as database_connection
from app.database import initialize_database


def test_database_migrates_live_proof_columns(tmp_path):
    database_path = tmp_path / "legacy.db"
    with closing(sqlite3.connect(database_path)) as connection:
        connection.execute("CREATE TABLE incident_cases (id TEXT PRIMARY KEY)")
        connection.execute(
            """
            CREATE TABLE farmer_stories (
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
                takeaway TEXT NOT NULL
            )
            """
        )
        connection.commit()

    initialize_database(database_path)

    with closing(sqlite3.connect(database_path)) as connection:
        case_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(incident_cases)")
        }
        story_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(farmer_stories)")
        }
    assert {
        "gps_lat",
        "gps_lon",
        "gps_accuracy_m",
        "weather_summary",
        "rainfall_mm_72h",
        "rainfall_source",
        "weather_observed_at",
        "dossier_id",
        "dossier_generated_at",
        "dossier_sha256",
    } <= case_columns
    assert {
        "premium_paid_display",
        "payout_received_display",
        "pib_release_note",
        "video_reference_title",
        "video_reference_url",
    } <= story_columns


@pytest.fixture
def client(tmp_path, monkeypatch):
    database_path = tmp_path / "test_backend.db"
    uploads_path = tmp_path / "uploads"
    uploads_path.mkdir()
    initialize_database(database_path)
    monkeypatch.setattr(
        main, "init_db", lambda: initialize_database(database_path)
    )
    monkeypatch.setattr(
        main,
        "get_connection",
        lambda: database_connection(database_path),
    )
    monkeypatch.setattr(main, "UPLOADS_DIR", uploads_path)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with TestClient(main.app) as test_client:
        yield test_client


def test_health_and_seeded_stories(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "date": "2026-11-22"}

    stories_response = client.get("/api/stories")
    assert stories_response.status_code == 200
    stories = stories_response.json()
    assert len(stories) == 3
    assert {story["id"] for story in stories} == {
        "pib-anwar-hussain-assam",
        "pib-lal-krishnesh-kerala-2022",
        "pib-lal-krishnesh-kerala-2023",
    }
    anwar = next(
        story for story in stories if story["id"] == "pib-anwar-hussain-assam"
    )
    assert anwar["premium_paid_display"] == "Rs. 100"
    assert anwar["payout_received_display"] == "Rs. 50,600 (reported compensation)"
    assert anwar["video_reference_url"] == "https://www.youtube.com/@DDKisan"
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    today_before_request = datetime.now(india_timezone).date()
    demo_case = client.post("/api/cases", json={"demo": True}).json()
    today_after_request = datetime.now(india_timezone).date()
    assert demo_case["farmer_alias"] == "Ramesh Reddy (Demo)"
    assert demo_case["crop"] == "Paddy"
    assert demo_case["calamity_type"] == "flood_inundation"
    incident_date = datetime.fromisoformat(demo_case["incident_date"]).date()
    assert incident_date in {
        today_before_request - timedelta(days=1),
        today_after_request - timedelta(days=1),
    }
    assert demo_case["village"] == "Miryalaguda"
    assert demo_case["district"] == "Nalgonda"
    assert demo_case["state"] == "Telangana"
    assert demo_case["affected_area_acres"] == 2.5
    assert demo_case["crop_stage"] == "Flowering / Grain Filling"
    assert demo_case["insurance_status"] == "enrolled_loanee"
    assert demo_case["confirmation_status"] == "Farmer confirmed"
    assert demo_case["is_confirmed"] == 1
    assert demo_case["current_step"] == 3
    assert demo_case["gps_lat"] == 16.8732
    assert demo_case["gps_lon"] == 79.5631
    assert demo_case["gps_accuracy_m"] == 12.0
    assert demo_case["rainfall_mm_72h"] == 74.2
    assert demo_case["rainfall_source"] == "demo_seed"
    assert (
        demo_case["weather_summary"]
        == "Heavy Rain / Inundation Telemetry (Open-Meteo Live)"
    )
    assert (
        demo_case["weather_observed_at"] == "2026-11-22T12:15:00+05:30"
    )


def test_cors_origins_include_local_and_configured_render_sites(monkeypatch):
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        " https://crop-proof.onrender.com, https://staging.example.com ",
    )
    assert main._allowed_origins() == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://crop-proof.onrender.com",
        "https://staging.example.com",
    ]

    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    assert main._allowed_origins() == ["*"]


def test_claim_audio_transcription_route(client, monkeypatch):
    audio = b"webm audio payload"
    no_api_key = client.post(
        "/api/claims/transcribe",
        files={"file": ("voice.webm", audio, "audio/webm")},
        data={"language": "te-IN"},
    )
    assert no_api_key.status_code == 503
    assert "GEMINI_API_KEY" in no_api_key.json()["detail"]

    received = {}

    def fake_transcribe_audio(audio_bytes, mime_type, language):
        received.update(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            language=language,
        )
        return "నా వరి పంటకు నష్టం జరిగింది"

    monkeypatch.setattr(main, "transcribe_audio", fake_transcribe_audio)
    response = client.post(
        "/api/claims/transcribe",
        files={"file": ("voice.webm", audio, "audio/webm")},
        data={"language": "te-IN"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "transcript": "నా వరి పంటకు నష్టం జరిగింది",
        "language": "te-IN",
        "source": "gemini_live",
    }
    assert received == {
        "audio_bytes": audio,
        "mime_type": "audio/webm",
        "language": "te-IN",
    }
    assert response.headers["access-control-allow-origin"] in {
        "*",
        "http://localhost:5173",
    }

    invalid_language = client.post(
        "/api/claims/transcribe",
        files={"file": ("voice.webm", audio, "audio/webm")},
        data={"language": "fr-FR"},
    )
    assert invalid_language.status_code == 422


def test_claim_intake_parses_english_and_telugu_without_gemini(client):
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(india_timezone).date()

    english = client.post(
        "/api/claims/intake",
        json={
            "language": "en",
            "transcript": (
                "My name is Ramesh. Heavy rain flooded 2.5 acres of paddy "
                "in Miryalaguda mandal, Nalgonda district yesterday."
            ),
        },
    )
    assert english.status_code == 200
    english_result = english.json()
    assert english_result["crop_type"] == "Paddy"
    assert english_result["calamity_type"] == "flood_inundation"
    assert english_result["loss_date"] == (today - timedelta(days=1)).isoformat()
    assert english_result["affected_area_acres"] == 2.5
    assert english_result["village"] == "Miryalaguda"
    assert english_result["mandal"] == "Miryalaguda"
    assert english_result["district"] == "Nalgonda"
    assert english_result["farmer_name"] == "Ramesh"
    assert english_result["summary"]
    assert english_result["hours_elapsed"] >= 0
    assert 0 <= english_result["hours_remaining"] <= 72
    assert english_result["within_72h_window"] is True
    assert english_result["ai_mode"] == "offline_demo"

    telugu = client.post(
        "/api/claims/intake",
        json={
            "language": "te",
            "transcript": (
                "ఈరోజు ఖమ్మం జిల్లా వైరాలో నీరు నిలిచిపోవడంతో "
                "నా 1.5 ఎకరాల మొక్కజొన్న పంట నీటమునిగింది."
            ),
        },
    )
    assert telugu.status_code == 200
    telugu_result = telugu.json()
    assert telugu_result["crop_type"] == "Maize"
    assert telugu_result["calamity_type"] == "flood_inundation"
    assert telugu_result["loss_date"] == today.isoformat()
    assert telugu_result["affected_area_acres"] == 1.5
    assert telugu_result["village"] == "Wyra"
    assert telugu_result["district"] == "Khammam"
    assert telugu_result["within_72h_window"] is True


def test_claim_intake_fills_partial_gemini_response(client, monkeypatch):
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(india_timezone).date()
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(
        ai_service,
        "_extract_with_gemini",
        lambda transcript, language: ai_service.IncidentExtraction(crop="Cotton"),
    )

    response = client.post(
        "/api/claims/intake",
        json={
            "language": "en",
            "transcript": (
                "Heavy rain flooded 2 acres of paddy in Miryalaguda, "
                "Nalgonda yesterday."
            ),
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["crop_type"] == "Cotton"
    assert result["calamity_type"] == "flood_inundation"
    assert result["loss_date"] == (today - timedelta(days=1)).isoformat()
    assert result["affected_area_acres"] == 2.0
    assert result["district"] == "Nalgonda"
    assert result["summary"]
    assert result["ai_mode"] == "gemini_live"


def test_weather_verification_forecast_archive_and_fallback(client, monkeypatch):
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(india_timezone).date()
    recent_date = today - timedelta(days=1)
    historical_date = today - timedelta(days=10)
    observed_urls = []

    def fake_urlopen(url, timeout):
        observed_urls.append((url, timeout))
        query = parse_qs(urlparse(url).query)
        requested = query.get("start_date", [recent_date.isoformat()])[0]
        payload = {
            "daily": {
                "time": [requested],
                "precipitation_sum": [18.4],
            }
        }
        return BytesIO(json.dumps(payload).encode("utf-8"))

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)
    recent = client.get(
        "/api/weather/verify",
        params={
            "latitude": 17.0575,
            "longitude": 79.2684,
            "incident_date": recent_date.isoformat(),
        },
    )
    assert recent.status_code == 200
    assert recent.json()["precipitation_mm"] == 18.4
    assert recent.json()["latitude"] == 17.0575
    assert recent.json()["longitude"] == 79.2684
    assert recent.json()["queried_date"] == recent_date.isoformat()
    assert recent.json()["source"] == "open-meteo"
    assert recent.json()["within_72h_window"] is True
    recent_url, recent_timeout = observed_urls[-1]
    assert "/v1/forecast?" in recent_url
    assert recent_timeout == 5

    historical = client.get(
        "/api/weather/verify",
        params={
            "latitude": 17.0575,
            "longitude": 79.2684,
            "incident_date": historical_date.isoformat(),
        },
    )
    assert historical.status_code == 200
    assert historical.json()["queried_date"] == historical_date.isoformat()
    assert historical.json()["within_72h_window"] is False
    historical_url, historical_timeout = observed_urls[-1]
    assert "/v1/archive?" in historical_url
    assert historical_timeout == 5

    def unavailable_urlopen(url, timeout):
        raise TimeoutError("Open-Meteo timed out")

    monkeypatch.setattr(main.urllib.request, "urlopen", unavailable_urlopen)
    fallback = client.get(
        "/api/weather/verify",
        params={
            "latitude": 17.0575,
            "longitude": 79.2684,
            "incident_date": recent_date.isoformat(),
        },
    )
    assert fallback.status_code == 200
    assert fallback.json()["source"] == "fallback_cache"
    assert fallback.json()["precipitation_mm"] > 0
    assert fallback.json()["latitude"] == 17.0575
    assert fallback.json()["longitude"] == 79.2684
    assert fallback.json()["queried_date"] == recent_date.isoformat()
    assert "not verified" in fallback.json()["note"]


def test_case_creation_and_pdf_return_dossier_integrity(client):
    created = client.post("/api/cases", json={"language": "en"})
    assert created.status_code == 200
    case = created.json()

    integrity = client.get(f"/api/cases/{case['id']}/dossier-integrity")
    assert integrity.status_code == 200
    dossier = integrity.json()
    assert dossier["dossier_id"]
    assert len(dossier["sha256_hash"]) == 64

    pdf_response = client.get(f"/api/cases/{case['id']}/report.pdf")
    assert pdf_response.status_code == 200
    assert pdf_response.content.startswith(b"%PDF")
    assert pdf_response.headers["x-dossier-id"] == dossier["dossier_id"]
    assert pdf_response.headers["x-dossier-sha256"] == dossier["sha256_hash"]


def test_case_extraction_confirmation_guidance_upload_and_pdf(client, monkeypatch):
    created = client.post("/api/cases", json={"language": "te", "demo": False})
    assert created.status_code == 200
    case = created.json()
    case_id = case["id"]
    assert case["is_confirmed"] == 0
    partial_guidance = client.get(f"/api/cases/{case_id}/guidance")
    assert partial_guidance.status_code == 200
    partial_stories = partial_guidance.json()["matched_stories"]
    assert len(partial_stories) == 3
    assert all(
        story["match_reason"]
        == "Verified PMFBY Public Account — Reference Example"
        for story in partial_stories
    )

    extraction = client.post(
        f"/api/cases/{case_id}/extract",
        json={
            "transcript": "నిన్న రాత్రి భారీ వర్షానికి నా 2.5 ఎకరాల వరి పంట మునిగిపోయింది",
            "language": "te",
        },
    )
    assert extraction.status_code == 200
    extracted_case = extraction.json()
    assert extracted_case["crop"] == "Paddy"
    assert extracted_case["calamity_type"] == "flood_inundation"
    assert extracted_case["incident_date"] == "2026-11-21"
    assert extracted_case["affected_area_acres"] == 2.5
    assert extracted_case["ai_mode"] == "offline_demo"
    assert extracted_case["next_question_en"]
    assert extracted_case["next_question_te"]

    confirmed = client.patch(
        f"/api/cases/{case_id}/confirm",
        json={
            "farmer_alias": "Ramesh",
            "village": "Miryalaguda",
            "district": "Nalgonda",
            "state": "Telangana",
            "insurance_status": "enrolled_loanee",
            "crop_stage": "Standing crop",
        },
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["is_confirmed"] == 1
    assert confirmed.json()["current_step"] == 3

    weather_payload = {
        "utc_offset_seconds": 19800,
        "current": {
            "time": "2026-11-22T12:15",
            "temperature_2m": 27.1,
            "precipitation": 1.2,
            "weather_code": 65,
        },
        "daily": {
            "time": [
                "2026-11-19",
                "2026-11-20",
                "2026-11-21",
                "2026-11-22",
                "2026-11-23",
            ],
            "precipitation_sum": [10.0, 20.0, 44.2, 1.2, 0.0],
        },
    }
    request_details = {}

    def fake_urlopen(url, timeout):
        request_details["url"] = url
        request_details["timeout"] = timeout
        return BytesIO(json.dumps(weather_payload).encode("utf-8"))

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)
    live_proof = client.post(
        f"/api/cases/{case_id}/live-proof",
        json={"lat": 17.0575, "lon": 79.2684, "accuracy_m": 6.5},
    )
    assert live_proof.status_code == 200
    proof_case = live_proof.json()
    assert proof_case["gps_lat"] == 17.0575
    assert proof_case["gps_lon"] == 79.2684
    assert proof_case["gps_accuracy_m"] == 6.5
    assert proof_case["rainfall_mm_72h"] == pytest.approx(74.2)
    assert "Heavy rain" in proof_case["weather_summary"]
    assert proof_case["weather_observed_at"] == "2026-11-22T12:15:00+05:30"
    assert request_details["timeout"] == 5
    query = parse_qs(urlparse(request_details["url"]).query)
    assert query["latitude"] == ["17.0575"]
    assert query["longitude"] == ["79.2684"]
    assert query["timezone"] == ["Asia/Kolkata"]

    status = client.patch(
        f"/api/cases/{case_id}/status",
        json={"manual_status": "Reported by farmer", "acknowledgement_ref": "REF-1"},
    )
    assert status.status_code == 200
    assert status.json()["manual_status"] == "Reported by farmer"

    guidance = client.get(f"/api/cases/{case_id}/guidance")
    assert guidance.status_code == 200
    deadline = guidance.json()["deadline_evaluation"]
    assert deadline["window_hours"] == 72
    assert deadline["deadline_date"] == "2026-11-24"
    assert deadline["status"] == "exact_incident_time_not_recorded"
    assert "72 hours" in deadline["note"]
    assert any(
        story["id"] == "pib-anwar-hussain-assam"
        for story in guidance.json()["matched_stories"]
    )
    guidance_stories = guidance.json()["matched_stories"]
    assert len(guidance_stories) == 3
    assert next(
        story
        for story in guidance_stories
        if story["id"] == "pib-anwar-hussain-assam"
    )["match_reason"] == (
        "Best Match for Your Case — matches reported calamity/crop"
    )

    png = BytesIO()
    Image.new("RGB", (4, 4), color="green").save(png, format="PNG")
    upload = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("crop.png", png.getvalue(), "image/png")},
        data={
            "category": "crop_photo",
            "user_caption": "Flooded paddy field — పొలంలో నీరు",
        },
    )
    assert upload.status_code == 200
    evidence = upload.json()
    assert evidence["file_name"] == "crop.png"
    assert evidence["farmer_caption"] == "Flooded paddy field — పొలంలో నీరు"
    assert Path(evidence["file_path"]).is_file()

    case_with_evidence = client.get(f"/api/cases/{case_id}")
    assert len(case_with_evidence.json()["evidence"]) == 1

    integrity = client.get(f"/api/cases/{case_id}/dossier-integrity")
    assert integrity.status_code == 200
    dossier = integrity.json()
    assert dossier["dossier_id"].startswith("CPD-")
    assert len(dossier["sha256_hash"]) == 64
    assert dossier["rainfall_mm"] == pytest.approx(74.2)
    assert dossier["rainfall_source"] == "open-meteo"
    assert dossier["within_72h_window"] is True
    assert client.get(
        f"/api/cases/{case_id}/dossier-integrity"
    ).json() == dossier

    report = client.get(f"/api/cases/{case_id}/report.pdf")
    assert report.status_code == 200
    assert report.headers["content-type"] == "application/pdf"
    assert report.headers["x-dossier-id"] == dossier["dossier_id"]
    assert report.headers["x-dossier-sha256"] == dossier["sha256_hash"]
    assert report.content.startswith(b"%PDF")
    pdf_document = fitz.open(stream=report.content, filetype="pdf")
    pdf_text = "\n".join(page.get_text() for page in pdf_document)
    pdf_document.close()
    assert "LIVE TELEMETRY & GEOLOCATION PROOF" in pdf_text
    assert "TAMPER-EVIDENT DOSSIER STAMP" in pdf_text
    assert dossier["dossier_id"] in pdf_text
    assert dossier["sha256_hash"] in pdf_text
    assert "Rainfall Verification Summary" in pdf_text
    assert "17.0575, 79.2684" in pdf_text
    assert "74.2 mm" in pdf_text
    assert "Open-Meteo Meteorological Feed & Device Geolocation" in pdf_text
    assert "Flooded paddy field" in pdf_text
    assert "[unsupported characters omitted]" in pdf_text

    deleted = client.delete(
        f"/api/cases/{case_id}/evidence/{evidence['id']}"
    )
    assert deleted.status_code == 200
    assert not Path(evidence["file_path"]).exists()

    def offline_urlopen(url, timeout):
        raise TimeoutError("weather service timed out")

    monkeypatch.setattr(main.urllib.request, "urlopen", offline_urlopen)
    district_fallback = client.post(
        f"/api/cases/{case_id}/live-proof", json={}
    ).json()
    assert district_fallback["gps_lat"] == 17.0575
    assert district_fallback["gps_lon"] == 79.2684
    assert district_fallback["gps_accuracy_m"] is None

    offline_case = client.post("/api/cases", json={}).json()
    offline_proof = client.post(
        f"/api/cases/{offline_case['id']}/live-proof",
    )
    assert offline_proof.status_code == 200
    assert offline_proof.json()["rainfall_mm_72h"] is None
    assert "offline fallback" in offline_proof.json()["weather_summary"]
    assert offline_proof.json()["gps_lat"] == 16.8732
    assert offline_proof.json()["gps_lon"] == 79.5631
    assert offline_proof.json()["gps_accuracy_m"] is None


def test_dossier_integrity_refreshes_when_claim_details_change(client):
    case = client.post("/api/cases", json={}).json()
    first = client.get(
        f"/api/cases/{case['id']}/dossier-integrity"
    ).json()

    updated = client.patch(
        f"/api/cases/{case['id']}/confirm",
        json={"crop": "Cotton", "incident_date": "2026-11-21"},
    )
    assert updated.status_code == 200
    second = client.get(
        f"/api/cases/{case['id']}/dossier-integrity"
    ).json()
    assert second["dossier_id"] != first["dossier_id"]
    assert second["sha256_hash"] != first["sha256_hash"]
    assert second["within_72h_window"] is True
