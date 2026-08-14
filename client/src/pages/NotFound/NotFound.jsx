import { Link } from 'react-router-dom';
import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';

// Deliberately a sentence and two links. A 404 is a wrong turn, not a
// destination, and the fastest thing to do for the visitor is name what
// happened and point at the two places they most likely wanted.
//
// `navTheme="light"` matches the other cream-ground pages, and `.stub` is the
// same minimal-page measure the industry stub uses.
export default function NotFound() {
  return (
    <Layout navTheme="light">
      <PageMeta
        title="Page Not Found"
        description="The page you were looking for is not here. Return to SLA Advocates, or contact the firm directly."
        path="/404"
        noindex
      />
      <section className="stub">
        <div className="container stub__inner">
          <span className="eyebrow">Error 404</span>
          <h1 className="h2">This page isn’t here.</h1>
          <p>
            The address may have changed, or the link that brought you here may
            be out of date. Everything else is where it was.
          </p>
          <div className="stub__actions">
            <Link to="/" className="btn btn--solid magnetic"><span>Return home</span></Link>
            <Link to="/contact" className="btn btn--line magnetic"><span>Contact the firm</span></Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
