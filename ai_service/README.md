# SLA Advocates — AI Assistant

A retrieval-augmented assistant for the SLA Advocates website. It answers
questions about the firm using only the firm's own published content, and
declines when that content does not cover the question.

It is a separate FastAPI service. It does not touch the Django application in
`server/`, which continues to own authentication and the `account` app.

```
client/   React + Vite site          → components/chatbot, lib/chatApi.js
server/   Django (auth, unchanged)
ai_service/  this service               → FastAPI + Qdrant + Hugging Face
```

## Layout

```
app/
├── api/         routes + HTTP schemas — thin, validate and delegate
├── core/        config, logging, exceptions, security, metrics, types
├── rag/         retrieval (vector · keyword · rrf · reranker), ingestion,
│                context building, confidence scoring
├── llm/         provider abstraction, failover service, circuit breaker
├── conversation/ short-term memory and query rewriting
├── guardrails/  injection fencing and personal-matter detection
├── prompts/     the system prompt and RAG message assembly
├── clients/     Qdrant and the shared HTTP client
├── services/    orchestration: chat, diagnostics, admin indexing
└── evaluation/  the graded question set and its runner
```

Dependencies flow one way — `api → services → domain → clients` — with `core`
importable from anywhere and importing nothing. Only `core/config.py` reads the
environment. FastAPI appears only under `api/` and in `main.py`, so nothing in
the domain knows it is being served over HTTP.


## Why the knowledge base is generated, not written

The corpus is built from `client/src/data/*.js` — the same modules the website
renders. `npm run knowledge` in `client/` dumps them to
`data/knowledge.json`, and `app/rag/ingestion/` turns that
into chunks with metadata.

Nothing in this service authors a fact about the firm. A hand-written knowledge
base would be a second copy free to drift, and a stale claim about an advocate's
enrolment or a practice area's forums is not a cosmetic bug on a law firm's
site.

**After editing anything under `client/src/data/`:**

```bash
cd client && npm run knowledge     # regenerate the export
cd ../ai_service && python scripts/ingest.py       # re-embed and upsert
```

## Setup

Requires Python 3.14 (the version this was built and pinned against).

```bash
cd ai
python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements.txt
cp .env.example .env              # then fill in HF_TOKEN and the Qdrant values
```

> **Note for this repository's machine.** The project lives inside a OneDrive
> folder, and OneDrive's sync corrupted a `.venv` created in place — it removed
> `python.exe` mid-install. The environment in use was created outside the synced
> tree instead (`%LOCALAPPDATA%\sla-ai-venv`). Either works; if you create the
> venv here and installs fail with `OSError: [Errno 2]` on a `.tmp` file inside
> `site-packages`, that is what you are hitting.

### Index the knowledge base

```bash
python scripts/ingest.py                      # create if needed, upsert all
python scripts/ingest.py --dry-run            # chunk and report, call nothing
python scripts/reindex.py                     # drop and recreate the collection
```

Chunk ids are a deterministic hash of their key, so a normal run overwrites
points in place — running it twice does not produce two copies of the corpus.
`--rebuild` is only needed when changing the embedding model, because a
collection's vector width is fixed at creation.

Only `QDRANT_COLLECTION` is ever touched. Nothing in this service lists or
deletes any other collection, which matters if the cluster is shared.

### Run

```bash
uvicorn app.main:app --reload --port 8001
```

Then set `VITE_AI_API_URL=http://127.0.0.1:8001` in `client/.env`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | Ask a question |
| `GET /api/chat/opening` | Greeting and opening suggestions |
| `GET /api/health` | Reports the vector store and model configuration |

## How an answer is produced

```
question
   ↓  validate (length, shape, no unknown fields)
   ↓  rate limit (per minute and per day, on a hashed client key)
   ↓  fold in recent conversation for short follow-ups
   ↓  embed  ──────────────► Hugging Face feature-extraction
   ↓  search ──────────────► Qdrant, with a cosine score threshold
   ↓  build prompt: system rules │ history │ reference material │ question
   ↓  generate ────────────► Hugging Face chat completions
   ↓  check the completion for leaked prompt markers
answer + sources + follow-up suggestions
```

### The fallback chain

Each layer degrades what the assistant can *say* without ever degrading what it
is allowed to say it *from*.

| What failed | What happens |
| --- | --- |
| Primary chat model | The secondary model is tried |
| Embedding endpoint | BM25 over the same corpus, in memory |
| Qdrant | Same — lexical retrieval |
| Every chat model | The top passage is quoted verbatim, framed as a quote |
| Nothing scored above threshold | "I don't have enough verified information…" |
| Everything | A professional message pointing to the firm |

There is deliberately **no** layer where the model answers without retrieved
context. That is the obvious extra fallback and it is exactly the one a law firm
cannot have — it is the configuration in which a chatbot invents an enrolment
number.

## Hallucination control

- `RAG_SCORE_THRESHOLD` discards weak matches; a question that retrieves nothing
  is declined rather than sent to the model bare.
- The lexical fallback additionally requires a share of the query's own terms to
  be present (`MIN_TERM_COVERAGE`). Without it, "capital **city** of Brazil"
  matches "City Civil Courts" and normalisation promotes that to a perfect
  score — the assistant would answer about banking litigation.
- Illustrative matters carry their confidentiality disclaimer inside *every*
  chunk, because a chunk is retrieved alone and a summary without its caveat is
  how an example gets restated as a real case.
- Completions are checked for system-prompt markers and discarded if found.

## Security

- **Prompt injection.** The visitor's text never enters a system message. It
  arrives as a user turn inside an explicit fence, introduced as quoted data;
  fence markers are stripped from input. The privileged instructions are a
  constant no request can reach.
- **Secrets.** `HF_TOKEN` and `QDRANT_API_KEY` are read by this service only.
  Nothing is exposed to the browser — the client learns only this service's URL,
  via `VITE_AI_API_URL`. Every `VITE_` value is inlined into the public bundle,
  so no credential may ever be named with that prefix.
- **CORS.** Exact origins only, never a wildcard. Production refuses to start
  with an empty origin list.
- **Errors.** Visitors see one of the canned strings in `app/core/messages.py`.
  Upstream status codes, provider names, model ids and stack traces go to logs
  and stop there. FastAPI's default validation handler is replaced, because it
  would echo the visitor's own text back in the response body.
- **Logs.** Never the message text, the answer text, credentials, or raw IP
  addresses — the rate limiter hashes the client key before it is stored or
  logged. What is recorded is the shape of a request: length, chunk count, top
  score, which fallback answered, durations.
- **XSS.** The client renders answers as text nodes. There is no
  `dangerouslySetInnerHTML` anywhere in the chatbot.

## Known limitation: single process

Conversation memory and rate-limit counters are in-process. With N workers, a
conversation is only remembered by the worker that served it, and the effective
rate limit is N times the configured one.

This is a deliberate trade: the project has no Redis, and adding one to hold a
bounded, disposable, hour-long cache would be new infrastructure to operate for
no gain at this scale. **Run with a single worker**, or replace the internals of
`conversation/memory.py` and `core/rate_limit.py` with Redis — both are
small classes with two-method interfaces precisely so that stays a small change.

## Tests

```bash
python -m pytest
```

85 tests. Nothing calls Hugging Face or Qdrant — both are replaced with fakes
that can be told to fail, because the fallback chain is the feature and a suite
that only exercised the happy path would not cover it.
