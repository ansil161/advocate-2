// All of the chatbot's state, in one hook, so the components below it can stay
// presentational.
//
// The conversation lives here and nowhere else — deliberately not in
// sessionStorage. A visitor's questions to a law firm are not something to
// leave sitting on a shared computer after the tab is closed, and the server
// forgets the thread after an hour anyway.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatApiError, ERROR_TEXT, fetchOpening, sendMessage } from './chatApi.js';

// Belt and braces with the service's own limit: stops a paste of a whole
// document from making a request that was always going to be rejected.
export const MAX_MESSAGE_CHARS = 1000;

// Used if the opening call fails, so a visitor who opens the panel offline
// still sees something coherent rather than an empty box.
const OFFLINE_OPENING = {
  greeting:
    "Welcome to SLA Advocates. I can help you explore the firm's practice areas, its advocates, its experience and how to get in touch.",
  suggested_questions: [
    'What areas of law does SLA Advocates handle?',
    'Who founded the firm?',
    'How can I contact the firm?',
  ],
};

let nextId = 0;
const makeId = () => `m${++nextId}`;

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [greeting, setGreeting] = useState('');
  // 'idle' | 'sending' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const conversationId = useRef(null);
  // The opening set, kept so `reset` can put the panel back exactly as it
  // first appeared rather than leaving the last reply's follow-ups under a
  // greeting that no longer has a conversation behind it.
  const openingSuggestions = useRef([]);
  // The question that failed, kept so Retry can resend exactly it rather than
  // asking the visitor to type it again.
  const pending = useRef(null);
  const abort = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Any request still in flight when the panel unmounts is abandoned, so
      // its resolution cannot set state on a gone component.
      abort.current?.abort();
    };
  }, []);

  // Fetched once, when the panel first mounts — which is only when the visitor
  // opens it, since the panel is lazy-loaded.
  useEffect(() => {
    const controller = new AbortController();
    fetchOpening({ signal: controller.signal })
      .then((data) => {
        if (!mounted.current) return;
        setGreeting(data.greeting);
        openingSuggestions.current = data.suggested_questions || [];
        setSuggestions(openingSuggestions.current);
      })
      .catch(() => {
        if (!mounted.current || controller.signal.aborted) return;
        setGreeting(OFFLINE_OPENING.greeting);
        openingSuggestions.current = OFFLINE_OPENING.suggested_questions;
        setSuggestions(openingSuggestions.current);
      });
    return () => controller.abort();
  }, []);

  const deliver = useCallback(async (text) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setStatus('sending');
    setError(null);
    // Cleared while a reply is in flight: leaving them up invites a second
    // question that would cancel the first.
    setSuggestions([]);

    try {
      const data = await sendMessage({
        message: text,
        conversationId: conversationId.current,
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return;

      conversationId.current = data.conversation_id;
      pending.current = null;
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: data.answer,
          sources: data.sources || [],
          // Marks a reply the service produced from a fallback path, so the
          // interface can be honest about it rather than presenting a quoted
          // passage as a composed answer.
          degraded: Boolean(data.degraded),
          mode: data.mode,
        },
      ]);
      setSuggestions(data.suggested_questions || []);
      setStatus('idle');
    } catch (err) {
      if (!mounted.current || controller.signal.aborted) return;
      const failure =
        err instanceof ChatApiError ? err : new ChatApiError('server', ERROR_TEXT.server);
      setError({ kind: failure.kind, text: failure.message, retryable: failure.retryable });
      setStatus('error');
    }
  }, []);

  const send = useCallback(
    (raw) => {
      const text = String(raw ?? '').trim().slice(0, MAX_MESSAGE_CHARS);
      if (!text || status === 'sending') return;

      pending.current = text;
      setMessages((prev) => [...prev, { id: makeId(), role: 'user', text }]);
      deliver(text);
    },
    [deliver, status]
  );

  // Resends the message that failed. The visitor's turn is already in the
  // transcript, so this must not append it a second time.
  const retry = useCallback(() => {
    if (!pending.current || status === 'sending') return;
    deliver(pending.current);
  }, [deliver, status]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  // Drops the thread and returns the panel to its opening state. The
  // conversation id goes with it, so the service starts a new thread rather
  // than continuing the old one against a transcript the visitor can no longer
  // see. The greeting and its opening questions are kept — they were fetched
  // once and have not changed.
  const reset = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    pending.current = null;
    conversationId.current = null;
    setMessages([]);
    setSuggestions(openingSuggestions.current);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    messages,
    suggestions,
    greeting,
    status,
    error,
    send,
    retry,
    dismissError,
    reset,
    isSending: status === 'sending',
  };
}
