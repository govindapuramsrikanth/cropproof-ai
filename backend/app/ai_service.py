import logging
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from pydantic import BaseModel


logger = logging.getLogger(__name__)


class AudioTranscriptionUnavailable(RuntimeError):
    pass


class AudioTranscriptionError(RuntimeError):
    pass


class IncidentExtraction(BaseModel):
    crop: str | None = None
    calamity_type: Literal[
        "flood_inundation",
        "hailstorm",
        "heavy_rain",
        "unseasonal_rain",
        "post_harvest_rain",
        "other",
    ] | None = None
    incident_date: date | None = None
    district: str | None = None
    village: str | None = None
    mandal: str | None = None
    farmer_name: str | None = None
    affected_area_acres: float | None = None
    crop_stage: str | None = None
    summary: str | None = None
    insurance_status: Literal[
        "enrolled_loanee",
        "enrolled_non_loanee",
        "unsure",
        "not_enrolled",
    ] | None = None


_CROP_TERMS = (
    (("వరి", "paddy", "rice"), "Paddy"),
    (("పత్తి", "cotton"), "Cotton"),
    (("మొక్కజొన్న", "maize"), "Maize"),
    (("మిరప", "chili", "chilli"), "Chili"),
)
_CALAMITY_TERMS = (
    (
        (
            "post-harvest rain",
            "post harvest rain",
            "కోత తర్వాత వర్షం",
            "కోత అనంతర వర్షం",
        ),
        "post_harvest_rain",
    ),
    (("వడగళ్ళు", "వడగళ్లు", "hail"), "hailstorm"),
    (("అకాల వర్షం", "unseasonal rain"), "unseasonal_rain"),
    (
        (
            "వరద",
            "మునిగి",
            "నీటమునిగ",
            "నీరు నిలిచ",
            "flood",
            "inundat",
            "waterlog",
            "water log",
        ),
        "flood_inundation",
    ),
    (
        (
            "భారీ వర్షం",
            "భారీ వర్షానికి",
            "heavy rain",
            "rain-damaged",
            "rain damaged",
            "వర్షం",
            "వర్షాల",
        ),
        "heavy_rain",
    ),
)
_DISTRICT_TERMS = (
    (("నల్గొండ", "nalgonda"), "Nalgonda"),
    (("వరంగల్", "warangal"), "Warangal"),
    (("ఖమ్మం", "khammam"), "Khammam"),
    (("కరీంనగర్", "karimnagar"), "Karimnagar"),
    (("నిజామాబాద్", "nizamabad"), "Nizamabad"),
    (("హైదరాబాద్", "hyderabad"), "Hyderabad"),
)
_VILLAGE_TERMS = (
    (("మిర్యాలగూడ", "miryalaguda"), "Miryalaguda"),
    (("పరకాల", "parkal"), "Parkal"),
    (("వైరా", "wyra"), "Wyra"),
)
_QUESTIONS = {
    "crop": (
        "What crop was affected?",
        "ఏ పంట దెబ్బతింది?",
    ),
    "calamity_type": (
        "What kind of incident damaged the crop?",
        "పంటను ఏ రకమైన విపత్తు దెబ్బతీసింది?",
    ),
    "incident_date": (
        "When did the incident happen?",
        "ఘటన ఎప్పుడు జరిగింది?",
    ),
    "insurance_status": (
        "Is your crop insured under PMFBY?",
        "మీ పంట PMFBY కింద బీమా చేయబడిందా?",
    ),
    "district": (
        "Which district is the affected field in?",
        "ప్రభావితమైన పొలం ఏ జిల్లాలో ఉంది?",
    ),
}
_NEXT_QUESTION_FIELDS = (
    "crop",
    "calamity_type",
    "incident_date",
    "insurance_status",
    "district",
)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term.casefold() in text.casefold() for term in terms)


