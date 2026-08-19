// Exports the firm's content from src/data/*.js to a JSON file the AI service
// reads. Run with `npm run knowledge` after editing anything under src/data.
//
// The point of this script is that there is only ever one copy of what the firm
// says about itself. The pages render src/data/*.js; the assistant answers from
// this export of the same modules. A second, hand-written knowledge base in the
// Python service would be a copy free to drift — and on a law firm's site, a
// stale claim about an advocate's enrolment or a practice area's forums is not
// a cosmetic bug.
//
// This script is deliberately dumb: it dumps the data verbatim and shapes
// nothing. Deciding what becomes a retrievable document, how it is chunked and
// what metadata it carries is the AI service's job, in app/knowledge/documents.py.
// Keeping the transform on that side means retrieval can be re-tuned without
// anyone touching the website's own content modules.
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { stats, firmStory, philosophy, principles, process, office, manifesto, communityService } from '../src/data/firm.js';
import { practiceAreas } from '../src/data/practiceAreas.js';
import { team } from '../src/data/team.js';
import { industries } from '../src/data/industries.js';
import { credentials, barCouncilEnrollments, milestones, recognitionQuote, record, forums } from '../src/data/awards.js';
import { landmarkCases, disclaimer } from '../src/data/landmarkCases.js';
import { consult } from '../src/data/consult.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The AI service keeps generated data outside its source tree, so this writes
// to ai_service/data/ rather than into app/. If this path ever stops matching
// `DATA_FILE` in app/rag/ingestion/loader.py, the export silently succeeds
// while the service keeps serving the previous corpus — so the two are worth
// changing together.
const OUT = path.join(HERE, '..', '..', 'ai_service', 'data', 'knowledge.json');

// Committed alongside the service, so the AI side never needs Node installed to
// build or deploy — only to regenerate.
const payload = {
  // Stamped so a retrieved chunk can tell the visitor how current the firm
  // information behind an answer is, and so a stale export is visible rather
  // than silent. Date-only: the time of day carries no meaning here and would
  // produce a diff on every run.
  generated_at: new Date().toISOString().slice(0, 10),
  firm: { stats, firmStory, philosophy, principles, process, office, manifesto, communityService },
  practiceAreas,
  team,
  industries,
  recognition: { credentials, barCouncilEnrollments, milestones, recognitionQuote, record, forums },
  landmarkCases: { disclaimer, cases: landmarkCases },
  contact: consult,
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

const counts = {
  'practice areas': practiceAreas.length,
  advocates: team.length,
  industries: industries.length,
  milestones: milestones.length,
  'landmark matters': landmarkCases.length,
};

console.log(`write ${path.relative(path.join(HERE, '..', '..'), OUT)}`);
for (const [label, n] of Object.entries(counts)) console.log(`  ${String(n).padStart(3)}  ${label}`);
console.log('\nRe-run the AI service indexer to publish these to Qdrant:');
console.log('  cd ai_service && python scripts/ingest.py');
