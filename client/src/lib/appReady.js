import { createContext, useContext } from 'react';

// True once the preloader has finished and the page is actually on screen.
//
// App renders the whole site behind `visibility: hidden` until the preloader
// lifts, and a mount-time entrance played under that is an animation nobody
// sees — on a first visit to /team the bench finished assembling roughly when
// the wipe cleared it. Anything whose arrival is the point should hold at its
// initial state until this is true.
//
// The default is `true` so a component used outside the provider — a test, or
// a page mounted after the preloader is long gone — animates as normal.
export const AppReadyContext = createContext(true);

export const useAppReady = () => useContext(AppReadyContext);