def _extract_offline(transcript: str) -> IncidentExtraction:
    text = transcript.casefold()
    values: dict = {}

    for terms, crop_name in _CROP_TERMS:
        if _contains_any(text, terms):
            values["crop"] = crop_name
            break

    for terms, calamity in _CALAMITY_TERMS:
        if _contains_any(text, terms):
            values["calamity_type"] = calamity
            break

    for terms, district in _DISTRICT_TERMS:
        if _contains_any(text, terms):
            values["district"] = district
            break

    for terms, village in _VILLAGE_TERMS:
        if _contains_any(text, terms):
            values["village"] = village
            break

    mandal = re.search(
        r"\b([\w'-]+(?:\s+[\w'-]+)?)\s+mandal\b",
        transcript,
        flags=re.IGNORECASE,
    )
    telugu_mandal = re.search(
        r"([\u0c00-\u0c7f\w'-]+(?:\s+[\u0c00-\u0c7f\w'-]+)?)\s+మండలం",
        transcript,
        flags=re.IGNORECASE,
    )
    if mandal:
        values["mandal"] = re.sub(r"^in\s+", "", mandal.group(1), flags=re.IGNORECASE)
    elif telugu_mandal:
        values["mandal"] = telugu_mandal.group(1).strip()

    explicit_date = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", transcript)
    if explicit_date:
        try:
            values["incident_date"] = date.fromisoformat(explicit_date.group(1))
        except ValueError:
            pass
    if "incident_date" not in values:
        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
        if _contains_any(text, ("మొన్న", "day before yesterday")):
            values["incident_date"] = today - timedelta(days=2)
        elif _contains_any(text, ("నిన్న", "yesterday")):
            values["incident_date"] = today - timedelta(days=1)
        elif _contains_any(text, ("ఈరోజు", "ఈ రోజు", "today")):
            values["incident_date"] = today

    farmer_name = re.search(
        r"\b(?:my name is|farmer(?: name)? is)\s+([A-Z][A-Za-z.' -]{1,40}?)"
        r"(?=\s*(?:,|\.|;|\bfrom\b|\bin\b|\band\b|$))",
        transcript,
        flags=re.IGNORECASE,
    )
    telugu_farmer_name = re.search(
        r"నా పేరు\s+([\u0c00-\u0c7f]+(?:\s+[\u0c00-\u0c7f]+){0,2})",
        transcript,
    )
    if farmer_name:
        values["farmer_name"] = farmer_name.group(1).strip()
    elif telugu_farmer_name:
        values["farmer_name"] = telugu_farmer_name.group(1).strip()

    if _contains_any(text, ("మీసేవ", "csc", "non-loanee")):
        values["insurance_status"] = "enrolled_non_loanee"
    elif _contains_any(text, ("లోన్", "బ్యాంక్", "loan", "bank")):
        values["insurance_status"] = "enrolled_loanee"

    area = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:acres?|ఎకరాల|ఎకరాలు)",
        transcript,
        flags=re.IGNORECASE,
    )
    if area:
        values["affected_area_acres"] = float(area.group(1))

    summary_parts = []
    if values.get("crop"):
        summary_parts.append(f"{values['crop']} crop")
    if values.get("calamity_type"):
        summary_parts.append(values["calamity_type"].replace("_", " "))
    if values.get("affected_area_acres") is not None:
        summary_parts.append(f"{values['affected_area_acres']} acres")
    if values.get("village"):
        summary_parts.append(f"at {values['village']}")
    if values.get("district"):
        summary_parts.append(f"in {values['district']} district")
    if values.get("incident_date"):
        summary_parts.append(f"on {values['incident_date'].isoformat()}")
    values["summary"] = (
        "Reported " + " ".join(summary_parts)
        if summary_parts
        else transcript.strip()[:500]
    )
    return IncidentExtraction(**values)


