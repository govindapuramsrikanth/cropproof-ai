import hashlib
import json
import math
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from xml.sax.saxutils import escape
from uuid import uuid4

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
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
    if path.suffix.casefold() not in {".jpg", ".jpeg", ".png"} or not path.is_file():
        return _paragraph("No preview", styles["SmallCell"])
    try:
        image_reader = ImageReader(str(path))
        image_width, image_height = image_reader.getSize()
        scale = min(2.2 * inch / image_width, 1.3 * inch / image_height)
        return Image(
            str(path),
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
        ("SHA-256 Integrity Hash", dossier_metadata["sha256_hash"]),
    ]
    integrity_table = Table(
        [
            [
                _paragraph(label, styles["SmallCell"]),
                _paragraph(value, styles["SmallCell"]),
            ]
            for label, value in integrity_rows
        ],
        colWidths=[2.0 * inch, 5.4 * inch],
    )
    integrity_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#FEF3C7")),
                ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#FFFBEB")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#D97706")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#FCD34D")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend(
        [
            Paragraph("TAMPER-EVIDENT DOSSIER STAMP", styles["SectionHeading"]),
            integrity_table,
            Spacer(1, 5),
        ]
    )

    story.append(
        Paragraph(
            "Section 1: Farmer-Confirmed Incident Details "
            "(Farmer-Provided / Unverified by Authorities)",
            styles["SectionHeading"],
        )
    )
    affected_area = case.get("affected_area_acres")
    if not _is_empty(affected_area):
        affected_area = f"{_display(affected_area)} acres"
    details = [
        ("Case ID", _display(case.get("case_id") or case.get("id"))),
        (
            "Farmer Alias",
            _display(case.get("farmer_alias") or case.get("farmer_name")),
        ),
        ("Crop", _display(case.get("crop"))),
        ("Calamity Type", _display(case.get("calamity_type"))),
        ("Incident Date", _display(case.get("incident_date"))),
        ("Village/District/State", _case_location(case)),
        ("Affected Area", _display(affected_area)),
        ("Insurance Status", _display(case.get("insurance_status"))),
        ("Confirmation Status", _display(case.get("confirmation_status"))),
    ]
    detail_rows = [
        [_paragraph(label, styles["SmallCell"]), _paragraph(value, styles["SmallCell"])]
        for label, value in details
    ]
    detail_table = Table(detail_rows, colWidths=[2.0 * inch, 5.4 * inch])
    detail_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF0F5")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BCC8D3")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(detail_table)

    story.append(
        Paragraph(
            "LIVE TELEMETRY &amp; GEOLOCATION PROOF",
            styles["SectionHeading"],
        )
    )
    gps_lat = case.get("gps_lat")
    gps_lon = case.get("gps_lon")
    gps_coordinates = (
        f"{gps_lat}, {gps_lon}"
        if gps_lat is not None and gps_lon is not None
        else _UNKNOWN
    )
    accuracy = case.get("gps_accuracy_m")
    accuracy_text = f"±{accuracy} m" if accuracy is not None else _UNKNOWN
    rainfall = case.get("rainfall_mm_72h")
    rainfall_text = f"{rainfall} mm" if rainfall is not None else _UNKNOWN
    rainfall_source = _rainfall_source(case)
    source_label = _rainfall_source_label(rainfall_source)
    rainfall_summary = (
        f"{rainfall_text} ({source_label})"
        if rainfall is not None
        else f"{_UNKNOWN} ({source_label})"
    )
    source_description = (
        "Open-Meteo Meteorological Feed & Device Geolocation"
        if rainfall_source == "open-meteo"
        else f"{source_label} & Device Geolocation"
    )
    telemetry_rows = [
        ("Exact GPS Coordinates (lat, lon)", gps_coordinates),
        ("Accuracy", accuracy_text),
        ("Live 72-Hour Rainfall", rainfall_text),
        ("Rainfall Verification Summary", rainfall_summary),
        ("Weather Observation Timestamp", case.get("weather_observed_at")),
        ("Current Weather Conditions", case.get("weather_summary")),
        ("Data Source", source_description),
    ]
    telemetry_table = Table(
        [
            [
                _paragraph(label, styles["SmallCell"]),
                _paragraph(value, styles["SmallCell"]),
            ]
            for label, value in telemetry_rows
        ],
        colWidths=[2.6 * inch, 4.8 * inch],
    )
    telemetry_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#DBEAFE")),
                ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#EFF6FF")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#2563EB")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#93C5FD")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(telemetry_table)

    story.append(
        Paragraph(
            "Section 2: Missing Information &amp; Readiness Warnings",
            styles["SectionHeading"],
        )
    )
    warning_items = [
        ("Missing information", guidance.get("missing_fields")),
        ("Missing evidence", guidance.get("missing_evidence")),
    ]
    for heading, items in warning_items:
        story.append(Paragraph(f"<b>{escape(heading)}</b>", styles["BodySmall"]))
        values = _list_items(items)
        if not values:
            values = ["None identified"]
        for item in values:
            story.append(
                Paragraph(f"&bull; {escape(_display(item))}", styles["BodySmall"])
            )
    story.append(Spacer(1, 4))

    story.append(
        Paragraph("Section 3: Uploaded Evidence Inventory", styles["SectionHeading"])
    )
    evidence_rows = [
        [
            Paragraph(label, styles["TableHeader"])
            for label in ("Category", "File Name", "Upload Time", "Farmer Caption", "Preview")
        ]
    ]
    if evidence_list:
        for item in evidence_list:
            file_path = item.get("file_path") or item.get("path")
            file_name = item.get("file_name") or (
                Path(file_path).name if file_path else None
            )
            evidence_rows.append(
                [
                    _paragraph(item.get("category"), styles["SmallCell"]),
                    _paragraph(file_name, styles["SmallCell"]),
                    _paragraph(
                        item.get("uploaded_at") or item.get("upload_time"),
                        styles["SmallCell"],
                    ),
                    _paragraph(
                        item.get("farmer_caption") or item.get("caption"),
                        styles["SmallCell"],
                    ),
                    _evidence_image(item, styles),
                ]
            )
    else:
        evidence_rows.append(
            [
                _paragraph("No evidence files provided", styles["SmallCell"]),
                "",
                "",
                "",
                "",
            ]
        )
    evidence_table = Table(
        evidence_rows,
        colWidths=[0.85 * inch, 1.25 * inch, 1.0 * inch, 2.1 * inch, 2.2 * inch],
        repeatRows=1,
    )
    evidence_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#183B56")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BCC8D3")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(evidence_table)

    story.append(
        Paragraph(
            "Section 4: Applicable Official PMFBY Guidance &amp; Reporting Channels",
            styles["SectionHeading"],
        )
    )
    deadline_note = (
        guidance.get("conditional_deadline_note")
        or guidance.get("deadline_note")
        or guidance.get("conditional_deadline")
    )
    if deadline_note:
        story.append(
            Paragraph(
                f"<b>Conditional deadline note:</b> {escape(_display(deadline_note))}",
                styles["BodySmall"],
            )
        )
    channels = [
        "14447 Helpline / Krishi Rakshak Portal",
        "Crop Insurance Mobile App (geo-tagged photos)",
        "Concerned Bank branch (for loanee farmers)",
        "Local CSC / Agriculture Department officials",
    ]
    for channel in _list_items(guidance.get("official_reporting_channels")):
        text = _display(channel)
        if text not in channels:
            channels.append(text)
    story.append(Paragraph("<b>Official reporting channels</b>", styles["BodySmall"]))
    for channel in channels:
        story.append(
            Paragraph(f"&bull; {escape(channel)}", styles["BodySmall"])
        )

    policies = _policy_entries(guidance, case)
    story.append(Spacer(1, 4))
    if policies:
        for policy in policies:
            if isinstance(policy, dict):
                story.append(_policy_paragraph(policy, styles["SmallCell"]))
                story.append(Spacer(1, 4))
            else:
                story.append(_paragraph(policy, styles["SmallCell"]))
    else:
        story.append(
            Paragraph(
                "No source-cited policy passages were supplied. Official reference: "
                "https://pmfby.gov.in/",
                styles["SmallCell"],
            )
        )

    document.build(
        story,
        onFirstPage=_draw_disclaimer,
        onLaterPages=_draw_disclaimer,
    )
    return str(output)
