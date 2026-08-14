import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHash } from './useLenis.js';
import { useAppReady } from './appReady.js';

// Carries a `#target` in the URL to the element it names.
//
// React Router does not do this, and on this site three things actively stop it
// from happening by accident, which is why it needs saying explicitly:
//
//   1. PageReveal resets the scroll to the top in a layout effect on every route
//      change. This has to land after that reset, never before it.
//   2. Lenis owns the scroll position and writes its own value back on the next
//      frame, so this has to go *through* Lenis. scrollToHash already does.
//   3. On a cold load the whole site sits behind `visibility: hidden` until the
//      preloader lifts. Waiting for appReady means the position is already
//      correct the moment the page becomes visible, instead of the visitor
//      watching it travel there afterwards.
//
// A layout effect, and deliberately not requestAnimationFrame. rAF is serviced
// by the rendering lifecycle, which a throttled or backgrounded tab can starve
// indefinitely — the same hazard ExpertiseScroller documents for its own arming
// check. A hash scroll that silently never happens because the tab was in the
// background is the exact failure this hook exists to fix, so it must not be
// built on a callback that can be withheld. A layout effect cannot be starved:
// it runs synchronously as part of the commit.
//
// Ordering works out on its own. PageReveal sits above the routes in the tree,
// so its reset has already run by the time this does; and a parent's layout
// effect runs after its children's, so StackSection has finished measuring its
// pin offset before the target is measured here. The advocate cards reserve
// their image boxes with `aspect-ratio`, so a lazily-loaded portrait cannot move
// the target afterwards.
//
// Running twice is harmless — the second pass resolves to the same position —
// which is what makes this safe under StrictMode's double-invoked effects.
export function useHashScroll() {
  const { pathname, hash } = useLocation();
  const ready = useAppReady();

  useLayoutEffect(() => {
    if (!hash || !ready) return;

    try {
      if (!document.querySelector(hash)) return;
    } catch {
      // A fragment that isn't a valid selector isn't ours to act on.
      return;
    }

    scrollToHash(hash, { immediate: true });
  }, [pathname, hash, ready]);
}
