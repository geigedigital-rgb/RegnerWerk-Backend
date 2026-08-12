"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Link2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  compatStatusLabel,
  isCompatReady,
  parseCompatibility,
  roleLabel,
  type AssortmentPeer,
  type CompatPortMatch,
} from "@/lib/assortment";

function relationStatusCls(status: string): string {
  if (status === "confirmed") return "bg-mint text-aqua-deep";
  if (status === "conditional") return "bg-gold/20 text-forest";
  if (status === "incompatible") return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-400";
}

function PeerCard({
  peer,
  href,
  badge,
  badgeCls,
  meta,
}: {
  peer: AssortmentPeer | null;
  href?: string;
  badge?: string;
  badgeCls?: string;
  meta?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ice">
        {peer?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peer.image}
            alt=""
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] text-gray-400">
            —
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-forest group-hover:text-aqua-deep">
          {peer?.title ?? "неизвестный продукт"}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
          {peer && (
            <span className="font-medium text-forest-mid">
              {roleLabel(peer.role)}
            </span>
          )}
          {peer?.article && <span>Art. {peer.article}</span>}
          {badge && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badgeCls ?? "bg-gray-50 text-gray-400"}`}
            >
              {badge}
            </span>
          )}
        </div>
        {meta}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group flex gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 transition-colors hover:border-aqua-deep/40"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-gray-100 bg-gray-50/50 p-2.5">
      {body}
    </div>
  );
}

function ProductIdList({
  ids,
  peers,
  dataset,
  badge,
  badgeCls,
  empty,
}: {
  ids: string[];
  peers: Map<string, AssortmentPeer>;
  dataset: string;
  badge?: string;
  badgeCls?: string;
  empty: string;
}) {
  if (ids.length === 0) {
    return <p className="text-sm text-gray-400">{empty}</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ids.map((id) => {
        const peer = peers.get(id) ?? null;
        const href = peer
          ? `/produkte/${encodeURIComponent(id)}?db=${encodeURIComponent(dataset)}`
          : undefined;
        return (
          <PeerCard
            key={id}
            peer={
              peer ?? {
                product_id: id,
                title: id,
                role: "",
                group_id: "",
                article: "",
                image: null,
              }
            }
            href={href}
            badge={badge}
            badgeCls={badgeCls}
          />
        );
      })}
    </div>
  );
}

function PortMatchGroup({
  targetId,
  matches,
  peers,
  dataset,
}: {
  targetId: string;
  matches: CompatPortMatch[];
  peers: Map<string, AssortmentPeer>;
  dataset: string;
}) {
  const peer = peers.get(targetId) ?? null;
  const href = peer
    ? `/produkte/${encodeURIComponent(targetId)}?db=${encodeURIComponent(dataset)}`
    : undefined;
  const worst = matches.some((m) => m.status === "incompatible")
    ? "incompatible"
    : matches.every((m) => m.status === "confirmed")
      ? "confirmed"
      : "conditional";

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
      <PeerCard
        peer={
          peer ?? {
            product_id: targetId,
            title: targetId,
            role: "",
            group_id: "",
            article: "",
            image: null,
          }
        }
        href={href}
        badge={worst}
        badgeCls={relationStatusCls(worst)}
      />
      <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
        {matches.map((m, i) => (
          <li
            key={`${m.local_port_id}-${m.target_port_id}-${i}`}
            className="text-[11px] text-gray-600"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Link2 size={11} className="text-aqua-deep" />
              <span className="font-mono text-[10px]">
                {m.local_port_id || "?"} → {m.target_port_id || "?"}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${relationStatusCls(m.status)}`}
              >
                {m.status}
              </span>
              {m.domain && (
                <span className="text-gray-400">{m.domain}</span>
              )}
            </div>
            <div className="ml-4 mt-0.5 text-gray-400">
              {m.relation_type}
              {m.reason_code ? ` · ${m.reason_code}` : ""}
            </div>
            {m.requirements.length > 0 && (
              <ul className="ml-4 mt-0.5 text-gold">
                {m.requirements.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompatibilityPanel({
  compatibility,
  peers,
  dataset,
}: {
  compatibility: unknown;
  peers: AssortmentPeer[];
  dataset: string;
}) {
  const view = parseCompatibility(compatibility);
  const peerMap = new Map(peers.map((p) => [p.product_id, p]));

  const portByTarget = new Map<string, CompatPortMatch[]>();
  for (const m of view.portMatches) {
    if (!m.target_product_id) continue;
    const list = portByTarget.get(m.target_product_id) ?? [];
    list.push(m);
    portByTarget.set(m.target_product_id, list);
  }

  const confirmedPorts = [...portByTarget.entries()].filter(([, ms]) =>
    ms.every((m) => m.status === "confirmed"),
  );
  const conditionalPorts = [...portByTarget.entries()].filter(
    ([, ms]) =>
      !ms.every((m) => m.status === "confirmed") &&
      !ms.some((m) => m.status === "incompatible"),
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Совместимость</h2>
            <p className="mt-1 text-xs text-gray-400">
              {view.selectionPolicy ||
                "compatible_product_ids сами по себе не доказывают сборку"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              isCompatReady(view.status)
                ? "bg-mint text-aqua-deep"
                : view.status.includes("blocked")
                  ? "bg-gold/20 text-forest"
                  : "bg-ice text-forest-mid"
            }`}
          >
            {compatStatusLabel(view.status)}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <MiniStat
            icon={<CheckCircle2 size={13} />}
            label="Confirmed"
            value={view.compatibleIds.length}
            cls="text-aqua-deep"
          />
          <MiniStat
            icon={<AlertTriangle size={13} />}
            label="Conditional"
            value={view.conditionalIds.length}
            cls="text-forest"
          />
          <MiniStat
            icon={<GitBranch size={13} />}
            label="Port matches"
            value={view.portMatches.length}
            cls="text-forest-mid"
          />
          <MiniStat
            icon={<XCircle size={13} />}
            label="Incompatible"
            value={view.incompatibleIds.length}
            cls="text-red-600"
          />
        </div>

        {view.compatibleGroupIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {view.compatibleGroupIds.map((g) => (
              <span
                key={g}
                className="rounded-full bg-ice px-2.5 py-0.5 font-mono text-[10px] text-gray-500"
              >
                group:{g}
              </span>
            ))}
          </div>
        )}
      </section>

      {view.requirements.length > 0 && (
        <section className="rounded-3xl border border-gold/40 bg-gold/10 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-forest">
            <ShieldAlert size={15} />
            Требования
          </div>
          <ul className="mt-3 space-y-2">
            {view.requirements.map((r) => (
              <li
                key={r.rule_id}
                className="rounded-2xl border border-gold/30 bg-white/70 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                  <span className="font-mono">{r.rule_id}</span>
                  {r.domain && <span>{r.domain}</span>}
                  {r.severity && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 font-semibold text-forest">
                      {r.severity}
                    </span>
                  )}
                </div>
                {r.text_ru && (
                  <p className="mt-1 text-sm leading-relaxed text-forest">
                    {r.text_ru}
                  </p>
                )}
                {r.machine_condition && (
                  <p className="mt-1 font-mono text-[10px] text-gray-400">
                    {r.machine_condition}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold">
          Подтверждённые продукты
          <span className="ml-2 text-[11px] font-normal text-gray-400">
            compatible / direct
          </span>
        </h2>
        <div className="mt-4">
          <ProductIdList
            ids={[
              ...new Set([...view.compatibleIds, ...view.directIds]),
            ]}
            peers={peerMap}
            dataset={dataset}
            badge="confirmed"
            badgeCls={relationStatusCls("confirmed")}
            empty="Нет подтверждённых связей с конкретными продуктами"
          />
        </div>
      </section>

      {(view.conditionalIds.length > 0 || conditionalPorts.length > 0) && (
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold">
            Условные кандидаты
            <span className="ml-2 text-[11px] font-normal text-gray-400">
              требуют проверки
            </span>
          </h2>
          <div className="mt-4">
            <ProductIdList
              ids={view.conditionalIds}
              peers={peerMap}
              dataset={dataset}
              badge="conditional"
              badgeCls={relationStatusCls("conditional")}
              empty="Нет условных ID"
            />
          </div>
        </section>
      )}

      {view.functionalIds.length + view.functionalRelations.length > 0 && (
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold">Functional relations</h2>
          <div className="mt-4 space-y-2">
            {view.functionalIds.length > 0 && (
              <ProductIdList
                ids={view.functionalIds}
                peers={peerMap}
                dataset={dataset}
                badge="functional"
                badgeCls="bg-ice text-forest-mid"
                empty=""
              />
            )}
            {view.functionalRelations.map((fr, i) => {
              const peer = peerMap.get(fr.target_product_id) ?? null;
              return (
                <div
                  key={`${fr.target_product_id}-${i}`}
                  className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3"
                >
                  <PeerCard
                    peer={
                      peer ?? {
                        product_id: fr.target_product_id,
                        title: fr.target_product_id,
                        role: "",
                        group_id: "",
                        article: "",
                        image: null,
                      }
                    }
                    href={
                      peer
                        ? `/produkte/${encodeURIComponent(fr.target_product_id)}?db=${encodeURIComponent(dataset)}`
                        : undefined
                    }
                    badge={fr.status}
                    badgeCls={relationStatusCls(fr.status)}
                    meta={
                      <div className="mt-1 text-[10px] text-gray-400">
                        {fr.relation_type}
                        {fr.reason_code ? ` · ${fr.reason_code}` : ""}
                        {fr.inverse ? " · inverse" : ""}
                      </div>
                    }
                  />
                  {fr.requirements.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-gold">
                      {fr.requirements.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {view.portMatches.length > 0 && (
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold">
            Port matches
            <span className="ml-2 text-[11px] font-normal text-gray-400">
              {confirmedPorts.length} confirmed · {conditionalPorts.length}{" "}
              conditional · {portByTarget.size} targets
            </span>
          </h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[...portByTarget.entries()]
              .sort((a, b) => {
                const rank = (ms: CompatPortMatch[]) =>
                  ms.every((m) => m.status === "confirmed")
                    ? 0
                    : ms.some((m) => m.status === "incompatible")
                      ? 2
                      : 1;
                return rank(a[1]) - rank(b[1]);
              })
              .map(([id, matches]) => (
                <PortMatchGroup
                  key={id}
                  targetId={id}
                  matches={matches}
                  peers={peerMap}
                  dataset={dataset}
                />
              ))}
          </div>
        </section>
      )}

      {view.incompatibleIds.length > 0 && (
        <section className="rounded-3xl border border-red-100 bg-red-50/40 p-5">
          <h2 className="text-sm font-bold text-red-700">Несовместимы</h2>
          <div className="mt-4">
            <ProductIdList
              ids={view.incompatibleIds}
              peers={peerMap}
              dataset={dataset}
              badge="incompatible"
              badgeCls={relationStatusCls("incompatible")}
              empty=""
            />
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  cls,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 px-3 py-2">
      <div className={`flex items-center gap-1 text-[10px] font-medium ${cls}`}>
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}
