import { Link } from 'react-router-dom';
import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import Counter from '../../components/ui/Counter.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import AboutHero from './sections/AboutHero.jsx';
import StorySection from './sections/StorySection.jsx';
import AboutCTA from './sections/AboutCTA.jsx';
import { stats, philosophy, principles, office, communityService } from '../../data/firm.js';
import { milestones } from '../../data/awards.js';
import { landmarkCases } from '../../data/landmarkCases.js';
import libraryImg from '../../assets/img/library-moody.webp';
import './About.css';

const CHAPTERS = ['a-hero', 'a-measure', 'a-story', 'a-philosophy', 'a-decision', 'a-built', 'a-principles', 'a-still', 'a-legacy', 'a-community', 'a-cases'];

export default function About() {
  return (
    <Layout navTheme="light">
      <ChapterSpine sectionIds={CHAPTERS} />

      <AboutHero />

      {/* MeasureOfFirm */}
      <section className="a-measure" id="a-measure">
        <div className="container a-measure__grid">
          {stats.map((s, i) => (
            <Reveal as="div" className="a-measure__item" key={s.label} delay={i * 0.06}>
              <div className="a-measure__value"><Counter value={s.value} suffix={s.suffix} /></div>
              <div className="a-measure__label">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <StorySection />

      {/* OurPhilosophy */}
      <section className="a-philosophy" id="a-philosophy">
        <div className="container">
          <span className="chapter-label chapter-label--light"><b>02</b> Our Philosophy</span>
          <h2 className="h2 h2--light" style={{ maxWidth: '18ch' }}><SplitText text={philosophy.title} /></h2>
          <Reveal as="p" className="a-philosophy__statement">“{philosophy.statement}”</Reveal>
          <div className="a-philosophy__points">
            {philosophy.points.map((pt, i) => (
              <Reveal as="div" className="a-philosophy__point" key={pt.title} delay={i * 0.08}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <h4>{pt.title}</h4>
                <p>{pt.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DecisionRoom */}
      <section className="a-decision" id="a-decision">
        <div className="container a-decision__grid">
          <div>
            <span className="chapter-label"><b>03</b> The Decision Room</span>
            <h2 className="h2"><SplitText text="Every matter starts with the same question." /></h2>
            <Reveal as="p" className="lede">
              Before a single filing, we ask: which forum, which strategy, and what
              does real recovery look like at the end of this — not just a favourable
              order. That discipline is decided in the room, before it ever reaches a court.
            </Reveal>
          </div>
          <Reveal className="a-decision__media">
            <img src={libraryImg} alt="" />
          </Reveal>
        </div>
      </section>

      {/* MattersBuilt */}
      <section className="a-built" id="a-built">
        <div className="container">
          <span className="chapter-label chapter-label--light"><b>04</b> What We’ve Built</span>
          <div className="a-built__grid">
            <Reveal as="div" className="a-built__item">
              <h3>{office.size}</h3>
              <p>Hyderabad office, purpose-built for active litigation practice.</p>
            </Reveal>
            <Reveal as="div" className="a-built__item" delay={0.08}>
              <h3>11 Advocates</h3>
              <p>A full bench spanning twelve practice domains under one roof.</p>
            </Reveal>
            <Reveal as="div" className="a-built__item" delay={0.16}>
              <h3>2000+ Cases</h3>
              <p>Handled and, where it mattered, followed all the way to recovery.</p>
            </Reveal>
          </div>
          <div className="a-built__features">
            {office.features.map((f, i) => <Reveal as="span" key={f} delay={i * 0.04}>{f}</Reveal>)}
          </div>
        </div>
      </section>

      {/* OurPrinciples */}
      <section className="a-principles" id="a-principles">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow"><SplitText text="Our Principles" /></span>
            <h2 className="h2"><SplitText text="What doesn’t change, case to case." /></h2>
          </div>
          <div className="a-principles__list">
            {principles.map((pr, i) => (
              <Reveal as="div" className="a-principles__item" key={pr.n} delay={i * 0.06}>
                <span className="a-principles__num">{pr.n}</span>
                <h4>{pr.title}</h4>
                <p>{pr.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* StillPoint */}
      <section className="a-still" id="a-still">
        <div className="container">
          <Reveal as="p" className="a-still__quote">
            <SplitText text="“Practical solutions, delivered with a human touch.”" stagger={0.02} />
          </Reveal>
          <Reveal as="p" className="a-still__attr" delay={0.3}>— Sridhar Lendalay</Reveal>
        </div>
      </section>

      {/* Legacy */}
      <section className="a-legacy" id="a-legacy">
        <div className="container">
          <span className="chapter-label"><b>05</b> Legacy</span>
          <h2 className="h2" style={{ marginBottom: '2.5rem' }}><SplitText text="Three decades, one standard." /></h2>
          <div className="a-legacy__list">
            {milestones.map((m, i) => (
              <Reveal as="div" className="a-legacy__item" key={m.year} delay={i * 0.05}>
                <span className="a-legacy__year">{m.year}</span>
                <div>
                  <h4>{m.title}</h4>
                  <p>{m.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CommunityService */}
      <section className="a-community" id="a-community">
        <div className="container a-community__grid">
          <span className="chapter-label chapter-label--light"><b>06</b> {communityService.eyebrow}</span>
          <div>
            <h2 className="h2 h2--light"><SplitText text={communityService.title} /></h2>
            <Reveal as="p" className="a-community__body">{communityService.body}</Reveal>
          </div>
        </div>
      </section>

      {/* LandmarkCasesTeaser */}
      <section className="a-cases" id="a-cases">
        <div className="container">
          <div className="section-head section-head--split">
            <div>
              <span className="eyebrow"><SplitText text="Landmark Cases" /></span>
              <h2 className="h2"><SplitText text="A record built matter by matter." /></h2>
            </div>
            <Reveal as="p" className="section-head__note">
              Representative matter types from our practice history — case details
              are withheld to protect client confidentiality.
            </Reveal>
          </div>
          <div className="a-cases__grid">
            {landmarkCases.slice(0, 3).map((c, i) => (
              <Reveal as="div" className="proof__case" key={c.n} delay={i * 0.06}>
                <span className="proof__case-num">{c.n}</span>
                <div>
                  <span className="proof__case-cat">{c.category}</span>
                  <h4>{c.title}</h4>
                  <p>{c.summary}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <Link to="/landmark-cases" className="link-arrow"><span>View all landmark cases</span> →</Link>
          </Reveal>
        </div>
      </section>

      <AboutCTA />
    </Layout>
  );
}
