// Annotation type definitions and utilities

export type AnnotationType =
  | "horizontal_line"
  | "trend_line"
  | "price_zone"
  | "text_note"
  | "signal_marker"
  | "freehand";

export type LineStyle = "solid" | "dashed" | "dotted";
export type SignalDirection = "long" | "short";
export type SignalMarkerType = "entry" | "target" | "stop";

export interface HorizontalLineData {
  price: number;
  color: string;
  style: LineStyle;
  label?: string;
}

export interface TrendLineData {
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
  color: string;
  style: LineStyle;
}

export interface PriceZoneData {
  topPrice: number;
  bottomPrice: number;
  startTime?: number;
  endTime?: number;
  color: string;
  opacity: number;
}

export interface TextNoteData {
  time: number;
  price: number;
  text: string;
  fontSize: "sm" | "md" | "lg";
  color: string;
}

export interface SignalMarkerData {
  time: number;
  price: number;
  direction: SignalDirection;
  type: SignalMarkerType;
  color: string;
}

export interface FreehandData {
  points: { time: number; price: number }[];
  color: string;
  width: number;
}

export type AnnotationData =
  | HorizontalLineData
  | TrendLineData
  | PriceZoneData
  | TextNoteData
  | SignalMarkerData
  | FreehandData;

export interface Annotation {
  id: string;
  analystId: string;
  assetSymbol: string;
  annotationType: AnnotationType;
  data: AnnotationData;
  timeframe: string | null;
  isActive: boolean;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export type DrawingTool =
  | "horizontal_line"
  | "trend_line"
  | "price_zone"
  | "text_note"
  | "signal_marker"
  | "freehand"
  | "select"
  | "eraser";

export const TOOL_LABELS: Record<DrawingTool, string> = {
  select: "Select",
  horizontal_line: "H-Line",
  trend_line: "Trend",
  price_zone: "Zone",
  text_note: "Text",
  signal_marker: "Signal",
  freehand: "Draw",
  eraser: "Erase",
};

export const TOOL_ICONS: Record<DrawingTool, string> = {
  select: "↖",
  horizontal_line: "─",
  trend_line: "╱",
  price_zone: "▭",
  text_note: "T",
  signal_marker: "⚑",
  freehand: "✎",
  eraser: "⌫",
};

export const DEFAULT_COLORS = [
  "#00D4AA", // green
  "#3B82F6", // blue
  "#EF4444", // red
  "#F59E0B", // yellow
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];
