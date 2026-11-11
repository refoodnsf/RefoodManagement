import Link from "next/link";
import { PERIODS, type Range } from "@/lib/period";

/** Period buttons + a custom date range, as plain links/GET form (no client JS). */
export default function PeriodPicker({ base, range, extra = {} }: { base: string; range: Range; extra?: Record<string, string> }) {
  const href = (p: string) => {
    const params = new URLSearchParams({ ...extra, p });
    return `${base}?${params}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
        {PERIODS.filter((p) => p.key !== "pers").map((p) => (
          <Link
            key={p.key}
            href={href(p.key)}
            aria-current={range.key === p.key ? "true" : undefined}
            className={`flex h-8 items-center rounded-lg px-3 text-[13px] font-extrabold ${
              range.key === p.key ? "bg-leaf text-white" : "text-quiet hover:bg-ground"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form action={base} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white p-1 pl-3 text-[13px] font-bold">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="p" value="pers" />
        <label className="flex items-center gap-1">
          De
          <input type="date" name="de" defaultValue={range.from} className="rounded-md border border-line px-1.5 py-1" />
        </label>
        <label className="flex items-center gap-1">
          a
          <input type="date" name="ate" defaultValue={range.to} className="rounded-md border border-line px-1.5 py-1" />
        </label>
        <button
          type="submit"
          className={`h-8 rounded-lg px-3 font-extrabold ${range.key === "pers" ? "bg-leaf text-white" : "bg-sand text-ink"}`}
        >
          Ver
        </button>
      </form>
    </div>
  );
}
