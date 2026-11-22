import hashlib
import io
import json
import math
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .policy_service import retrieve_policies
from .rules_engine import is_within_72h_window


_UNKNOWN = "Unknown / Not Provided"
_DISCLAIMER = (
    "Disclaimer: CropProof AI does not certify crop damage, assess loss "
    "percentage, determine eligibility, or guarantee insurance compensation."
)
_WARNING = (
    "CROPPROOF AI — CROP-LOSS EVIDENCE & CLAIM READINESS DOSSIER | "
    "Independent Preparation Tool — Not an Official Government Claim Submission"
)
_INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def _rainfall_source(case: dict) -> str:
    source = case.get("rainfall_source")
    if source:
        return str(source)
    summary = str(case.get("weather_summary") or "").casefold()
    if "offline" in summary or "fallback" in summary:
        return "fallback_cache"
    if "open-meteo" in summary and case.get("rainfall_mm_72h") is not None:
        return "open-meteo"
    return "unknown"


def _rainfall_source_label(source: str) -> str:
    return {
        "open-meteo": "Open-Meteo",
        "fallback_cache": "Offline fallback estimate",
        "demo_seed": "Demo seed (not live-verified)",
    }.get(source, "Unknown source")


def create_dossier_integrity(
    case: dict,
    dossier_id: str | None = None,
    generated_at: str | None = None,
) -> dict:
    dossier_id = dossier_id or f"CPD-{uuid4().hex.upper()}"
    generated_at = generated_at or datetime.now(_INDIA_TIMEZONE).isoformat(
        timespec="seconds"
    )
    incident_date = case.get("incident_date")
    within_72h_window = None
    if incident_date:
        try:
            parsed_date = (
                incident_date
                if isinstance(incident_date, date)
                else date.fromisoformat(str(incident_date))
            )
            within_72h_window = is_within_72h_window(parsed_date)
        except ValueError:
            within_72h_window = None

    rainfall = case.get("rainfall_mm_72h")
    if not isinstance(rainfall, (int, float)) or not math.isfinite(float(rainfall)):
        rainfall = None
    affected_area = case.get("affected_area_acres")
    if isinstance(affected_area, (int, float)) and not math.isfinite(
        float(affected_area)
    ):
        affected_area = None
    rainfall_source = _rainfall_source(case)
    reporting_status = (
        "within_72h_window"
        if within_72h_window is True
        else "past_72h_window"
        if within_72h_window is False
        else "unknown"
    )
    canonical_dossier = {
        "dossier_id": dossier_id,
        "claim_id": case.get("id") or case.get("case_id"),
        "generated_at": generated_at,
        "farmer": case.get("farmer_alias") or case.get("farmer_name"),
        "location": {
            "village": case.get("village"),
            "district": case.get("district"),
            "state": case.get("state") or case.get("location_state"),
            "gps_lat": case.get("gps_lat"),
            "gps_lon": case.get("gps_lon"),
        },
        "crop": case.get("crop"),
        "calamity": case.get("calamity_type"),
        "incident_date": str(incident_date) if incident_date else None,
        "affected_area_acres": affected_area,
        "rainfall_mm": rainfall,
        "rainfall_source": rainfall_source,
        "within_72h_window": within_72h_window,
    }
    canonical_json = json.dumps(
        canonical_dossier,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return {
        "dossier_id": dossier_id,
        "claim_id": canonical_dossier["claim_id"],
        "generated_at": generated_at,
        "sha256_hash": hashlib.sha256(canonical_json.encode("utf-8")).hexdigest(),
        "rainfall_mm": rainfall,
        "rainfall_source": rainfall_source,
        "within_72h_window": within_72h_window,
        "reporting_status": reporting_status,
    }


def _display(value, default: str = _UNKNOWN) -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(item) for item in value) if value else default
    return str(value)


def _pdf_caption(value) -> str:
    caption = " ".join(_display(value, "").split())
    if not caption:
        return _UNKNOWN

    safe_characters = []
    unsupported_sequence = False
    for character in unicodedata.normalize("NFC", caption):
        try:
            character.encode("cp1252")
        except UnicodeEncodeError:
            if not unsupported_sequence:
                safe_characters.append("[unsupported characters omitted]")
            unsupported_sequence = True
        else:
            safe_characters.append(character)
            unsupported_sequence = False
    return "".join(safe_characters)


def _paragraph(value, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(_display(value)), style)


