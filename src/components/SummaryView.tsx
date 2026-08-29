import { useEffect, useState } from "react";
import type { AttrSummary, ComputeResult, Element, InfoLink } from "../engine/types";
import {
  REGISTRY,
  REGISTRY_BY_ID,
  DASHBOARD_SECTIONS,
  COMPONENT_SUBTYPES,
  ELEMENT_TYPE_LABELS,
  describeBinding,
  describeBindingParts,
  isSkillModBinding,
  skillModParts,
  isAbilityBinding,
  abilityParts,
} from "../engine/registry";
import { useBuilder } from "../store/builderStore";
import { Markdown } from "./Markdown";

const isWeaponEl = (el: Element): boolean =>
  el.type_ === "Component" && el.subtype === "Weapon";

// Play-mode grouping: Components fall under their class (Essential / Supplemental
// / …, unclassified last); every other element type keeps its own heading. Weapon
// components are handled separately in the Armament section, so they're skipped.
function groupForPlay(items: Element[]): { title: string; items: Element[] }[] {
  const order: string[] = COMPONENT_SUBTYPES.filter((s) => s !== "Weapon");
  const byTitle = new Map<string, Element[]>(order.map((t) => [t, []]));
  const add = (title: string, el: Element) => {
    const bucket = byTitle.get(title);
    if (bucket) bucket.push(el);
    else {
      byTitle.set(title, [el]);
      order.push(title);
    }
  };
  for (const el of items) {
    if (isWeaponEl(el)) continue;
    if (el.type_ === "Component") {
      const cls = (COMPONENT_SUBTYPES as readonly string[]).includes(el.subtype ?? "")
        ? el.subtype!
        : "Unclassified Components";
      add(cls, el);
    } else {
      add(ELEMENT_TYPE_LABELS[el.type_], el);
    }
  }
  return order
    .map((title) => ({ title, items: byTitle.get(title) ?? [] }))
    .filter((g) => g.items.length > 0);
}

