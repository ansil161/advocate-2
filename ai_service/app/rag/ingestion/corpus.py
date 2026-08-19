"""Composing the firm's website content into retrievable documents.

One builder per area of the site — firm, practice areas, team, industries,
recognition, matters, contact — each turning the exported data into ``_Document``
objects with their own heading, category, source page and keyword line.

This is the largest file in the ingestion path and deliberately so: it is a
*specification of the corpus*, not an algorithm. Splitting it further by
mechanical size would separate each builder from the shape of the data it reads
without making any of them easier to understand.

What it does not do is invent facts. Every string here is either interpolated
from the export or is connective prose. A number that is not in the export must
not appear in a chunk — see ``_slot_split`` for what happens when a derived
detail stops agreeing with its source.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.rag.ingestion.chunker import KnowledgeChunk, split_body
from app.rag.ingestion.cleaner import _clean, _join
from app.rag.ingestion.loader import load_payload


@dataclass
class _Document:
    """A logical document before it is split into chunks.

    ``header`` is repeated onto every chunk the body produces; ``body`` is what
    actually gets split. Private to this module: it is the intermediate shape
    the builders below work in, and nothing outside ingestion should depend on
    it — the corpus is published as ``KnowledgeChunk``.
    """

    key: str
    title: str
    category: str
    document: str
    section: str
    url: str
    header: str
    body: str
    keywords: list[str] = field(default_factory=list)



def _firm_documents(payload: dict[str, Any]) -> list[_Document]:
    firm = payload.get("firm", {})
    docs: list[_Document] = []

    story = firm.get("firmStory", {})
    if story:
        docs.append(
            _Document(
                key="firm/story",
                title="About SLA Advocates — the firm's story",
                category="firm",
                document="About",
                section="Our Story",
                url="/about#a-story",
                header="About SLA Advocates, a litigation firm in Hyderabad, Telangana.",
                body=_join([_clean(story.get("title")), *[_clean(p) for p in story.get("paragraphs", [])]], "\n"),
                keywords=["history", "founded", "founder", "story", "origin"],
            )
        )

    philosophy = firm.get("philosophy", {})
    if philosophy:
        points = "\n".join(
            f"{_clean(p.get('title'))}: {_clean(p.get('body'))}" for p in philosophy.get("points", [])
        )
        docs.append(
            _Document(
                key="firm/philosophy",
                title="SLA Advocates' philosophy and approach",
                category="firm",
                document="About",
                section="Our Philosophy",
                url="/about#a-philosophy",
                header="SLA Advocates' philosophy and how the firm works.",
                body=_join([_clean(philosophy.get("title")), _clean(philosophy.get("statement")), points], "\n"),
                keywords=["philosophy", "approach", "values", "how they work"],
            )
        )

    principles = firm.get("principles", [])
    if principles:
        docs.append(
            _Document(
                key="firm/principles",
                title="The principles SLA Advocates works by",
                category="firm",
                document="About",
                section="Principles",
                url="/about#a-principles",
                header="The four principles SLA Advocates works by.",
                body="\n".join(f"{_clean(p.get('title'))}: {_clean(p.get('body'))}" for p in principles),
                keywords=["principles", "standards", "evidence", "execution"],
            )
        )

    steps = firm.get("process", [])
    if steps:
        docs.append(
            _Document(
                key="firm/process",
                title="What happens when you engage SLA Advocates",
                category="firm",
                document="Contact",
                section="What Happens Next",
                url="/contact#c-process",
                header="The four stages of working with SLA Advocates, from first consultation onward.",
                body="\n".join(f"{_clean(s.get('title'))}: {_clean(s.get('desc'))}" for s in steps),
                keywords=["process", "consultation", "what happens", "engage", "steps"],
            )
        )

    office = firm.get("office", {})
    if office:
        docs.append(
            _Document(
                key="firm/office",
                title="SLA Advocates' office",
                category="firm",
                document="About",
                section="The Office",
                url="/about#a-built",
                header="SLA Advocates' office and facilities.",
                body=_join(
                    [
                        f"The firm works out of a {_clean(office.get('size'))} office in {_clean(office.get('city'))}, built for active litigation.",
                        "Facilities: " + ", ".join(_clean(f) for f in office.get("features", [])) + ".",
                    ],
                    "\n",
                ),
                keywords=["office", "chambers", "location", "facilities", "hyderabad"],
            )
        )

    stats = firm.get("stats", [])
    if stats:
        lines = [
            f"{_clean(s.get('value'))}{_clean(s.get('suffix'))} — {_clean(s.get('label'))} ({_clean(s.get('sub'))})."
            for s in stats
        ]
        docs.append(
            _Document(
                key="firm/record",
                title="SLA Advocates by the numbers",
                category="firm",
                document="Recognition",
                section="The Record",
                url="/awards#aw-record",
                header="SLA Advocates' experience in figures.",
                body="\n".join(lines),
                keywords=["experience", "years", "cases", "success rate", "how many", "record"],
            )
        )

    community = firm.get("communityService", {})
    if community:
        docs.append(
            _Document(
                key="firm/community",
                title="SLA Advocates and community service",
                category="firm",
                document="About",
                section="Community",
                url="/about#a-community",
                header="SLA Advocates' community and pro bono commitments.",
                body=_join([_clean(community.get("title")), _clean(community.get("body"))], "\n"),
                keywords=["community", "pro bono", "under-privileged", "constitutional rights"],
            )
        )

    manifesto = firm.get("manifesto", {})
    if manifesto.get("lines"):
        docs.append(
            _Document(
                key="firm/manifesto",
                title="SLA Advocates' manifesto",
                category="firm",
                document="Home",
                section="Manifesto",
                url="/#manifesto",
                header="What SLA Advocates says about the way it practises.",
                body="\n".join(_clean(line) for line in manifesto["lines"]),
                keywords=["manifesto", "beliefs"],
            )
        )

    return docs


def _practice_documents(payload: dict[str, Any]) -> list[_Document]:
    docs: list[_Document] = []
    areas = payload.get("practiceAreas", [])

    # An index document, so "what areas of law do you handle" retrieves the
    # whole list rather than whichever single area happens to score highest.
    if areas:
        docs.append(
            _Document(
                key="practice/index",
                title="The areas of law SLA Advocates handles",
                category="practice-area",
                document="Practice Areas",
                section="Index",
                url="/practice",
                header=f"SLA Advocates practises across {len(areas)} areas of law.",
                body="\n".join(f"{_clean(a.get('title'))}: {_clean(a.get('short'))}" for a in areas),
                keywords=["practice areas", "services", "what do you do", "areas of law", "specialise"],
            )
        )

    for area in areas:
        title = _clean(area.get("title"))
        slug = _clean(area.get("slug"))
        forums = ", ".join(_clean(f) for f in area.get("forums", []))
        tags = ", ".join(_clean(t) for t in area.get("tags", []))
        docs.append(
            _Document(
                key=f"practice/{slug}",
                title=f"{title} — SLA Advocates",
                category="practice-area",
                document="Practice Areas",
                section=title,
                url=f"/practice/{slug}",
                header=f"{title} at SLA Advocates.",
                body=_join(
                    [
                        _clean(area.get("short")),
                        _clean(area.get("matter")),
                        _clean(area.get("approach")),
                        f"Forums: {forums}." if forums else "",
                        f"Matters handled: {tags}." if tags else "",
                    ],
                    "\n",
                ),
                keywords=[title.lower(), slug.replace("-", " "), *[_clean(t).lower() for t in area.get("tags", [])]],
            )
        )

        # FAQs become their own documents. A question-shaped chunk is a far
        # better match for a question-shaped query than the same text buried in
        # a longer profile.
        for index, entry in enumerate(area.get("faq", []) or []):
            question = _clean(entry.get("q"))
            docs.append(
                _Document(
                    key=f"faq/{slug}/{index}",
                    title=question,
                    category="faq",
                    document="Practice Areas",
                    section=f"{title} — FAQ",
                    url=f"/practice/{slug}#pd-faq",
                    header=f"Frequently asked question about {title} at SLA Advocates.",
                    body=_join([question, _clean(entry.get("a"))], "\n"),
                    keywords=[question.lower()],
                )
            )

    return docs


def _team_documents(payload: dict[str, Any]) -> list[_Document]:
    docs: list[_Document] = []
    members = payload.get("team", [])

    if members:
        roster = "\n".join(
            f"{_clean(m.get('name'))} — {_clean(m.get('role'))}, {_clean(m.get('exp'))}." for m in members
        )
        docs.append(
            _Document(
                key="team/index",
                title="The advocates at SLA Advocates",
                category="team",
                document="Team",
                section="The Bench",
                url="/team",
                header=f"SLA Advocates' bench of {len(members)} advocates.",
                body=roster,
                keywords=["team", "advocates", "lawyers", "who works", "bench", "how many lawyers"],
            )
        )

    for member in members:
        name = _clean(member.get("name"))
        slug = _clean(member.get("slug"))
        role = _clean(member.get("role"))
        docs.append(
            _Document(
                key=f"team/{slug}",
                title=f"{name} — {role}",
                category="team",
                document="Team",
                section=name,
                url=f"/team#{slug}",
                header=f"{name}, {role} at SLA Advocates.",
                body=_join(
                    [
                        f"Experience: {_clean(member.get('exp'))}. Cases: {_clean(member.get('cases'))}.",
                        f"Qualification: {_clean(member.get('qualification'))}.",
                        f"Bar enrolment: {_clean(member.get('enrollment'))}."
                        if _clean(member.get("enrollment")) not in {"", "—"}
                        else "",
                        _clean(member.get("bio")),
                        _clean(member.get("longBio")),
                    ],
                    "\n",
                ),
                keywords=[name.lower(), role.lower(), slug.replace("-", " ")],
            )
        )

    return docs


def _industry_documents(payload: dict[str, Any]) -> list[_Document]:
    industries = payload.get("industries", [])
    if not industries:
        return []
    # One document rather than eight. Each entry is a name and a single line;
    # embedded alone they are too thin to rank meaningfully, and a visitor
    # asking "do you act for banks?" is well served by the whole list.
    return [
        _Document(
            key="industries/index",
            title="The sectors SLA Advocates advises",
            category="industry",
            document="Home",
            section="Industries",
            url="/#industries",
            header=f"The {len(industries)} sectors SLA Advocates advises.",
            body="\n".join(f"{_clean(i.get('name'))}: {_clean(i.get('note'))}" for i in industries),
            keywords=["industries", "sectors", "clients", "who do you act for"],
        )
    ]


def _recognition_documents(payload: dict[str, Any]) -> list[_Document]:
    recognition = payload.get("recognition", {})
    docs: list[_Document] = []

    enrolments = recognition.get("barCouncilEnrollments", [])
    if enrolments:
        docs.append(
            _Document(
                key="recognition/bar-council",
                title="Bar Council enrolments at SLA Advocates",
                category="recognition",
                document="Recognition",
                section="Bar Council Record",
                url="/awards#aw-bar",
                header="Bar Council of Telangana enrolments held by SLA Advocates' advocates.",
                body="\n".join(
                    f"{_clean(e.get('name'))} ({_clean(e.get('role'))}) — enrolment {_clean(e.get('enrollment'))}, since {_clean(e.get('since'))}."
                    for e in enrolments
                ),
                keywords=["bar council", "enrolment", "enrollment", "registered", "credentials", "qualified"],
            )
        )

    milestones = recognition.get("milestones", [])
    if milestones:
        docs.append(
            _Document(
                key="recognition/milestones",
                title="SLA Advocates' milestones",
                category="recognition",
                document="Recognition",
                section="Milestones",
                url="/awards#aw-milestones",
                header="Milestones in SLA Advocates' history.",
                body="\n".join(
                    f"{_clean(m.get('year'))} — {_clean(m.get('title'))}: {_clean(m.get('body'))}" for m in milestones
                ),
                keywords=["milestones", "timeline", "history", "when founded"],
            )
        )

    forums = recognition.get("forums", [])
    if forums:
        docs.append(
            _Document(
                key="recognition/forums",
                title="Courts and tribunals SLA Advocates appears before",
                category="recognition",
                document="Recognition",
                section="Regular Appearances",
                url="/awards#aw-courts",
                header="The courts, tribunals and forums SLA Advocates appears before.",
                body="\n".join(
                    _join([_clean(f.get("name")), "— " + ", ".join(_clean(d) for d in f.get("domains", []))])
                    if f.get("domains")
                    else _clean(f.get("name"))
                    for f in forums
                ),
                keywords=["courts", "tribunals", "forums", "where do you appear", "high court", "drt", "nclt"],
            )
        )

    quote = recognition.get("recognitionQuote", {})
    if quote:
        docs.append(
            _Document(
                key="recognition/statement",
                title="How SLA Advocates measures its record",
                category="recognition",
                document="Recognition",
                section="Recognition",
                url="/awards#aw-statement",
                header="SLA Advocates on awards and recognition.",
                # The firm publishes credentials rather than accolades. Saying
                # so plainly here is what stops the model inventing an award
                # when someone asks whether the firm has won any.
                body=_join(
                    [
                        f'"{_clean(quote.get("quote"))}" — {_clean(quote.get("attribution"))}.',
                        "The firm's Recognition page presents verifiable credentials — Bar Council enrolments, "
                        "case volume, success rate and milestones — rather than industry awards or press citations.",
                    ],
                    "\n",
                ),
                keywords=["awards", "recognition", "accolades", "prizes", "rankings", "press"],
            )
        )

    return docs


def _matter_documents(payload: dict[str, Any]) -> list[_Document]:
    block = payload.get("landmarkCases", {})
    cases = block.get("cases", [])
    disclaimer = _clean(block.get("disclaimer"))
    if not cases:
        return []

    docs = [
        _Document(
            key="matters/index",
            title="Representative matters handled by SLA Advocates",
            category="matter",
            document="Landmark Cases",
            section="Index",
            url="/landmark-cases",
            header="Representative matter types handled by SLA Advocates.",
            body=_join(
                [
                    f"IMPORTANT: {disclaimer}",
                    "\n".join(f"{_clean(c.get('category'))} — {_clean(c.get('title'))}." for c in cases),
                ],
                "\n",
            ),
            keywords=["cases", "matters", "examples", "results", "track record"],
        )
    ]

    for case in cases:
        title = _clean(case.get("title"))
        docs.append(
            _Document(
                key=f"matters/{_clean(case.get('n'))}",
                title=title,
                category="matter",
                document="Landmark Cases",
                section=_clean(case.get("category")),
                url="/landmark-cases",
                header=f"Representative matter — {_clean(case.get('category'))}.",
                # The disclaimer is repeated into every matter chunk rather
                # than stored once. A chunk is retrieved alone, and a summary
                # that arrives without its caveat is exactly how an illustrative
                # example gets restated to a visitor as a real, citable case.
                body=_join(
                    [
                        f"IMPORTANT: {disclaimer}",
                        f"{title} ({_clean(case.get('category'))}).",
                        _clean(case.get("summary")),
                        f"Forum: {_clean(case.get('forum'))}. Outcome: {_clean(case.get('outcome'))}.",
                    ],
                    "\n",
                ),
                keywords=[title.lower(), _clean(case.get("category")).lower()],
            )
        )

    return docs


def _slot_split(contact: dict[str, Any]) -> str:
    """The morning/evening breakdown, but only while it still adds up.

    This detail used to be a hard-coded "(two morning, two evening)" sitting
    beside an interpolated total, so raising the total in ``consult.js`` would
    have left the assistant stating a split that contradicted its own sentence.
    Deriving it fixes that; validating the sum is what makes the failure mode
    safe rather than merely less likely.

    Returns an empty string when the numbers are absent or inconsistent, so the
    chunk falls back to stating only the total — weaker, and still true. On a
    law firm's site a vaguer fact beats a confident wrong one.
    """
    morning = contact.get("onlineMorning")
    evening = contact.get("onlineEvening")
    total = contact.get("onlineSlots")
    if not isinstance(morning, int) or not isinstance(evening, int):
        return ""
    if not isinstance(total, int) or morning + evening != total:
        return ""
    return f" ({morning} morning, {evening} evening)"


def _contact_documents(payload: dict[str, Any]) -> list[_Document]:
    contact = payload.get("contact", {})
    if not contact:
        return []
    return [
        _Document(
            key="contact/details",
            title="How to contact SLA Advocates",
            category="contact",
            document="Contact",
            section="Reach Us",
            url="/contact#c-reach",
            header="How to reach SLA Advocates.",
            body=_join(
                [
                    f"Phone: {_clean(contact.get('phone'))}.",
                    f"Email: {_clean(contact.get('email'))}.",
                    f"Instagram: {_clean(contact.get('instagram'))}.",
                    f"Location: {_clean(contact.get('city'))}.",
                    f"The firm offers {_clean(contact.get('onlineSlots'))} online consultation slots daily"
                    f"{_slot_split(contact)} and {_clean(contact.get('offlineSlots'))} in-person slots at the office.",
                    "Enquiries can also be sent through the consultation form on the firm's Contact page.",
                ],
                "\n",
            ),
            keywords=["contact", "phone", "email", "address", "book", "appointment", "consultation", "reach"],
        )
    ]


# ── assembly ─────────────────────────────────────────────────────────────────


def build_documents(payload: dict[str, Any]) -> list[_Document]:
    return [
        *_firm_documents(payload),
        *_practice_documents(payload),
        *_team_documents(payload),
        *_industry_documents(payload),
        *_recognition_documents(payload),
        *_matter_documents(payload),
        *_contact_documents(payload),
    ]


def build_chunks(payload: dict[str, Any] | None = None) -> list[KnowledgeChunk]:
    """The corpus: every document, split, each part carrying its own heading."""
    payload = payload if payload is not None else load_payload()
    updated_at = str(payload.get("generated_at", ""))

    chunks: list[KnowledgeChunk] = []
    for doc in build_documents(payload):
        parts = split_body(doc.body) or [""]
        total = len(parts)
        for index, part in enumerate(parts):
            # The keyword line exists for the lexical fallback, which matches on
            # words rather than meaning and would otherwise miss a visitor's
            # phrasing ("do you do property cases") entirely. It is part of the
            # embedded text too, where it does no harm.
            keywords = f"\nRelated: {', '.join(doc.keywords)}." if doc.keywords and index == 0 else ""
            suffix = f" (part {index + 1} of {total})" if total > 1 else ""
            chunks.append(
                KnowledgeChunk(
                    key=f"{doc.key}#{index}",
                    text=f"{doc.header}{suffix}\n{part}{keywords}".strip(),
                    title=doc.title,
                    category=doc.category,
                    document=doc.document,
                    section=doc.section,
                    url=doc.url,
                    updated_at=updated_at,
                )
            )
    return chunks