def _list_items(value) -> list:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return list(value)


def _case_location(case: dict) -> str:
    parts = [
        case.get("village"),
        case.get("district"),
        case.get("state") or case.get("location_state"),
    ]
    location = [str(part).strip() for part in parts if not _is_empty(part)]
    return ", ".join(location) if location else _UNKNOWN


def _is_empty(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _evidence_image(item: dict, styles: dict):
    file_path = item.get("file_path") or item.get("path")
    if not file_path:
        return _paragraph("No preview", styles["SmallCell"])
    path = Path(file_path)
    if not path.is_file():
        return _paragraph("No preview", styles["SmallCell"])
    try:
        with PILImage.open(path) as pil_img:
            pil_img = pil_img.convert("RGB")
            image_width, image_height = pil_img.size
            if image_width <= 0 or image_height <= 0:
                return _paragraph("Preview unavailable", styles["SmallCell"])
            scale = min(2.05 * inch / image_width, 1.25 * inch / image_height)
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=85)
            buf.seek(0)
            return Image(
                buf,
                width=image_width * scale,
                height=image_height * scale,
            )
    except Exception:
        return _paragraph("Preview unavailable", styles["SmallCell"])


def _policy_entries(guidance: dict, case: dict) -> list[dict]:
    for key in ("policy_passages", "policies", "applicable_policies"):
        entries = guidance.get(key)
        if entries:
            return _list_items(entries)
    return retrieve_policies(case.get("calamity_type"), case.get("crop"))


def _policy_paragraph(entry: dict, style: ParagraphStyle) -> Paragraph:
    title = escape(_display(entry.get("title"), "PMFBY Guidance"))
    text = escape(_display(entry.get("text")))
    source_url = escape(_display(entry.get("source_url"), "https://pmfby.gov.in/"))
    page_number = entry.get("page_number")
    page = f" | Page {escape(str(page_number))}" if page_number else ""
    return Paragraph(
        f"<b>{title}</b><br/>{text}<br/><font size='7'>{source_url}{page}</font>",
        style,
    )


def _draw_disclaimer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#B7C3D0"))
    canvas.line(
        document.leftMargin,
        0.48 * inch,
        letter[0] - document.rightMargin,
        0.48 * inch,
    )
    style = ParagraphStyle(
        "DisclaimerFooter",
        fontName="Helvetica",
        fontSize=7,
        leading=8,
        textColor=colors.HexColor("#425466"),
    )
    paragraph = Paragraph(escape(_DISCLAIMER), style)
    paragraph.wrapOn(canvas, letter[0] - document.leftMargin - document.rightMargin, 0.3 * inch)
    paragraph.drawOn(canvas, document.leftMargin, 0.21 * inch)
    canvas.restoreState()


def generate_evidence_pdf(
    case: dict,
    guidance: dict,
    evidence_list: list[dict],
    output_path: str,
    dossier_metadata: dict | None = None,
) -> str:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    dossier_metadata = dossier_metadata or create_dossier_integrity(case)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "WarningBanner",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#183B56"),
            spaceBefore=8,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            "BodySmall",
            parent=styles["BodyText"],
            fontSize=8,
            leading=10,
        )
    )
    styles.add(
        ParagraphStyle(
            "SmallCell",
            parent=styles["BodyText"],
            fontSize=7,
            leading=9,
        )
    )
    styles.add(
        ParagraphStyle(
            "TableHeader",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.white,
        )
    )

    document = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.68 * inch,
        title="CropProof AI Evidence and Claim Readiness Dossier",
        author="CropProof AI",
    )
    story = []

    banner = Table(
        [[Paragraph(escape(_WARNING), styles["WarningBanner"])]],
        colWidths=[7.4 * inch],
    )
    banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#9B1C1C")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#7F1D1D")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([banner, Spacer(1, 8)])

    status_text = {
        "within_72h_window": "Within 72-hour reporting window (date-based estimate)",
        "past_72h_window": "Past 72-hour window — document and request review",
        "unknown": "Unknown — incident date not available",
    }.get(dossier_metadata["reporting_status"], "Unknown")
    integrity_rows = [
        ("Unique Dossier ID", dossier_metadata["dossier_id"]),
        ("Generation Timestamp", dossier_metadata["generated_at"]),
        ("72-Hour Reporting Status", status_text),
        ("SHA-256 Integrity Hash", dossier_metadata["