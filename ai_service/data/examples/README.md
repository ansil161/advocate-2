# Example payloads

Sample inputs for the service's own APIs, useful when exercising an endpoint by
hand or when writing a new test.

`knowledge.json` — the real corpus — sits one level up in `data/`. It is
**generated**, not authored: run `npm run knowledge` in `client/` to regenerate
it from the website's own `src/data/*.js`, then `python scripts/ingest.py` to
publish it to Qdrant. Never edit it directly; the edit would be overwritten on
the next export and would put a firm fact in a second place.
