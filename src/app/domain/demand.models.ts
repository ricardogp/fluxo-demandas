/** Shared model between the simulation state and its presentation components. */
export interface DemandEvent {
  demandNumber: string;
  demandTitle: string;
  demandType: string;
  status: string;
  startedAt: Date;
  endedAt: Date;
  row: number;
}

// The logical dates only drive replay when the spreadsheet has same-day steps.
// The imported dates remain the source for duration metrics.
export interface TimelineEvent extends DemandEvent {
  timelineStartedAt: Date;
  timelineEndedAt: Date;
  hasSameDaySequence: boolean;
  usesLogicalTime: boolean;
}

export interface DemandHistory {
  number: string;
  title: string;
  demandType: string;
  events: TimelineEvent[];
}

export interface ActiveDemand {
  number: string;
  title: string;
  demandType: string;
  event: TimelineEvent;
  events: TimelineEvent[];
  progress: number;
}

export interface StatusDuration { status: string; durationMs: number; }
export interface ActiveHint { item: ActiveDemand; x: number; y: number; below: boolean; }
export interface PhaseHint { status: string; items: ActiveDemand[]; x: number; y: number; below: boolean; }
export interface StatusMetrics { maxConcurrent: number; averageMs: number; p90Ms: number; p95Ms: number; }
export interface PhaseVisit { status: string; startedAt: Date; endedAt: Date; usesLogicalTime: boolean; }
export interface TimelineChartPeak { count: number; time: number; x: number; y: number; }
export interface TimelineChartView {
  width: number;
  height: number;
  baseline: number;
  maximum: number;
  statuses: string[];
  areaPoints: string;
  linePoints: string;
  peak: TimelineChartPeak;
}

export type GraphPhaseLoadState = "empty" | "neutral" | "warning" | "critical" | "overloaded";
export interface GraphPoint { x: number; y: number; }
export interface GraphPhaseNode {
  status: string;
  labelLines: string[];
  color: string;
  countColor: string;
  loadState: GraphPhaseLoadState;
  activeCount: number;
  x: number;
  y: number;
}
export interface GraphTransition {
  source: string;
  target: string;
  color: string;
  count: number;
  strokeWidth: number;
  activeDemandCount: number;
  path: string;
  points: GraphPoint[];
}
export interface GraphDemandNode {
  number: string;
  title: string;
  demandType: string;
  item: ActiveDemand;
  color: string;
  routeColor: string;
  source: string;
  target?: string;
  progress: number;
  laneOffset: number;
  x: number;
  y: number;
}
export interface GraphView { height: number; phases: GraphPhaseNode[]; transitions: GraphTransition[]; demands: GraphDemandNode[]; }

export type VisibilityFilter = "status" | "demand" | "demandType";
export type VisualizationFormat = "table" | "graph";
export type DemandRepresentation = "detailedCard" | "number";
export type GraphDemandRepresentation = "circle" | "number";
export type GraphRoutingAlgorithm = "standard" | "optimized";