def _extract_with_gemini(transcript: str, language: str) -> IncidentExtraction:
    from google import genai
    from google.genai import types

    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
    prompt = (
        "Extract only incident details explicitly mentioned in the transcript. "
        "The transcript may be in Telugu or English; understand either language "
        "and return field values in English. Resolve relative dates using "
        f"{today.isoformat()} as today. Extract crop, calamity type, loss date, "
        "affected area in acres, village, mandal, district, farmer name, and a "
        "short summary. Use the specified enum values, and leave unknown fields null.\n"
        f"Preferred response language: {language}\n"
        f"Transcript:\n{transcript}"
    )
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=IncidentExtraction,
        ),
    )
    if isinstance(response.parsed, IncidentExtraction):
        return response.parsed
    if response.parsed is not None:
        return IncidentExtraction.model_validate(response.parsed)
    if response.text:
        return IncidentExtraction.model_validate_json(response.text)
    raise ValueError("Gemini returned no structured incident extraction")


def transcribe_audio(audio_bytes: bytes, mime_type: str, language: str) -> str:
    if not os.getenv("GEMINI_API_KEY"):
        raise AudioTranscriptionUnavailable(
            "Audio transcription requires GEMINI_API_KEY. Allow browser speech "
            "recognition or type your description instead."
        )

    normalized_mime = mime_type.split(";", maxsplit=1)[0].strip().lower()
    if not normalized_mime.startswith("audio/"):
        normalized_mime = "audio/webm"
    language_name = "Telugu" if language == "te-IN" else "Indian English"
    prompt = (
        f"Transcribe this crop-loss voice recording in {language_name}. "
        "Return only the spoken words, preserving the original language and "
        "meaning. Do not summarize or add information."
    )
    try:
        from google import genai
        from google.genai import types

        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type=normalized_mime,
                ),
            ],
        )
        transcript = (response.text or "").strip()
    except Exception as exc:
        logger.exception("Gemini audio transcription failed")
        raise AudioTranscriptionError(
            "Gemini audio transcription failed. Please try again or type your description."
        ) from exc

    if not transcript:
        raise AudioTranscriptionError(
            "No speech could be transcribed from this recording. Please try again."
        )
    return transcript


def extract_incident_info(
    transcript: str, current_case: dict, language: str
) -> dict:
    fallback = _extract_offline(transcript).model_dump(
        mode="json", exclude_none=True
    )
    ai_mode = "offline_demo"
    extracted_values = fallback
    if os.getenv("GEMINI_API_KEY"):
        try:
            gemini_values = _extract_with_gemini(transcript, language).model_dump(
                mode="json", exclude_none=True
            )
            extracted_values = {**fallback, **gemini_values}
            ai_mode = "gemini_live"
        except Exception:
            logger.exception("Gemini extraction failed; using offline parser")
    loss_date = extracted_values.get("incident_date")
    deadline_values = {
        "hours_elapsed": None,
        "hours_remaining": None,
        "within_72h_window": None,
    }
    if loss_date:
        incident_day = date.fromisoformat(loss_date)
        india_timezone = timezone(timedelta(hours=5, minutes=30))
        incident_start = datetime.combine(incident_day, time.min, tzinfo=india_timezone)
        now = datetime.now(india_timezone)
        hours_elapsed = max(0.0, (now - incident_start).total_seconds() / 3600)
        hours_remaining = max(0.0, 72.0 - hours_elapsed)
        deadline_values = {
            "hours_elapsed": round(hours_elapsed, 2),
            "hours_remaining": round(hours_remaining, 2),
            "within_72h_window": hours_elapsed <= 72.0,
        }

    merged_case = dict(current_case)
    merged_case.update(extracted_values)
    if extracted_values.get("farmer_name"):
        merged_case["farmer_alias"] = extracted_values["farmer_name"]
    next_question = next(
        (
            _QUESTIONS[field]
            for field in _NEXT_QUESTION_FIELDS
            if merged_case.get(field) is None or merged_case.get(field) == ""
        ),
        (None, None),
    )
    return {
        **merged_case,
        **deadline_values,
        "ai_mode": ai_mode,
        "next_question_en": next_question[0],
        "next_question_te": next_question[1],
    }
