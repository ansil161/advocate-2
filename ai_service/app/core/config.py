"""Service configuration, resolved once from the environment at import time.

Every tunable the assistant has lives here and nowhere else. Nothing in the
package reads ``os.environ`` directly — a setting that is not on this model
does not exist, which is what makes .env.example a complete description of how
the service can be configured.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# The .env sits at the service root, one level above this package. Resolved
# from __file__ rather than the working directory so that the service behaves
# identically whether it is started from ai/, from the repo root, or by a
# process manager with no meaningful cwd at all.
SERVICE_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SERVICE_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Hugging Face ─────────────────────────────────────────────────────────
    # Embeddings live here permanently. The Qdrant collection's vector width is
    # fixed at creation to match this model, so changing it is a re-index of the
    # whole corpus rather than a configuration edit. Generation is a separate
    # question and is answered by GEMINI_* below.
    hf_token: str = ""
    hf_api_base: str = "https://router.huggingface.co"
    hf_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    hf_embedding_dim: int = 384
    # Kept as the generation fallback for when Gemini is unavailable.
    hf_chat_model: str = "meta-llama/Llama-3.3-70B-Instruct"
    hf_chat_model_fallback: str = "Qwen/Qwen2.5-7B-Instruct"

    # ── Gemini (primary generation + default embeddings) ─────────────────────
    gemini_api_key: str = ""
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-3.5-flash"
    gemini_model_fallback: str = "gemini-3.5-flash-lite"

    # Gemini 3.x models reason before answering, and those reasoning tokens are
    # billed against the SAME maxOutputTokens ceiling as the reply. That makes
    # the ceiling a shared budget rather than an answer length, and the reply is
    # what gets cut when it runs out.
    #
    # "low" is the floor that both configured models accept. Measured directly
    # against this service's own prompt: gemini-3.5-flash spends 236–783
    # reasoning tokens per answer at "low" (610–783 on ordinary knowledge
    # questions), and gemini-3.5-flash-lite spends none. Setting
    # thinkingBudget=0 instead switches reasoning off entirely on -flash but is
    # rejected outright by -flash-lite with HTTP 400, which would take the
    # fallback model offline — so the level, not the budget, is what is sent.
    #
    # Restating retrieved passages in a fixed register does not benefit from
    # extended reasoning; it only costs latency and truncated replies.
    gemini_thinking_level: str = "low"

    # Added to LLM_MAX_OUTPUT_TOKENS for Gemini only, to cover the reasoning
    # described above. Keeping it separate is what lets LLM_MAX_OUTPUT_TOKENS
    # keep meaning "how long may the answer be" for every provider, instead of
    # silently meaning something different on the one that reasons.
    #
    # 900 clears the 783-token worst case measured above with room to spare.
    # If it is ever set too low the symptom is a reply that stops mid-sentence,
    # which is exactly what this setting exists to prevent.
    gemini_thinking_headroom_tokens: int = Field(default=900, ge=0, le=8192)

    # 768 rather than the full 3072: a quarter of the memory per point at
    # indistinguishable quality on a corpus this size. Sub-3072 vectors come
    # back un-normalised, which the embedder corrects.
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_embedding_dim: int = Field(default=768, ge=128, le=3072)

    # ── Embeddings ───────────────────────────────────────────────────────────
    # Which vendor turns text into vectors. This is the one setting that cannot
    # be changed in isolation: a collection's vector width is fixed at creation,
    # so switching providers (or dimensions) requires
    # `scripts/index_knowledge.py --rebuild` and re-embeds the whole corpus.
    # Queries must be embedded by the same model that indexed the documents, or
    # they land in a different space and every score is meaningless.
    embedding_provider: str = "gemini"

    # ── Groq (failover generation) ───────────────────────────────────────────
    # Speaks the OpenAI chat-completions dialect, so it is served by the generic
    # client rather than by a vendor-specific one. Pointing GROQ_API_BASE at
    # OpenAI or any compatible host works without code changes.
    groq_api_key: str = ""
    groq_api_base: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"
    groq_model_fallback: str = "llama-3.1-8b-instant"

    # Generation backends in the order they are tried. Names are resolved in
    # main.py; an unknown or unconfigured entry is skipped with a warning rather
    # than raised, so a half-provisioned deployment degrades instead of failing
    # to boot.
    llm_provider_order: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["gemini", "groq", "huggingface"]
    )

    # ── Circuit breaker ──────────────────────────────────────────────────────
    # Three consecutive failures is enough to distinguish a real outage from one
    # unlucky request, and 30s is short enough that a brief blip self-heals
    # within a single visitor's conversation.
    circuit_failure_threshold: int = Field(default=3, ge=1, le=20)
    circuit_cooldown_seconds: float = Field(default=30.0, gt=0)

    # ── Qdrant ───────────────────────────────────────────────────────────────
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "sla_knowledge"

    # ── Retrieval ────────────────────────────────────────────────────────────
    rag_top_k: int = Field(default=5, ge=1, le=20)
    # THIS NUMBER IS MODEL-SPECIFIC. It is the hallucination brake — a question
    # whose best chunk scores below it retrieves nothing and is answered with
    # "I don't have that information" rather than from whatever came closest.
    #
    # 0.58 is calibrated for gemini-embedding-001 at 768 dimensions, measured
    # against the real 63-chunk corpus with 15 on-topic and 12 off-topic
    # questions:
    #
    #     off-topic  max 0.5349   (capital of Brazil, football, sourdough)
    #     on-topic   min 0.6439   (a clean 0.109 gap)
    #
    # 0.58 sits mid-gap. Every value in 0.55–0.62 scored 15/15 on-topic kept
    # and 12/12 off-topic blocked; the midpoint was chosen for margin on both
    # sides rather than for the number itself.
    #
    # The previous default of 0.30 was calibrated for all-MiniLM-L6-v2, whose
    # scores run far lower. Carrying it over to Gemini left the brake disabled:
    # "what is the capital of Brazil" retrieved five chunks at ~0.49 and would
    # have been answered from them. If EMBEDDING_PROVIDER or the embedding
    # model changes, this MUST be re-measured — a stale threshold fails silently
    # and in the dangerous direction.
    rag_score_threshold: float = Field(default=0.58, ge=0.0, le=1.0)
    rag_max_context_chars: int = Field(default=6000, ge=500)

    # ── Hybrid retrieval ─────────────────────────────────────────────────────
    # Candidates fetched per branch before fusion. Wider than RAG_TOP_K on
    # purpose: fusion and reranking can only reorder what retrieval handed them,
    # so the branch limit is the real ceiling on what the answer can be built
    # from. 25 over a 63-chunk corpus is generous without being the whole corpus.
    rag_candidates: int = Field(default=25, ge=1, le=100)

    # RRF damping. Lower lets a single branch's first place dominate; higher
    # weights agreement between branches more heavily. 60 is the value from the
    # original RRF paper and is a sane default rather than a tuned one.
    rag_rrf_k: int = Field(default=60, ge=1, le=1000)

    # "none" or "llm". Off by default: the LLM reranker adds a full generation
    # round trip to every knowledge question, which is a real latency cost to
    # accept deliberately rather than inherit.
    rag_reranker: str = "none"

    # ── Confidence policy ────────────────────────────────────────────────────
    # Both are on the same 0..1 scale as cosine similarity, and both were set
    # from the measured distribution behind RAG_SCORE_THRESHOLD: on-topic
    # questions score 0.6439–0.8020, off-topic peak at 0.5349.
    #
    # HIGH needs a clearly strong match — 0.70 sits in the upper half of the
    # observed on-topic range — *and* independent support, either from both
    # retrieval branches agreeing or from two different source documents.
    rag_confidence_high: float = Field(default=0.70, ge=0.0, le=1.0)
    # What counts as a "supporting" chunk when tallying corroboration. Just
    # below the on-topic floor of 0.6439, so a genuine second match counts and
    # a near-miss does not.
    rag_support_floor: float = Field(default=0.62, ge=0.0, le=1.0)

    # Chunks any single source document may contribute before others get a
    # turn. Stops one long advocate profile from consuming the whole context
    # budget on a question the Team index would have answered.
    rag_max_chunks_per_document: int = Field(default=2, ge=1, le=10)

    # ── Conversation and limits ──────────────────────────────────────────────
    chat_max_message_chars: int = Field(default=1000, ge=1)
    chat_history_turns: int = Field(default=6, ge=0, le=20)
    chat_conversation_ttl_seconds: int = Field(default=3600, ge=60)
    llm_max_output_tokens: int = Field(default=500, ge=32)
    llm_timeout_seconds: float = Field(default=30.0, gt=0)
    embedding_timeout_seconds: float = Field(default=20.0, gt=0)

    # ── Redis ────────────────────────────────────────────────────────────────
    # Shared state for rate limiting, conversation memory and the metrics
    # window. Optional: unset, or set but unreachable at startup, falls back to
    # per-process state and says so on /health.
    #
    # The consequence of leaving it unset is concrete, not theoretical: with N
    # workers the rate limit becomes N times the configured one, and a visitor's
    # follow-up is only understood if it lands on the worker that answered the
    # first message.
    redis_url: str = ""

    # ── Abuse protection ─────────────────────────────────────────────────────
    rate_limit_per_minute: int = Field(default=10, ge=1)
    rate_limit_per_day: int = Field(default=200, ge=1)

    # ── Service ──────────────────────────────────────────────────────────────
    # NoDecode because pydantic-settings JSON-decodes list fields inside the
    # .env source, before any validator runs — without it the natural
    # `a,b` form raises at startup and the only accepted syntax would be a JSON
    # array inside a shell-sourced file.
    cors_allow_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Only enable behind a reverse proxy that overwrites X-Forwarded-For. With
    # this on and no such proxy, any caller can pick their own rate-limit
    # bucket by sending the header themselves.
    trust_proxy_headers: bool = False
    # Shared secret for the /internal indexing API that Django calls. Unset
    # closes that API rather than opening it — the opposite default is how an
    # internal endpoint ends up publicly writable on the one deployment that
    # forgot to set it.
    internal_api_key: str = ""
    log_level: str = "INFO"
    environment: str = "development"

    @field_validator("cors_allow_origins", "llm_provider_order", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept the comma-separated form a .env file can actually express.

        pydantic-settings parses a ``list[str]`` field as JSON, so the natural
        ``a,b`` in an env file would otherwise raise at startup and force the
        operator to write a JSON array in a shell-sourced file.
        """
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    @property
    def uses_gemini_embeddings(self) -> bool:
        return self.embedding_provider.strip().lower() == "gemini"

    @property
    def embedding_dim(self) -> int:
        """The collection's vector width, following whichever provider is active.

        Single source of truth: the indexer creates the collection at this size
        and the health check reports it, so the two cannot disagree.
        """
        return self.gemini_embedding_dim if self.uses_gemini_embeddings else self.hf_embedding_dim

    @property
    def embeddings_configured(self) -> bool:
        """Whether a query can be turned into a vector at all.

        This gates both retrieval and the indexer. Without it there is no
        vector search — the assistant falls back to lexical matching over the
        same corpus, and `scripts/index_knowledge.py` cannot run at all.

        Checked rather than asserted: a missing credential must degrade the
        assistant to its grounded fallbacks and a clear health signal, not
        crash the service on boot and take the whole endpoint offline.
        """
        if self.uses_gemini_embeddings:
            return self.gemini_configured
        return bool(self.hf_token.strip())

    # Specifically "does Hugging Face have a token", which is what the Hugging
    # Face client gates both of its calls on. Deliberately NOT an alias for
    # `embeddings_configured`: once embeddings moved to Gemini those two answer
    # different questions, and conflating them would let the HF client believe
    # it was credentialed because Gemini was.
    @property
    def llm_configured(self) -> bool:
        return bool(self.hf_token.strip())

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key.strip())

    @property
    def generation_configured(self) -> bool:
        """Whether any generation provider has credentials.

        Distinct from `embeddings_configured`: with embeddings but no
        generation the assistant still retrieves correctly and quotes the
        firm's own text, which is a genuinely useful degraded mode rather than
        an outage.
        """
        return self.gemini_configured or self.groq_configured or self.embeddings_configured

    @property
    def vector_store_configured(self) -> bool:
        return bool(self.qdrant_url.strip() and self.qdrant_api_key.strip())

    @property
    def chat_models(self) -> tuple[str, ...]:
        """Generation models in the order they should be tried.

        De-duplicated and emptiness-filtered so that leaving the fallback blank,
        or setting it to the same model as the primary, costs one attempt rather
        than two identical ones.
        """
        return _ordered_unique(self.hf_chat_model, self.hf_chat_model_fallback)

    @property
    def gemini_models(self) -> tuple[str, ...]:
        """Gemini models in the order they should be tried, same rules as above."""
        return _ordered_unique(self.gemini_model, self.gemini_model_fallback)

    @property
    def groq_models(self) -> tuple[str, ...]:
        return _ordered_unique(self.groq_model, self.groq_model_fallback)


def _ordered_unique(*values: str) -> tuple[str, ...]:
    """Strip, drop empties, de-duplicate, keep order.

    Leaving a fallback blank, or setting it to the same model as the primary,
    should cost one attempt rather than two identical ones.
    """
    seen: list[str] = []
    for value in values:
        cleaned = value.strip()
        if cleaned and cleaned not in seen:
            seen.append(cleaned)
    return tuple(seen)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached accessor, so the .env is read once per process.

    Exposed as a callable rather than a module-level instance so tests can
    clear the cache and re-resolve with a patched environment.
    """
    return Settings()
