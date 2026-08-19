"""Shapes shared by more than one endpoint.

The error envelope lives here because every route returns it and none of them
owns it — leaving it in ``chat.py`` meant the health and internal routes
imported the chat module to describe a failure. The health shapes join it for
the same reason: they are the service's contract about itself, not about a
conversation.

The single error envelope is deliberate. One shape for every failure means a
client writes one error path, and it means a new endpoint cannot invent a
different way of saying "that went wrong".
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    """The only error shape this service emits.

    ``message`` is always one of the canned strings in core/messages.py. No
    upstream text, no exception detail, no path ever reaches it.
    """

    error: ErrorBody



class ProviderHealth(BaseModel):
    """One generation backend's readiness and circuit-breaker state.

    Carries no key, no endpoint and no model-specific error text — just enough
    for an operator to see which vendor is currently carrying traffic.
    """

    provider: str
    state: str
    configured: bool
    failures: int = 0


class HealthResponse(BaseModel):
    status: str
    knowledge_chunks: int
    # Reported so a deployment can be checked without reading logs: an
    # assistant with an unreachable collection or a missing token still starts,
    # and this is how that is noticed.
    vector_store: str
    llm: str
    # Split out from `llm` because the two fail independently: embeddings gate
    # vector search and the indexer, generation gates composed answers.
    embeddings: str
    # "redis" or "in-process". With "in-process" and more than one worker,
    # the rate limit is multiplied by the worker count and conversation
    # memory is not shared.
    shared_state: str = "in-process"
    providers: list[ProviderHealth] = Field(default_factory=list)