export function SummaryView({
  result,
  readOnly = false,
}: {
  result: ComputeResult;
  readOnly?: boolean;
}) {
  const { summary, diagnostics } = result;
  const openBreakdown = useBuilder((s) => s.openBreakdown);
  const crew = useBuilder((s) => s.sheet.crewComposition);
  const hull = useBuilder((s) => s.sheet.hull);
  const elements = useBuilder((s) => s.sheet.elements);
  const select = useBuilder((s) => s.select);

  // Each building block as its own entity. Play view lists only the added
  // elements; build view also leads with the hull for quick access.
  const enabledElements = elements.filter((e) => e.enabled);
  const components: Element[] = readOnly ? enabledElements : [hull, ...enabledElements];

  const componentSection = (
    <div className="component-readout">
      {components.map((el) => (
        <ComponentCard
          key={el.id}
          el={el}
          onSelect={readOnly ? undefined : () => select(el.id)}
        />
      ))}
    </div>
  );

  const renderPanel = (attrId: string) => {
    const attr = REGISTRY_BY_ID[attrId];
    const s = attr ? summary[attrId] : undefined;
    if (!attr || !s) return null;
    const panelClass =
      "sum-panel k-" + s.kind.toLowerCase() + panelState(s) + (readOnly ? " read-only" : "");
    const body = (
      <>
        <div className="sum-label">
          {attr.label}
          {!readOnly && <span className="sum-explain" aria-hidden="true">why?</span>}
        </div>
        <PanelBody s={s} id={attrId} readOnly={readOnly} />
      </>
    );
    return readOnly ? (
      <div key={attrId} className={panelClass}>
        {body}
      </div>
    ) : (
      <button
        key={attrId}
        className={panelClass}
        onClick={() => openBreakdown(attrId)}
        title="Why this value? Open the binding trace"
        aria-label={`${attr.label} — show breakdown of how this value is calculated`}
      >
        {body}
      </button>
    );
  };

  return (
    <div className={"summary" + (readOnly ? " summary-play" : "")}>
      <h2 className="col-title">{readOnly ? "Ship Sheet" : "Live Summary"}</h2>

      {diagnostics.length > 0 && (
        <div className="diagnostics">
          {diagnostics.map((d, i) => (
            <div key={i} className={"diag " + d.level}>
              <span className="diag-dot" />
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      )}

      {readOnly ? (
        <div className="dashboard">
          {DASHBOARD_SECTIONS.map((sec) => {
            // Weapons render as one detailed card per Weapon component, not as the
            // aggregate LIST panel.
            const hasWeapons = sec.attrs.includes("weapons");
            const panels = sec.attrs.filter((a) => a !== "weapons").map(renderPanel).filter(Boolean);
            const weaponEls = hasWeapons ? enabledElements.filter(isWeaponEl) : [];
            if (panels.length === 0 && weaponEls.length === 0) return null;
            return (
              <section className="dash-section" key={sec.title}>
                <h3 className="dash-title">{sec.title}</h3>
                {panels.length > 0 && <div className="summary-grid">{panels}</div>}
                {weaponEls.length > 0 && (
                  <div className="component-readout">
                    {weaponEls.map((el) => (
                      <WeaponCard key={el.id} el={el} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {groupForPlay(components).map((g) => (
            <section className="dash-section" key={g.title}>
              <h3 className="dash-title">{g.title}</h3>
              <div className="component-readout">
                {g.items.map((el) => (
                  <ComponentCard key={el.id} el={el} playMode />
                ))}
              </div>
            </section>
          ))}

          {crew && crew.groups.length > 0 && (
            <section className="dash-section">
              <h3 className="dash-title">Crew Composition</h3>
              <div className="crew-readout">
                {crew.groups.map((g, i) => (
                  <div className="crew-readout-row" key={i}>
                    <span className="cr-name">{g.name}</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: Math.min(100, g.sharePct) + "%" }} />
                    </div>
                    <span className="cr-share">{g.sharePct}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="summary-grid">{REGISTRY.map((attr) => renderPanel(attr.id))}</div>
          {components.length > 0 && (
            <div className="component-block">
              <h3 className="sub-title">Components</h3>
              {componentSection}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ComponentCard({
  el,
  onSelect,
  playMode = false,
}: {
  el: Element;
  onSelect?: () => void;
  playMode?: boolean;
}) {
  // Play mode hides the "Component" type badge (its section heading names the
  // class) and the default "Common" quality tag. The subtype badge (e.g.
  // Essential / Supplemental) is redundant in play mode since components are
  // already grouped under a heading naming their class.
  const showBadge = !(playMode && el.type_ === "Component");
  const showSubtype = el.subtype && !(playMode && el.type_ === "Component");
  const showQuality = el.type_ === "Component" && el.quality && !(playMode && el.quality === "Common");
  const body = (
    <>
      <div className="comp-head">
        {showBadge && <span className={"type-badge t-" + el.type_}>{el.type_}</span>}
        <span className="comp-name">{el.name}</span>
        {showSubtype && <span className="comp-subtype">{el.subtype}</span>}
        {showQuality && (
          <span className={"comp-quality q-" + el.quality!.toLowerCase()}>{el.quality}</span>
        )}
        {el.location && <span className="comp-location">{el.location}</span>}
      </div>
      {!playMode && el.description && <Markdown className="comp-desc" text={el.description} />}
      {el.bindings.length > 0 &&
        (playMode ? (
          <PlayEffects bindings={el.bindings} />
        ) : (
          <ul className="comp-effects">
            {el.bindings.map((b, i) => (
              <li key={i}>
                {describeBinding(b)}
                {b.note && <span className="comp-note"> — {b.note}</span>}
              </li>
            ))}
          </ul>
        ))}
      {playMode && (el.description || (el.links && el.links.length > 0)) && (
        <div className="comp-footer">
          {el.description && <Markdown className="comp-desc" text={el.description} />}
          {el.links && el.links.length > 0 && <ComponentLinks links={el.links} />}
        </div>
      )}
    </>
  );
  return onSelect ? (
    <button
      className="comp-card"
      onClick={onSelect}
      title={`Edit ${el.name}`}
      aria-label={`${el.name} — open in inspector`}
    >
      {body}
    </button>
  ) : (
    <div className="comp-card read-only">{body}</div>
  );
}

// Play-mode links: each renders as clickable text that opens a popup showing
// its description.
function ComponentLinks({ links }: { links: InfoLink[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const active = openIdx == null ? null : links[openIdx];
  return (
    <div className="comp-links">
      {links.map((link, i) => (
        <button
          key={i}
          type="button"
          className="comp-link"
          onClick={() => setOpenIdx(i)}
        >
          {link.label}
        </button>
      ))}
      {active && <LinkPopup link={active} onClose={() => setOpenIdx(null)} />}
    </div>
  );
}

function LinkPopup({ link, onClose }: { link: InfoLink; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal link-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={link.label}
      >
        <div className="modal-head">
          <h3>{link.label}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <Markdown className="link-modal-body" text={link.description} />
      </div>
    </div>
  );
}

// Play-mode effect readout. Skill modifiers and abilities are each grouped under
// a heading with a description/value row per entry; every other binding keeps
// the label/value row layout.
function PlayEffects({ bindings }: { bindings: Element["bindings"] }) {
  const skillMods = bindings.filter(isSkillModBinding);
  const abilities = bindings.filter(isAbilityBinding);
  const others = bindings.filter((b) => !isSkillModBinding(b) && !isAbilityBinding(b));
  return (
    <>
      {others.length > 0 && (
        <dl className="weapon-readout">
          {others.map((b, i) => {
            const { label, value, condition } = describeBindingParts(b);
            return (
              <div className="wr-row" key={i}>
                <dt>
                  {label}
                  {condition && <span className="wr-cond">({condition})</span>}
                </dt>
                <dd>
                  {value}
                  {b.note && <span className="comp-note"> — {b.note}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <GroupedReadout title="Skill Modifiers" entries={skillMods.map(skillModParts)} />
      <GroupedReadout title="Abilities" entries={abilities.map(abilityParts)} />
    </>
  );
}

// Heading + one description/value row per entry, condition beneath the name.
function GroupedReadout({
  title,
  entries,
}: {
  title: string;
  entries: { name: string; value: string; condition?: string }[];
}) {
  if (entries.length === 0) return null;
  return (
    <div className="skill-mods">
      <div className="skill-mods-title">{title}</div>
      {entries.map((e, i) => (
        <div className="sm-row" key={i}>
          <div className="sm-desc">
            <span className="sm-name">{e.name}</span>
            {e.condition && <span className="sm-cond">({e.condition})</span>}
          </div>
          <span className="sm-value">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

function WeaponCard({ el }: { el: Element }) {
  const grant = el.bindings.find((b) => b.attribute === "weapons" && b.op === "GRANT");
  const occupy = el.bindings.find((b) => b.attribute === "weaponSlots" && b.op === "OCCUPY");
  const v = (grant?.value && typeof grant.value === "object" ? grant.value : {}) as {
    strength?: number;
    damage?: string;
    crit?: number;
    rangeShort?: number;
    rangeMedium?: number;
    rangeLong?: number;
    special?: string;
  };
  const rec = (occupy?.value && typeof occupy.value === "object" ? occupy.value : {}) as Record<
    string,
    number
  >;
  const mount = Object.keys(rec)[0];
  const slots = mount ? rec[mount] : undefined;

  const has = (x: unknown): boolean => x != null && x !== "";
  const rows: { label: string; value: string }[] = [];
  if (has(v.strength)) rows.push({ label: "Strength", value: String(v.strength) });
  if (has(v.damage)) rows.push({ label: "Damage", value: String(v.damage) });
  if (has(v.crit)) rows.push({ label: "Crit", value: String(v.crit) });
  if (has(v.rangeShort) || has(v.rangeMedium) || has(v.rangeLong)) {
    rows.push({
      label: "Range",
      value: `${Number(v.rangeShort) || 0}/${Number(v.rangeMedium) || 0}/${Number(v.rangeLong) || 0}`,
    });
  }

  return (
    <div className="comp-card read-only weapon-card">
      <div className="comp-head">
        <span className="comp-name">{el.name}</span>
        {mount && (
          <span className="comp-subtype">
            {mount}
            {slots ? ` ×${slots}` : ""}
          </span>
        )}
        {el.quality && el.quality !== "Common" && (
          <span className={"comp-quality q-" + el.quality.toLowerCase()}>{el.quality}</span>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="weapon-readout">
          {rows.map((r) => (
            <div className="wr-row" key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {v.special && <p className="wr-special">Special: {v.special}</p>}
    </div>
  );
}

function panelState(s: AttrSummary): string {
  if (s.kind === "CAPACITY" && s.secondLabel === "consumed") {
    if (s.spare < 0) return " error";
    if (s.spare <= 1) return " warn";
  }
  if (s.kind === "SLOTSET") {
    for (const v of Object.values(s.mounts)) if (v.used > v.total) return " error";
  }
  return "";
}

function PanelBody({ s, id, readOnly }: { s: AttrSummary; id: string; readOnly: boolean }) {
  const setCurrentValue = useBuilder((st) => st.setCurrentValue);
  switch (s.kind) {
    case "CAPACITY": {
      const pct = s.total > 0 ? Math.min(100, (s.second / s.total) * 100) : 0;
      const showSpare = s.secondLabel === "consumed";
      return (
        <>
          <div className="bar">
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
          <div className="sum-value">
            {s.total} total / {s.second} {s.secondLabel}
            {showSpare && <span className="spare"> → {s.spare} spare</span>}
          </div>
        </>
      );
    }
    case "POOL": {
      // Morale has no meaningful maximum — show the current value alone.
      if (id === "morale") {
        return <div className="sum-value big">{round(s.current)}</div>;
      }
      const pct = s.max > 0 ? Math.min(100, (s.current / s.max) * 100) : 0;
      const adjustable = readOnly && id === "hullIntegrity";
      const adjust = (delta: number) =>
        setCurrentValue(id, Math.max(0, Math.min(s.max, s.current + delta)));
      return (
        <>
          <div className="bar pool">
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
          <div className="sum-value">
            {s.current} / {s.max} max
          </div>
          {adjustable && (
            <div className="pool-controls">
              <button
                type="button"
                className="pool-step"
                onClick={() => adjust(-1)}
                disabled={s.current <= 0}
                aria-label="Decrease hull integrity"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <line x1="4" y1="8" x2="12" y2="8" />
                </svg>
              </button>
              <button
                type="button"
                className="pool-step"
                onClick={() => adjust(1)}
                disabled={s.current >= s.max}
                aria-label="Increase hull integrity"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <line x1="4" y1="8" x2="12" y2="8" />
                  <line x1="8" y1="4" x2="8" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </>
      );
    }
    case "SCALAR":
      return <div className="sum-value big">{round(s.value)}</div>;
    case "CATEGORICAL":
      return (
        <div className="sum-value">
          <span className="chip">{s.label}</span>
          <span className="scale-hint">{s.scale.join(" · ")}</span>
        </div>
      );
    case "SLOTSET":
      return (
        <div className="slots">
          {Object.entries(s.mounts).map(([m, v]) => (
            <span key={m} className={"slot" + (v.used > v.total ? " over" : "")}>
              {m} {v.used}/{v.total}
            </span>
          ))}
        </div>
      );
    case "LIST":
      if (s.entries.length === 0) return <div className="sum-value muted">—</div>;
      return readOnly ? (
        <div className="skill-mods">
          {s.entries.map((e, i) => {
            const value = typeof e.mod === "number" ? signed(e.mod) : e.note ?? "";
            return (
              <div className="sm-row" key={i}>
                <div className="sm-desc">
                  <span className="sm-name">{e.label}</span>
                  {e.condition && <span className="sm-cond">({e.condition})</span>}
                  <span className="sm-source">{e.source}</span>
                </div>
                {value && <span className="sm-value">{value}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="list-entries">
          {s.entries.map((e, i) => (
            <li key={i}>
              {e.label}
              {typeof e.mod === "number" ? ` +${e.mod}` : ""}
              {e.note ? <span className="entry-note"> — {e.note}</span> : ""}
              {e.condition ? <span className="cond"> · {e.condition}</span> : ""}
              <span className="prov"> ({e.source})</span>
            </li>
          ))}
        </ul>
      );
  }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
