"""Every sentence the assistant can say without a model having written it.

These are the fallbacks — what a visitor reads when retrieval finds nothing,
when generation fails, when the rate limiter bites. They live together so that
the assistant's voice stays consistent across failures, and so that changing
how the firm sounds when it cannot answer is a one-file edit.

Deliberately no phone number or email address anywhere in this module. Those
already live in the frontend's data/consult.js, which is the single source of
truth for them; duplicating them here would create a second copy to go stale,
and the widget renders the real ones beneath any message that asks the visitor
to make contact.
"""

from __future__ import annotations

# Appended by the client to fallback answers rather than baked into each
# string, so the contact details it renders stay in one place.
CONTACT_INVITATION = "Please contact SLA Advocates directly and the firm will be glad to help."

# Retrieval ran and returned nothing above the similarity threshold. This is
# the single most important sentence in the service: it is what stands between
# a law firm's assistant and an invented answer.
NO_CONTEXT = (
    "I don't have enough verified information from SLA Advocates to answer that "
    "accurately, and I'd rather say so than guess."
)

# Every configured model failed. Retrieval may still have succeeded, in which
# case the chat service quotes the source instead of using this.
GENERATION_FAILED = "I'm temporarily unable to compose a reply."

# Nothing worked at all.
UNAVAILABLE = "I'm temporarily unable to respond."

RATE_LIMITED = (
    "You've sent several messages in quick succession. Please wait a moment "
    "before sending another."
)

# Shown when the visitor's question is a request for advice on their own
# situation. The assistant is not permitted to answer these substantively, and
# says why rather than deflecting silently.
LEGAL_ADVICE_REFERRAL = (
    "I can explain how SLA Advocates works and what the firm handles, but I'm "
    "not able to advise on your specific situation — that needs an advocate who "
    "can look at your documents and the facts."
)

# The quote-only fallback prefix, used when retrieval succeeded but no model
# could be reached. Frames the text as the site's own words rather than letting
# a raw chunk masquerade as a composed answer.
QUOTE_PREFIX = "I can't compose a full reply just now, but here is what SLA Advocates' own material says:"
