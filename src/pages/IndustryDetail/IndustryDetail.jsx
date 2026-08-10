import { useParams, Link, Navigate } from 'react-router-dom';
import Layout from '../../components/shell/Layout.jsx';
import { getIndustryBySlug } from '../../data/industries.js';
import './IndustryDetail.css';

// Intentionally a stub — the sitemap specifies this route as a placeholder
// pending dedicated industry-page content.
export default function IndustryDetail() {
  const { slug } = useParams();
  const industry = getIndustryBySlug(slug);
  if (!industry) return <Navigate to="/" replace />;

  return (
    <Layout navTheme="light">
      <section className="ind-stub">
        <div className="container ind-stub__inner">
          <span className="eyebrow">Industry</span>
          <h1 className="h2">{industry.name}</h1>
          <p>{industry.note}</p>
          <Link to="/" className="link-arrow"><span>Back to Home</span> →</Link>
        </div>
      </section>
    </Layout>
  );
}
