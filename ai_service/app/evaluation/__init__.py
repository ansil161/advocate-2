"""RAG evaluation: a fixed question set and a runner that grades the live pipeline."""

from app.evaluation.dataset import CASES, CATEGORIES, EvalCase, Expect, cases_for
from app.evaluation.runner import MODE_FULL, MODE_RETRIEVAL, CaseResult, EvalReport, run_evaluation

__all__ = [
    "CASES",
    "CATEGORIES",
    "EvalCase",
    "Expect",
    "cases_for",
    "CaseResult",
    "EvalReport",
    "run_evaluation",
    "MODE_FULL",
    "MODE_RETRIEVAL",
]
