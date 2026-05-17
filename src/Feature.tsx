import { useEffect, useRef, useState } from "react";
import {
  MeshToasts,
  pushToast,
  useDirectedEdges,
  useEventLog,
  useNamedPeer,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Cheer = {
  id: string;
  peerId: string;
  to: string;
  emoji: string;
  ts: number;
};

const EMOJIS = ["❤️", "👏", "🙌", "✨", "🌟", "🫶"];
const TTL_MS = 6000;
const RATE_LIMIT_MS = 250;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="cheer-screen">
        <h1>quiet cheer</h1>
        <p className="cheer-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, names, nameOf, myName } = useNamedPeer(config, room);
  const log = useEventLog<Cheer>(room, "cheers");
  const edges = useDirectedEdges(room, "cheer-edges");
  const lastSendAt = useRef(0);
  const [target, setTarget] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const trimmed = name.trim();
  const peers = Object.entries(names).filter(([id]) => id !== room.peerId);
  const validTarget = peers.some(([id]) => id === target) ? target : "";

  const send = (emoji: string) => {
    if (!trimmed || !validTarget) return;
    const t = Date.now();
    if (t - lastSendAt.current < RATE_LIMIT_MS) return;
    lastSendAt.current = t;
    const cheer: Cheer = {
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      to: validTarget,
      emoji,
      ts: t,
    };
    log.push(cheer);
    edges.add(room.peerId, validTarget, emoji);
    const targetName = nameOf(validTarget) ?? validTarget.slice(0, 6);
    pushToast(room, `${myName} → ${targetName} ${emoji}`, {
      ttl: 3500,
      peerId: room.peerId,
      kind: "is-cheer",
    });
  };

  const incomingBursts = log.events.filter((c) => c.to === room.peerId && now - c.ts < TTL_MS);
  const ledger = log.events.slice(-6).reverse();
  const received = log.events.filter((c) => c.to === room.peerId).length;
  const sent = log.events.filter((c) => c.peerId === room.peerId).length;

  const canSend = !!trimmed && !!validTarget;

  return (
    <div className="cheer-screen">
      <MeshToasts room={room} resolveName={nameOf} position="top" />

      <header className="cheer-header">
        <h1>quiet cheer</h1>
        <p className="cheer-status">
          <span className="cheer-tally">
            received <span className="cheer-tally-received">{received}</span> · sent{" "}
            <span className="cheer-tally-sent">{sent}</span>
          </span>
        </p>
      </header>

      <div className="cheer-name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
          maxLength={48}
          aria-label="your name"
        />
      </div>

      <div className="cheer-target" role="group" aria-label="pick a peer">
        {peers.length === 0 || !trimmed ? (
          <p className="cheer-hint">tap a peer to cheer</p>
        ) : (
          peers.map(([id, n]) => (
            <button
              key={id}
              type="button"
              className={`cheer-target-chip${validTarget === id ? " is-selected" : ""}`}
              onClick={() => setTarget(id)}
              aria-label={`target ${n}`}
            >
              {n}
            </button>
          ))
        )}
      </div>

      <div className="cheer-palette" role="group" aria-label="cheer with emoji">
        {EMOJIS.map((g) => (
          <button
            key={g}
            type="button"
            className="cheer-key"
            onClick={() => send(g)}
            disabled={!canSend}
            aria-label={`send ${g}`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="cheer-burst" aria-live="polite">
        {incomingBursts.map((c) => {
          const age = now - c.ts;
          const fade =
            age < 300 ? age / 300 : age > TTL_MS - 600 ? Math.max(0, (TTL_MS - age) / 600) : 1;
          const from = nameOf(c.peerId) ?? c.peerId.slice(0, 6);
          return (
            <div key={c.id} className="cheer-burst-item" style={{ opacity: fade }}>
              <span className="cheer-burst-emoji">{c.emoji}</span>
              <span className="cheer-burst-from">from {from}</span>
            </div>
          );
        })}
      </div>

      <ul className="cheer-ledger">
        {ledger.map((c) => (
          <li key={c.id} className="cheer-ledger-row">
            <span>
              {nameOf(c.peerId) ?? c.peerId.slice(0, 6)} → {nameOf(c.to) ?? c.to.slice(0, 6)}{" "}
              {c.emoji}
            </span>
            <span className="cheer-ledger-age">
              {Math.max(0, Math.round((now - c.ts) / 1000))}s
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
