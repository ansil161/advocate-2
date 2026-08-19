"""Input guardrail: recognising when a question is about the visitor's own case.

Separate from ``injection.py`` because it guards against a completely different
failure. Injection is someone trying to seize the assistant; this is someone in
trouble asking a law firm's website what to do about it — and the danger is that
a helpful-sounding answer is unlicensed legal advice.

This is not a filter. The reply still comes from the model; what this decides is
whether an extra instruction is appended to the turn, so that the safe behaviour
does not depend solely on the model having weighted a rule fifty lines up in the
system prompt. It also decides whether the retrieval layer guarantees the
firm's contact details into context — an instruction to give someone the phone
number is unsatisfiable if the phone number was never retrieved.
"""

from __future__ import annotations

import re

# Phrases that mark a question as being about the visitor's own matter rather
# than about the firm.
_PERSONAL_MATTER_RE = re.compile(
    r"\b(?:"
    r"i (?:was|am|have been|got|need|should)\b"
    r"|my (?:case|matter|husband|wife|son|daughter|father|mother|land|property|company|employer|landlord|tenant)\b"
    r"|(?:what|how) (?:should|do) i\b"
    r"|can i (?:sue|file|claim|appeal|challenge)\b"
    r"|(?:arrested|bail|fir|notice|summons|evicted|terminated|sacked|cheated|fraud)\b.{0,40}\b(?:me|my|us)\b"
    r")",
    re.IGNORECASE,
)

# Appended to the user turn when the above matches.
#
# Phrased as constraints on the reply rather than as a checklist of steps. Given
# a numbered procedure the models tended to narrate their compliance with it —
# one reply opened "(with phone number immediately due to urgency):*" — which
# reads to a distressed visitor as the assistant talking about them rather than
# to them. The last sentence exists purely to suppress that.
PERSONAL_MATTER_ADVISORY = (
    "\n\nThis question is about the visitor's own situation. Do not assess it, "
    "advise on it, or suggest what they should do. Acknowledge it briefly and warmly, "
    "name the relevant practice area only if the reference material supports it, and "
    "direct them to contact the firm. "
    "Write only the words you would say to them — no stage directions, no notes about "
    "what you are doing, no labels or parentheticals describing your own reply."
)


def looks_like_personal_matter(message: str) -> bool:
    return bool(_PERSONAL_MATTER_RE.search(message))
