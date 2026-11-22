import json
import re
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
POLICY_DATA_PATH = BACKEND_DIR / "data" / "seed_policies.json"
GUIDELINES_PDF_PATH = BACKEND_DIR / "data" / "pmfby_guidelines.pdf"
SOURCE_URL = "https://pmfby.gov.in/"


def _load_policy_chunks() -> list[dict]:
    with POLICY_DATA_PATH.open(encoding="utf-8") as policy_file:
        chunks = json.load(policy_file)

    if GUIDELINES_PDF_PATH.exists():
        import fitz

        with fitz.open(GUIDELINES_PDF_PATH) as document:
            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text").strip()
                if not text:
                    continue
                chunks.append(
                    {
                        "id": f"pmfby-guidelines-page-{page_number}",
                        "title": f"PMFBY Operational Guidelines, page {page_number}",
                        "publisher": "Ministry of Agriculture & Farmers Welfare, Govt. of India",
                        "version_note": "PMFBY Operational Guidelines",
                        "source_url": SOURCE_URL,
                        "page_number": page_number,
                        "keywords": re.findall(r"\w+", text.casefold()),
                        "text": text,
                    }
                )

    return chunks


_POLICY_CHUNKS = _load_policy_chunks()


def _score_policy(chunk: dict, query_terms: list[str]) -> int:
    searchable_text = " ".join(
        [
            str(chunk.get("title", "")),
            str(chunk.get("text", "")),
            " ".join(str(keyword) for keyword in chunk.get("keywords", [])),
        ]
    ).casefold()
    score = 0
    for term in query_terms:
        normalized_term = term.strip().replace("_", " ").casefold()
        if normalized_term and normalized_term in searchable_text:
            score += 2
            continue
        score += sum(
            1
            for word in normalized_term.split()
            if len(word) > 2 and word in searchable_text
        )
    return score


def retrieve_policies(
    calamity_type: str | None, crop: str | None
) -> list[dict]:
    query_terms = [term for term in (calamity_type, crop) if term]
    ranked_chunks = sorted(
        _POLICY_CHUNKS,
        key=lambda chunk: _score_policy(chunk, query_terms),
        reverse=True,
    )
    return [dict(chunk) for chunk in ranked_chunks[:3]]


def get_guidance_for_case(
    case: dict, evidence_list: list[dict], stories: list[dict]
) -> dict:
    from .rules_engine import evaluate_case

    evaluation = evaluate_case(case, evidence_list)
    calamity = str(case.get("calamity_type") or "").casefold()
    crop = str(case.get("crop") or "").casefold()
    matched_stories = []
    for story in stories:
        story_calamities = {
            str(tag).casefold() for tag in story.get("calamity_tags", [])
        }
        story_crops = {str(tag).casefold() for tag in story.get("crop_tags", [])}
        is_match = bool(
            (calamity and calamity in story_calamities)
            or (crop and crop in story_crops)
        )
        matched_stories.append(
            {
                **story,
                "match_reason": (
                    "Best Match for Your Case — matches reported calamity/crop"
                    if is_match
                    else "Verified PMFBY Public Account — Reference Example"
                ),
            }
        )

    return {
        "deadline_evaluation": evaluation["deadline_evaluation"],
        "conditional_deadline_note": evaluation["conditional_deadline_note"],
        "missing_info": {
            "fields": evaluation["missing_fields"],
            "evidence": evaluation["missing_evidence"],
        },
        "missing_fields": evaluation["missing_fields"],
        "missing_evidence": evaluation["missing_evidence"],
        "channels": evaluation["official_reporting_channels"],
        "policies": evaluation["policy_passages"],
        "matched_stories": matched_stories,
    }
