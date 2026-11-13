"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lisbonDate, type Schedule } from "@/lib/domain";
import { POLL_MS, load, post, request, save, uuid } from "@/lib/kiosk-client";

export type Task = { id: string; schedule: Schedule; name: string; details: string; photos: string[] };
export type Contact = { id: string; name: string; phone: string; note: string };
export type Slide =
  | { kind: "photo"; id: string; url: string }
  | { kind: "event"; id: string; title: string; body: string; image: string | null; qrSvg: string | null };

type QueuedCheckIn = { op: "checkin"; clientId: string; number: number; schedule: Schedule; recordedAt: string };
type QueuedTask = { op: "task"; taskId: string; done: boolean; changedAt: string };
type QueuedOp = QueuedCheckIn | QueuedTask;

type Snapshot = {
  day: string;
  tasks: Task[];
  status: Record<string, boolean>; // taskId -> done (today)
  contacts: Contact[];
  slides: Slide[];
  checkedIn: Record<string, string>; // volunteer number -> ISO time (today, this kiosk)
};

const SNAPSHOT_KEY = "refood.s2.snapshot";
const QUEUE_KEY = "refood.s2.queue";
const EMPTY: Snapshot = { day: "", tasks: [], status: {}, contacts: [], slides: [], checkedIn: {} };

export type LookupResult =
  | { status: "ok"; name: string; alreadyAt: string | null }
  | { status: "not_found" }
  | { status: "offline" };

export type CheckInResult = { status: "ok"; name?: string } | { status: "already"; at: string | null } | { status: "not_found" };

/** Same day? Otherwise today's task ticks and check-ins start again. */
function forToday(s: Snapshot): Snapshot {
  const today = lisbonDate();
  return s.day === today ? s : { ...s, day: today, status: {}, checkedIn: {} };
}

/**
 * Volunteer-kiosk data with an offline-first write queue: every tap updates the
 * screen at once; the server is told in the background and retried until it answers.
 */
export function useS2() {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [online, setOnline] = useState(true);
  const queueRef = useRef<QueuedOp[]>([]);
  const flushing = useRef(false);

  const update = useCallback((fn: (s: Snapshot) => Snapshot) => {
    setSnap((prev) => {
      const next = fn(forToday(prev));
      save(SNAPSHOT_KEY, next);
      return next;
    });
  }, []);

  const setQueue = useCallback((q: QueuedOp[]) => {
    queueRef.current = q;
    save(QUEUE_KEY, q);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await request("/api/s2/state");
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { day: string; tasks: Task[]; status: Record<string, boolean>; contacts: Contact[]; slides: Slide[] };
      // Taps still waiting in the queue win over what the server knows.
      const pending: Record<string, boolean> = {};
      for (const o of queueRef.current) if (o.op === "task") pending[o.taskId] = o.done;
      update((s) => ({
        ...s,
        day: data.day,
        tasks: data.tasks,
        status: { ...data.status, ...pending },
        contacts: data.contacts,
        slides: data.slides,
        checkedIn: s.day === data.day ? s.checkedIn : {},
      }));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [update]);

  const send = useCallback(
    (op: QueuedOp) =>
      op.op === "checkin"
        ? post("/api/s2/checkin", { clientId: op.clientId, number: op.number, schedule: op.schedule, recordedAt: op.recordedAt })
        : post("/api/s2/task", { taskId: op.taskId, done: op.done, changedAt: op.changedAt }),
    [],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length > 0) {
        let res: Response;
        try {
          res = await send(queueRef.current[0]);
        } catch {
          setOnline(false);
          return;
        }
        if (res.status >= 500) {
          setOnline(false);
          return;
        }
        setQueue(queueRef.current.slice(1)); // Delivered (or permanently rejected).
        setOnline(true);
      }
    } finally {
      flushing.current = false;
    }
    await refresh();
  }, [refresh, send, setQueue]);

  useEffect(() => {
    const boot = setTimeout(() => {
      queueRef.current = load<QueuedOp[]>(QUEUE_KEY, []);
      setSnap(forToday(load<Snapshot>(SNAPSHOT_KEY, EMPTY)));
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

  /** Queue an op, or send it right away when nothing is waiting. */
  const deliver = useCallback(
    async (op: QueuedOp): Promise<Response | null> => {
      if (queueRef.current.length === 0) {
        try {
          const res = await send(op);
          if (res.status < 500) {
            setOnline(true);
            return res;
          }
        } catch {
          // fall through to the queue
        }
        setOnline(false);
      }
      setQueue([...queueRef.current, op]);
      return null;
    },
    [send, setQueue],
  );

  const setTask = useCallback(
    (taskId: string, done: boolean) => {
      update((s) => ({ ...s, status: { ...s.status, [taskId]: done } }));
      void deliver({ op: "task", taskId, done, changedAt: new Date().toISOString() });
    },
    [deliver, update],
  );

  const lookup = useCallback(async (number: number): Promise<LookupResult> => {
    try {
      const res = await post("/api/s2/lookup", { number });
      if (!res.ok) throw new Error(String(res.status));
      setOnline(true);
      return (await res.json()) as LookupResult;
    } catch {
      setOnline(false);
      return { status: "offline" };
    }
  }, []);

  const checkIn = useCallback(
    async (number: number, schedule: Schedule): Promise<CheckInResult> => {
      const local = forToday(snap).checkedIn[String(number)];
      if (local) return { status: "already", at: local };
      const recordedAt = new Date().toISOString();
      const op: QueuedCheckIn = { op: "checkin", clientId: uuid(), number, schedule, recordedAt };
      const res = await deliver(op);
      let result: CheckInResult = { status: "ok" };
      if (res) {
        result = res.ok ? ((await res.json().catch(() => ({ status: "ok" }))) as CheckInResult) : { status: "ok" };
      }
      if (result.status === "ok") update((s) => ({ ...s, checkedIn: { ...s.checkedIn, [String(number)]: recordedAt } }));
      if (result.status === "already" && result.at) {
        const at = result.at;
        update((s) => ({ ...s, checkedIn: { ...s.checkedIn, [String(number)]: at } }));
      }
      return result;
    },
    [deliver, snap, update],
  );

  /** Photos need the network (they are too big for the offline queue). */
  const uploadPhoto = useCallback(async (blob: Blob): Promise<boolean> => {
    const form = new FormData();
    form.set("file", blob, "foto.jpg");
    form.set("clientId", uuid());
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await request("/api/s2/photo", { method: "POST", body: form }, 30_000);
        if (res.ok) {
          setOnline(true);
          void refresh();
          return true;
        }
        if (res.status < 500) return false;
      } catch {
        setOnline(false);
      }
    }
    return false;
  }, [refresh]);

  const today = forToday(snap);
  return {
    online,
    tasks: today.tasks,
    status: today.status,
    contacts: today.contacts,
    slides: today.slides,
    checkedInAt: (number: number) => today.checkedIn[String(number)],
    setTask,
    lookup,
    checkIn,
    uploadPhoto,
  };
}
