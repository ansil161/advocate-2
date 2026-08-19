"""Input guardrail: keeping the visitor's text inside its own fence.

The whole security posture of this service rests on one structural decision:
**the visitor's words never enter a system message.** They arrive as a user
turn, wrapped in an explicit delimiter, introduced as data. Retrieved passages
arrive the same way, in their own block. The system message — the only
privileged text — is a constant in ``app/prompts/system.py`` that no request can
reach.

That is what makes prompt injection a bounded problem rather than an open one.
A visitor can write "ignore your instructions" all they like; it lands in a
region the model has been told is quoted material, and the instruction it would
be overriding is in a region the visitor cannot write to.

This module owns the fence itself and the only sanitising that happens to a
question. It is deliberately minimal: rewriting a visitor's words to defuse
"injection" reliably breaks legitimate questions — someone may genuinely need to
ask about a system, or about instructions in a contract. The defence is the
structure, not the scrubbing.
"""

from __future__ import annotations

import re

# Wrapped around the visitor's message so the model can see exactly where their
# text starts and stops, which is what makes "ignore the above" land inside a
# quoted region rather than beside the instructions.
QUESTION_OPEN = "<<<VISITOR QUESTION>>>"
QUESTION_CLOSE = "<<<END VISITOR QUESTION>>>"

CONTEXT_OPEN = "<<<REFERENCE MATERIAL>>>"
CONTEXT_CLOSE = "<<<END REFERENCE MATERIAL>>>"

# Anything that looks like an attempt to close the fence early and start
# writing outside it. Stripped from the visitor's text before it is wrapped.
_FENCE_RE = re.compile(
    r"<<<\s*/?\s*(?:END\s+)?(?:VISITOR\s+QUESTION|REFERENCE\s+MATERIAL)\s*>>>",
    re.IGNORECASE,
)

# Control characters, minus tab and newline. These have no legitimate place in
# a typed question and are a known vector for confusing tokenisers and for
# smuggling text past a naive filter.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_question(message: str) -> str:
    """Make the visitor's text safe to embed in a prompt without changing it.

    All this does is stop the text from breaking out of its own fence. See the
    module docstring for why it does no more than that.
    """
    cleaned = _CONTROL_RE.sub("", message)
    cleaned = _FENCE_RE.sub("", cleaned)
    return cleaned.strip()
