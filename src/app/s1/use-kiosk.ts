"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lisbonDate } from "@/lib/domain";

export type Beneficiary = {
  id: string;
  number: number;
  name: string;
  type: "familia" | "individual";
  adults: number;
  children: number;
  foodNeeds: string[];
  foodNotes: string;
};

type Counts = { today: number; week: number };

type QueuedEvent = {
  op: "event";
  clientId: string;
  type: "nao_inscrito" | "inscrito";
  beneficiaryId?: string;
  recordedAt: string;
  people: number;
};
type QueuedUndo = { op: "undo"; clientId: string };
type QueuedOp = QueuedEvent | QueuedUndo;

type Snapshot = {
  counts: Counts;
  countsDay: string;
  beneficiaries: Beneficiary[];
  served: Record<string, string>; // beneficiaryId -> ISO time (today)
  servedDay: string;
};

const SNAPSHOT_KEY = "refood.s1.snapshot";
const QUEUE_KEY = "refood.s1.queue";
const POLL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the kiosk still works for this session.
  }
}

async function post(url: string, body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for non-secure contexts.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

const EMPTY: Snapshot = { counts: { today: 0, week: 0 }, countsDay: "", beneficiaries: [], served: {}, servedDay: "" };

export type RecordResult =
  | { status: "ok"; clientId: string; people: number }
  | { status: "already"; at: string };

/**
 * Kiosk data + an offline-first write queue. Every action updates the screen
 * immediately; the server is told in the background and retried until it answers.
 */
export function useKiosk() {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const queueRef = useRef<QueuedOp[]>([]);
  const flushing = useRef(false);

  const update = useCallback((fn: (s: Snapshot) => Snapshot) => {
    setSnap((prev) => {
      const next = fn(prev);
      save(SNAPSHOT_KEY, next);
      return next;
    });
  }, []);

  const setQueue = useCallback((q: QueuedOp[]) => {
    queueRef.current = q;
    save(QUEUE_KEY, q);
  }, []);

  /** People recorded locally but not yet confirmed by the server. */
  const pendingPeople = useCallback(() => {
    const undone = new Set(queueRef.current.filter((o) => o.op === "undo").map((o) => o.clientId));
    return queueRef.current
      .filter((o): o is QueuedEvent => o.op === "event" && !undone.has(o.clientId))
      .reduce((n, o) => n + o.people, 0);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch("/api/s1/state", { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        counts: Counts;
        beneficiaries: Beneficiary[];
        servedToday: Record<string, string>;
      };
      const today = lisbonDate();
      const pending = pendingPeople();
      const pendingServed: Record<string, string> = {};
      const undone = new Set(queueRef.current.filter((o) => o.op === "undo").map((o) => o.clientId));
      for (const o of queueRef.current) {
        if (o.op === "event" && o.beneficiaryId && !undone.has(o.clientId)) pendingServed[o.beneficiaryId] = o.recordedAt;
      }
      update(() => ({
        counts: { today: data.counts.today + pending, week: data.counts.week + pending },
        countsDay: today,
        beneficiaries: data.beneficiaries,
        served: { ...data.servedToday, ...pendingServed },
        servedDay: today,
      }));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [pendingPeople, update]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length > 0) {
        const op = queueRef.current[0];
        let res: Response;
        try {
          res =
            op.op === "event"
              ? await post("/api/s1/events", {
                  clientId: op.clientId,
                  type: op.type,
                  beneficiaryId: op.beneficiaryId,
                  recordedAt: op.recordedAt,
                })
              : await post("/api/s1/events/undo", { clientId: op.clientId });
        } catch {
          setOnline(false);
          return; // Still offline: keep the queue and try again later.
        }
        if (res.status >= 500) {
          setOnline(false);
          return;
        }
        // Delivered (or permanently rejected): drop it.
        setQueue(queueRef.current.slice(1));
        setOnline(true);
      }
    } finally {
      flushing.current = false;
    }
    await refresh();
  }, [refresh, setQueue]);

  // Boot: restore the last snapshot and queue, then sync.
  useEffect(() => {
    // Deferred so the restore runs after hydration (localStorage is browser-only).
    const boot = setTimeout(() => {
      const today = lisbonDate();
      const cached = load<Snapshot>(SNAPSHOT_KEY, EMPTY);
      queueRef.current = load<QueuedOp[]>(QUEUE_KEY, []);
      setSnap({
        ...cached,
        counts: cached.countsDay === today ? cached.counts : { today: 0, week: cached.counts.week },
        served: cached.servedDay === today ? cached.served : {},
        servedDay: today,
      });
      setReady(true);
      void flush().then(refresh);
    }, 0);
    const timer = setInterval(() => void (queueRef.current.length ? flush() : refresh()), POLL_MS);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(boot);
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [flush, refresh]);

  const addPeople = useCallback(
    (delta: number) =>
      update((s) => ({
        ...s,
        counts: { today: Math.max(0, s.counts.today + delta), week: Math.max(0, s.counts.week + delta) },
      })),
    [update],
  );

  /** Record a visit. Resolves fast: offline or slow networks fall back to the queue. */
  const record = useCallback(
    async (type: "nao_inscrito" | "inscrito", beneficiary?: Beneficiary): Promise<RecordResult> => {
      const today = lisbonDate();
      if (beneficiary) {
        const at = snap.servedDay === today ? snap.served[beneficiary.id] : undefined;
        if (at) return { status: "already", at };
      }
      const clientId = uuid();
      const recordedAt = new Date().toISOString();
      const people = beneficiary ? Math.max(1, beneficiary.adults + beneficiary.children) : 1;
      const op: QueuedEvent = { op: "event", clientId, type, beneficiaryId: beneficiary?.id, recordedAt, people };

      addPeople(people);
      if (beneficiary) update((s) => ({ ...s, served: { ...s.served, [beneficiary.id]: recordedAt } }));

      // Try once directly so a duplicate visit from the other kiosk is caught.
      if (queueRef.current.length === 0) {
        try {
          const res = await post("/api/s1/events", { clientId, type, beneficiaryId: beneficiary?.id, recordedAt });
          if (res.ok) {
            const data = (await res.json()) as { status: string; at?: string; counts?: Counts };
            setOnline(true);
            if (data.status === "already" && data.at && beneficiary) {
              addPeople(-people);
              update((s) => ({ ...s, served: { ...s.served, [beneficiary.id]: data.at! } }));
              return { status: "already", at: data.at };
            }
            if (data.counts) {
              const c = data.counts;
              update((s) => ({ ...s, counts: c, countsDay: today }));
            }
            return { status: "ok", clientId, people };
          }
          if (res.status < 500) {
            // Rejected (e.g. beneficiary deactivated meanwhile): undo the local change.
            addPeople(-people);
            if (beneficiary) {
              update((s) => {
                const served = { ...s.served };
                delete served[beneficiary.id];
                return { ...s, served };
              });
            }
            void refresh();
            return { status: "ok", clientId, people };
          }
        } catch {
          setOnline(false);
        }
      }
      setQueue([...queueRef.current, op]);
      return { status: "ok", clientId, people };
    },
    [addPeople, refresh, setQueue, snap.served, snap.servedDay, update],
  );

  const undo = useCallback(
    async (clientId: string, people: number, beneficiaryId?: string) => {
      addPeople(-people);
      if (beneficiaryId) {
        update((s) => {
          const served = { ...s.served };
          delete served[beneficiaryId];
          return { ...s, served };
        });
      }
      const queued = queueRef.current.findIndex((o) => o.op === "event" && o.clientId === clientId);
      if (queued >= 0) {
        setQueue(queueRef.current.filter((_, i) => i !== queued));
        return;
      }
      if (queueRef.current.length === 0) {
        try {
          const res = await post("/api/s1/events/undo", { clientId });
          if (res.ok) {
            setOnline(true);
            return;
          }
        } catch {
          setOnline(false);
        }
      }
      setQueue([...queueRef.current, { op: "undo", clientId }]);
    },
    [addPeople, setQueue, update],
  );

  return {
    ready,
    online,
    counts: snap.counts,
    beneficiaries: snap.beneficiaries,
    record,
    undo,
    refresh,
  };
}
