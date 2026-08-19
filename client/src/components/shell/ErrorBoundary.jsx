import { Component } from 'react';

// The floor under the route content.
//
// The site renders behind `visibility: hidden` until the preloader lifts (see
// App.jsx), so an uncaught render error below the routes would otherwise leave a
// permanently blank page rather than a broken one — there would be nothing left
// to make the wrapper visible again.
//
// Each page brings its own Layout (Nav and Footer are inside the routes, not
// above them), so the fallback has to carry its own way out. It is deliberately
// plain markup on global utility classes: it must not depend on a route CSS
// chunk that may never have loaded, nor on any component that could itself be
// the thing that threw.
//
// `fallback` overrides that page-shaped default for subtrees where a full-page
// apology would be wrong. The assistant widget passes `null`: if the chatbot
// fails it should simply not be there, and the article the visitor was reading
// should be entirely unaffected.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Kept out of production builds: a stack trace is no use to a visitor and
    // discloses build internals. In development it is the entire point.
    if (import.meta.env.DEV) {
      console.error('[SLA] Uncaught render error:', error, info?.componentStack);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // `undefined` means no fallback was given and the page-shaped default
    // applies; `null` is a deliberate "render nothing" and must be honoured.
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <main className="stub">
        <div className="container stub__inner">
          <span className="eyebrow">SLA Advocates</span>
          <h1 className="h2">This page could not be displayed.</h1>
          <p>
            Something went wrong while loading this section. The rest of the site
            is unaffected — please reload, or reach the firm directly and we will
            be glad to help.
          </p>
          {/* Full document loads, not router navigations: the subtree that threw
              is still mounted, and re-rendering it in place would only throw again. */}
          <div className="stub__actions">
            <a href="/" className="btn btn--solid magnetic"><span>Return home</span></a>
            <a href="/contact" className="btn btn--line magnetic"><span>Contact the firm</span></a>
          </div>
        </div>
      </main>
    );
  }
}
