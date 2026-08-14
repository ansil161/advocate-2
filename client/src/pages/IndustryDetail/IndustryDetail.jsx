import { useParams, Link, Navigate } from 'react-router-dom';
import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
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
      {/* noindex while this route is still a stub: the page carries one sentence
          of content, and thin pages indexed under the firm's domain cost more
          than they earn. Drop the flag when real industry content lands. */}
      <PageMeta
        title={industry.name}
        description={industry.note}
        path={`/industries/${industry.slug}`}
        noindex
      />
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
