from datetime import date, datetime, time, timedelta, timezone

from .policy_service import retrieve_policies


_REQUIRED_FIELDS = (
    ("crop", "Crop"),
    ("calamity_type", "Calamity type"),
    ("incident_date", "Incident date"),
    ("insurance_status", "Insurance status"),
)
_LOCALIZED_CALAMITIES = {
    "flood_inundation",
    "hailstorm",
    "heavy_rain",
}
_INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def is_within_72h_window(incident_date: date, now: datetime | None = None) -> bool:
    incident_start = datetime.combine(
        incident_date,
        time.min,
        tzinfo=_INDIA_TIMEZONE,
    )
    current_time = now or datetime.now(_INDIA_TIMEZONE)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=_INDIA_TIMEZONE)
    elapsed = (current_time - incident_start).total_seconds()
    return 0 <= elapsed <= 72 * 60 * 60


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _deadline_note(case: dict) -> str:
    calamity_type = case.get("calamity_type")
    if calamity_type in _LOCALIZED_CALAMITIES:
        return (
            "For eligible localized farm-level losses, intimation should be made "
            "within 72 hours of occurrence. Delayed reports are subject to "
            "competent-authority review."
        )
    if calamity_type == "post_harvest_rain":
        return (
            "Eligible post-harvest losses for crops kept in cut-and-spread "
            "condition may be covered up to 14 days from harvesting. Report "
            "promptly and confirm applicability with the insurer."
        )
    return (
        "Reporting deadlines depend on the event type and policy conditions. "
        "Contact the insurer or an official reporting channel promptly."
    )


def _deadline_evaluation(case: dict, note: str) -> dict:
    calamity_type = case.get("calamity_type")
    if calamity_type in _LOCALIZED_CALAMITIES:
        result = {
            "window_hours": 72,
            "deadline_date": None,
            "status": "incident_date_missing",
            "note": note,
        }
        incident_date = case.get("incident_date")
        if incident_date:
            try:
                parsed_date = (
                    incident_date
                    if isinstance(incident_date, date)
                    else date.fromisoformat(str(incident_date))
                )
            except ValueError:
                result["status"] = "invalid_incident_date"
            else:
                result["deadline_date"] = (
                    parsed_date + timedelta(hours=result["window_hours"])
                ).isoformat()
                result["status"] = "exact_incident_time_not_recorded"
        return result
    if calamity_type == "post_harvest_rain":
        return {
            "window_days": 14,
            "deadline_date": None,
            "status": "harvest_date_required",
            "note": note,
        }
    return {
        "window_hours": None,
        "deadline_date": None,
        "status": "event_window_not_determined",
        "note": note,
    }


def evaluate_case(case: dict, evidence_list: list[dict] | None = None) -> dict:
    evidence_list = evidence_list or []
    missing_fields = [
        label
        for field, label in _REQUIRED_FIELDS
        if _is_missing(case.get(field))
    ]
    if _is_missing(case.get("village")) and _is_missing(case.get("district")):
        missing_fields.append("Village or district")

    evidence_categories = {
        str(item.get("category", "")).casefold() for item in evidence_list
    }
    missing_evidence = []
    if not any(
        "photo" in category or "image" in category
        for category in evidence_categories
    ):
        missing_evidence.append("Dated photographs of the affected crop")
    if not any(
        "insurance" in category or "policy" in category
        for category in evidence_categories
    ):
        missing_evidence.append("Insurance enrollment or policy details")

    deadline_note = _deadline_note(case)
    return {
        "missing_fields": missing_fields,
        "missing_evidence": missing_evidence,
        "conditional_deadline_note": deadline_note,
        "deadline_evaluation": _deadline_evaluation(case, deadline_note),
        "official_reporting_channels": [
            "Krishi Rakshak Portal / National Helpline 14447",
            "Crop Insurance Mobile App (with geo-tagged photos)",
            "Concerned Bank branch (for loanee farmers)",
            "Local CSC / Agriculture Department officials",
        ],
        "policy_passages": retrieve_policies(
            case.get("calamity_type"), case.get("crop")
        ),
    }
