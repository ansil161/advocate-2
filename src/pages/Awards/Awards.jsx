import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import AwardsHero from './sections/AwardsHero.jsx';
import RecordSection from './sections/RecordSection.jsx';
import RecognitionStatement from './sections/RecognitionStatement.jsx';
import BarCouncilRecord from './sections/BarCouncilRecord.jsx';
import CourtsAndTribunals from './sections/CourtsAndTribunals.jsx';
import Milestones from './sections/Milestones.jsx';
import AwardsClosing from './sections/AwardsClosing.jsx';
import './Awards.css';

// AWARDS & RECOGNITION — read as one continuous archive:
//   architecture → the record → the philosophy behind it → the credentials
//   → the institutions → the history → the close.
// Everything on this page is drawn from data/awards.js and data/firm.js. No award,
// ranking, citation or statistic is introduced in the markup.
const CHAPTERS = ['aw-hero', 'aw-record', 'aw-statement', 'aw-bar', 'aw-courts', 'aw-milestones', 'aw-closing'];
const DARK_CHAPTERS = ['aw-hero', 'aw-milestones', 'aw-closing'];

export default function Awards() {
  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={CHAPTERS} darkIds={DARK_CHAPTERS} />

      <AwardsHero />
      <RecordSection />
      <RecognitionStatement />
      <BarCouncilRecord />
      <CourtsAndTribunals />
      <Milestones />
      <AwardsClosing />
    </Layout>
  );
}
