"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";

type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

type Visibility = "dm_only" | "discovered" | "public";

interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  publicDescription: string | null;
}

interface GraphEntityLink {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  publicRelationType: string | null;
  visibility: Visibility;
  strength: number | null;
}

interface EntityGraphViewProps {
  campaignId: string;
  entities: GraphEntity[];
  links: GraphEntityLink[];
  selectedEntityId?: string;
}

interface SimNode extends SimulationNodeDatum, GraphEntity {
  degree: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  relationType: string;
  publicRelationType: string | null;
  visibility: Visibility;
  strength: number | null;
}

interface RenderNode extends GraphEntity {
  degree: number;
  x: number;
  y: number;
}

interface RenderLink {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  publicRelationType: string | null;
  visibility: Visibility;
  strength: number | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const WIDTH = 960;
const HEIGHT = 520;

const TYPE_LABELS: Record<EntityType, string> = {
  npc: "NPC",
  pc: "PG",
  location: "Luogo",
  faction: "Fazione",
  item: "Oggetto",
  monster: "Mostro",
  deity: "Divinita'",
  organization: "Organizzazione",
};

const TYPE_COLORS: Record<EntityType, { fill: string; stroke: string }> = {
  npc: { fill: "#f97316", stroke: "#9a3412" },
  pc: { fill: "#22c55e", stroke: "#166534" },
  location: { fill: "#38bdf8", stroke: "#0369a1" },
  faction: { fill: "#ef4444", stroke: "#991b1b" },
  item: { fill: "#facc15", stroke: "#a16207" },
  monster: { fill: "#a855f7", stroke: "#6b21a8" },
  deity: { fill: "#14b8a6", stroke: "#0f766e" },
  organization: { fill: "#64748b", stroke: "#334155" },
};

function getNodeRadius(node: Pick<RenderNode, "degree">) {
  return Math.min(26, 11 + node.degree * 2);
}

function nodeId(value: string | number | SimNode) {
  return typeof value === "object" ? value.id : String(value);
}

function sourceId(link: SimLink) {
  return nodeId(link.source);
}

function targetId(link: SimLink) {
  return nodeId(link.target);
}

function sourceNode(link: SimLink) {
  return typeof link.source === "object" ? link.source : undefined;
}

function targetNode(link: SimLink) {
  return typeof link.target === "object" ? link.target : undefined;
}

export function EntityGraphView({
  campaignId,
  entities,
  links,
  selectedEntityId,
}: EntityGraphViewProps) {
  const [publicOnly, setPublicOnly] = useState(false);
  const graph = useMemo(() => {
    const visibleLinks = publicOnly
      ? links.filter((link) => link.visibility === "public")
      : links;
    const degreeById = new Map(entities.map((entity) => [entity.id, 0]));

    for (const link of visibleLinks) {
      degreeById.set(link.sourceEntityId, (degreeById.get(link.sourceEntityId) ?? 0) + 1);
      degreeById.set(link.targetEntityId, (degreeById.get(link.targetEntityId) ?? 0) + 1);
    }

    return {
      nodes: entities.map<SimNode>((entity, index) => ({
        ...entity,
        degree: degreeById.get(entity.id) ?? 0,
        x: WIDTH / 2 + Math.cos(index) * 120,
        y: HEIGHT / 2 + Math.sin(index) * 120,
      })),
      links: visibleLinks.map<SimLink>((link) => ({
        id: link.id,
        source: link.sourceEntityId,
        target: link.targetEntityId,
        relationType: link.relationType,
        publicRelationType: link.publicRelationType,
        visibility: link.visibility,
        strength: link.strength,
      })),
    };
  }, [entities, links, publicOnly]);

  const [renderGraph, setRenderGraph] = useState<{
    nodes: RenderNode[];
    links: RenderLink[];
  }>({ nodes: [], links: [] });

  // Pan & zoom: transform `translate(x,y) scale(k)` applicato al gruppo
  // che contiene nodi+link. Tutta la matematica e' in coordinate SVG
  // (viewBox 0..WIDTH x 0..HEIGHT) per restare risoluzione-indipendente.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  // Pan in corso: usiamo i ref invece di state cosi' i tick di
  // onMouseMove non triggerano render React inutili.
  const panStateRef = useRef<{
    startSvgX: number;
    startSvgY: number;
    originX: number;
    originY: number;
    movedPx: number;
  } | null>(null);
  // Soglia: se durante un click il mouse si muove piu' di N pixel sul
  // viewport, sopprimi la navigazione del Link sottostante: l'utente
  // stava pannando, non cliccando.
  const suppressNextClickRef = useRef(false);

  // Converte le coordinate viewport (clientX/Y) nelle coordinate SVG
  // del viewBox (0..WIDTH x 0..HEIGHT). Necessario perche' il pan/zoom
  // ragiona in viewBox-space.
  const viewportToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const ratioX = WIDTH / rect.width;
    const ratioY = HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * ratioX,
      y: (clientY - rect.top) * ratioY,
    };
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const { x: mouseX, y: mouseY } = viewportToSvg(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      setTransform((current) => {
        const newK = Math.min(4, Math.max(0.3, current.k * factor));
        const ratio = newK / current.k;
        // Mantieni il punto sotto il cursore fisso durante lo zoom.
        return {
          k: newK,
          x: mouseX - (mouseX - current.x) * ratio,
          y: mouseY - (mouseY - current.y) * ratio,
        };
      });
    },
    [viewportToSvg],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // Solo tasto sinistro. Middle/right per gli usi futuri.
      if (event.button !== 0) return;
      const { x, y } = viewportToSvg(event.clientX, event.clientY);
      panStateRef.current = {
        startSvgX: x,
        startSvgY: y,
        originX: transform.x,
        originY: transform.y,
        movedPx: 0,
      };
      suppressNextClickRef.current = false;
    },
    [viewportToSvg, transform.x, transform.y],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const state = panStateRef.current;
      if (!state) return;
      const { x, y } = viewportToSvg(event.clientX, event.clientY);
      const dxSvg = x - state.startSvgX;
      const dySvg = y - state.startSvgY;
      state.movedPx += Math.abs(event.movementX) + Math.abs(event.movementY);
      if (state.movedPx > 5) suppressNextClickRef.current = true;
      setTransform((current) => ({
        ...current,
        x: state.originX + dxSvg,
        y: state.originY + dySvg,
      }));
    },
    [viewportToSvg],
  );

  const endPan = useCallback(() => {
    panStateRef.current = null;
  }, []);

  // Click-capture al livello svg: se l'utente ha pannato, sopprime la
  // navigazione del `<Link>` sottostante. Altrimenti lascia passare.
  const handleClickCapture = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (suppressNextClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextClickRef.current = false;
      }
    },
    [],
  );

  const zoomBy = useCallback((factor: number) => {
    setTransform((current) => {
      const newK = Math.min(4, Math.max(0.3, current.k * factor));
      const ratio = newK / current.k;
      // Zoom centrato sul viewBox.
      return {
        k: newK,
        x: WIDTH / 2 - (WIDTH / 2 - current.x) * ratio,
        y: HEIGHT / 2 - (HEIGHT / 2 - current.y) * ratio,
      };
    });
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

  useEffect(() => {
    if (graph.nodes.length === 0) return;

    let tick = 0;
    const simulation = forceSimulation<SimNode>(graph.nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(graph.links)
          .id((node) => node.id)
          .distance((link) => 130 - Math.min(link.strength ?? 3, 8) * 6)
          .strength(0.38),
      )
      .force("charge", forceManyBody<SimNode>().strength(-340))
      .force("collide", forceCollide<SimNode>().radius((node) => getNodeRadius(node) + 26))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("x", forceX<SimNode>(WIDTH / 2).strength(0.035))
      .force("y", forceY<SimNode>(HEIGHT / 2).strength(0.045))
      .alpha(0.95)
      .alphaDecay(0.035);

    function publish() {
      const byId = new Map(graph.nodes.map((node) => [node.id, node]));
      setRenderGraph({
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          name: node.name,
          publicDescription: node.publicDescription,
          degree: node.degree,
          x: node.x ?? WIDTH / 2,
          y: node.y ?? HEIGHT / 2,
        })),
        links: graph.links.flatMap((link) => {
          const source = sourceNode(link) ?? byId.get(sourceId(link));
          const target = targetNode(link) ?? byId.get(targetId(link));
          if (!source || !target) return [];
          return [
            {
              id: link.id,
              sourceId: source.id,
              targetId: target.id,
              relationType: link.relationType,
              publicRelationType: link.publicRelationType,
              visibility: link.visibility,
              strength: link.strength,
              x1: source.x ?? WIDTH / 2,
              y1: source.y ?? HEIGHT / 2,
              x2: target.x ?? WIDTH / 2,
              y2: target.y ?? HEIGHT / 2,
            },
          ];
        }),
      });
    }

    simulation.on("tick", () => {
      tick += 1;
      if (tick % 2 === 0 || simulation.alpha() < 0.08) publish();
    });

    return () => {
      simulation.stop();
    };
  }, [graph]);

  const shownLinksCount = renderGraph.links.length;
  const linkedNodeIds = new Set(
    renderGraph.links.flatMap((link) => [link.sourceId, link.targetId]),
  );

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-semibold">Grafo entita&apos;</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {entities.length} nodi, {shownLinksCount} link visibil
            {shownLinksCount === 1 ? "e" : "i"}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={publicOnly}
            onChange={(event) => setPublicOnly(event.target.checked)}
            className="size-4 rounded border-zinc-300 text-zinc-900"
          />
          Mostra solo links pubblici
        </label>
      </div>

      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const colors = TYPE_COLORS[type as EntityType];
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: colors.fill,
                    border: `1px solid ${colors.stroke}`,
                  }}
                />
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {entities.length === 0 ? (
        <div className="p-8 text-sm text-zinc-500 dark:text-zinc-400">
          Nessuna entita&apos; da mostrare nel grafo.
        </div>
      ) : (
        <div className="relative h-[520px] bg-zinc-50 dark:bg-zinc-950">
          <svg
            role="img"
            aria-label="Grafo delle entita' della campagna"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-full w-full"
          >
            <defs>
              <marker
                id="entity-graph-arrow"
                viewBox="0 -5 10 10"
                refX="21"
                refY="0"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="#94a3b8" />
              </marker>
            </defs>

            <g>
              {renderGraph.links.map((link) => (
                <g key={link.id}>
                  <line
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={link.visibility === "public" ? "#0f766e" : "#94a3b8"}
                    strokeOpacity={link.visibility === "public" ? 0.7 : 0.42}
                    strokeWidth={Math.max(1.2, Math.min(link.strength ?? 2, 8) / 2)}
                    markerEnd="url(#entity-graph-arrow)"
                  />
                  <text
                    x={(link.x1 + link.x2) / 2}
                    y={(link.y1 + link.y2) / 2}
                    textAnchor="middle"
                    className="fill-zinc-500 text-[10px] dark:fill-zinc-400"
                  >
                    {publicOnly
                      ? link.publicRelationType ?? link.relationType
                      : link.relationType}
                  </text>
                </g>
              ))}
            </g>

            <g>
              {renderGraph.nodes.map((node) => {
                const colors = TYPE_COLORS[node.type];
                const radius = getNodeRadius(node);
                const isSelected = node.id === selectedEntityId;
                const isUnlinked = !linkedNodeIds.has(node.id);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    opacity={isUnlinked && shownLinksCount > 0 ? 0.62 : 1}
                  >
                    <Link href={`/campaigns/${campaignId}?focus=${node.id}#entity-detail`}>
                      <circle
                        r={radius}
                        fill={colors.fill}
                        stroke={isSelected ? "#18181b" : colors.stroke}
                        strokeWidth={isSelected ? 4 : 2}
                        className="transition-opacity hover:opacity-80"
                      />
                      <text
                        y={radius + 14}
                        textAnchor="middle"
                        className="pointer-events-none fill-zinc-900 text-[11px] font-medium dark:fill-zinc-100"
                      >
                        {node.name.length > 18
                          ? `${node.name.slice(0, 17)}...`
                          : node.name}
                      </text>
                      <title>
                        {node.name} - {TYPE_LABELS[node.type]}
                        {node.publicDescription ? `\n${node.publicDescription}` : ""}
                      </title>
                    </Link>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </section>
  );
}
