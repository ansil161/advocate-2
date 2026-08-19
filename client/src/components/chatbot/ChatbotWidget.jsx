// The chatbot's mount point, and the only part of it that ships in the main
// bundle.
//
// Everything that makes a conversation possible — the panel, the hook, the API
// client — lives behind a lazy import, so a visitor who never opens the
// assistant downloads nothing but this file and its stylesheet. The site has to
// stay exactly as fast as it was for the people who ignore the widget entirely,
// which is most of them.
//
// Once opened, the panel stays mounted. Closing it hides it rather than
// destroying it, because unmounting would throw away the conversation — and
// someone who closes the panel to read a page and reopens it a minute later has
// not finished their conversation, they have paused it.

import { Suspense, lazy, useCallback, useId, useRef, useState } from 'react';
import ChatLauncher from './ChatLauncher.jsx';
// Only the launcher's styling ships eagerly. The panel's stylesheet is
// imported by ChatPanel.jsx and travels with its lazy chunk.
import './ChatLauncher.css';

const ChatPanel = lazy(() => import('./ChatPanel.jsx'));

// Warms the chunk on intent rather than on load. By the time a click lands the
// panel is usually already parsed, so opening feels immediate without costing
// anyone who never hovers it.
const prefetchPanel = () => import('./ChatPanel.jsx');

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  // Latched on first open so the lazy chunk is requested once and the mounted
  // panel survives every subsequent close.
  const [mounted, setMounted] = useState(false);
  const launcherRef = useRef(null);
  const titleId = useId();

  const openPanel = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Focus goes back to the control that opened the panel, so a keyboard
    // visitor is returned to where they were rather than to the top of the
    // document.
    launcherRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <ChatLauncher
        ref={launcherRef}
        open={open}
        controls={titleId}
        onOpen={openPanel}
        onClose={closePanel}
        onPrefetch={prefetchPanel}
      />

      {mounted && (
        // No fallback: a spinner in the corner of the page while a 20KB chunk
        // loads is more distracting than the half-second of nothing it replaces.
        <Suspense fallback={null}>
          <ChatPanel open={open} titleId={titleId} onClose={closePanel} />
        </Suspense>
      )}
    </>
  );
}
