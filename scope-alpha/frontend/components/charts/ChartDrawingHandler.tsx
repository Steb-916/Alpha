"use client";

import { useCallback, useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useAnnotationStore } from "@/lib/annotationStore";
import type {
  Annotation,
  HorizontalLineData,
  TrendLineData,
  PriceZoneData,
  TextNoteData,
  SignalMarkerData,
  FreehandData,
  FibonacciData,
} from "@/lib/annotations";
import { FIB_LEVELS } from "@/lib/annotations";

const ERASER_HIT_THRESHOLD_PX = 12;

// Distance from point p to segment a→b in pixel space.
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

interface ChartDrawingHandlerProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  assetSymbol: string;
  timeframe: string;
  onAnnotationCreated: (annotation: Omit<Annotation, "id" | "createdAt" | "updatedAt" | "expiresAt">) => void;
  onAnnotationDeleted: (id: string) => void;
}

export function useChartDrawingHandler({
  chart,
  series,
  containerRef,
  assetSymbol,
  timeframe,
  onAnnotationCreated,
  onAnnotationDeleted,
}: ChartDrawingHandlerProps) {
  const {
    activeTool,
    activeColor,
    activeLineStyle,
    isDrawing,
    drawingPoints,
    setIsDrawing,
    addDrawingPoint,
    clearDrawingPoints,
    annotations,
    selectedAnnotationId,
    setSelectedAnnotation,
  } = useAnnotationStore();

  const firstPointRef = useRef<{ time: number; price: number } | null>(null);

  const getTimePrice = useCallback(
    (e: MouseEvent): { time: number; price: number } | null => {
      if (!chart || !series || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const timeCoord = chart.timeScale().coordinateToTime(x);
      const priceCoord = series.coordinateToPrice(y);

      if (timeCoord === null || priceCoord === null) return null;
      return { time: timeCoord as number, price: priceCoord };
    },
    [chart, series, containerRef]
  );

  // Hit-test the annotations for this chart against the click pixel, returning
  // the closest annotation within a threshold. All distances are computed in
  // pixel space so the threshold is consistent regardless of zoom.
  const findClosestAnnotation = useCallback(
    (clickX: number, clickY: number): Annotation | null => {
      if (!chart || !series) return null;

      const timeToX = (t: number) =>
        chart.timeScale().timeToCoordinate(t as any) as number | null;
      const priceToY = (p: number) => series.priceToCoordinate(p);

      let best: { ann: Annotation; dist: number } | null = null;
      const considered = annotations.filter(
        (a) => a.assetSymbol === assetSymbol && a.isActive
      );

      for (const ann of considered) {
        let dist = Infinity;
        const d = ann.data as any;

        if (ann.annotationType === "horizontal_line") {
          const y = priceToY((d as HorizontalLineData).price);
          if (y === null) continue;
          dist = Math.abs(clickY - y);
        } else if (ann.annotationType === "trend_line") {
          const tl = d as TrendLineData;
          const ax = timeToX(tl.startTime);
          const ay = priceToY(tl.startPrice);
          const bx = timeToX(tl.endTime);
          const by = priceToY(tl.endPrice);
          if (ax === null || bx === null || ay === null || by === null) continue;
          dist = pointToSegmentDistance(clickX, clickY, ax, ay, bx, by);
        } else if (ann.annotationType === "price_zone") {
          const pz = d as PriceZoneData;
          const topY = priceToY(pz.topPrice);
          const botY = priceToY(pz.bottomPrice);
          if (topY === null || botY === null) continue;
          const yMin = Math.min(topY, botY);
          const yMax = Math.max(topY, botY);
          if (clickY >= yMin && clickY <= yMax) {
            // Inside the zone: treat as zero distance.
            dist = 0;
          } else {
            dist = Math.min(Math.abs(clickY - yMin), Math.abs(clickY - yMax));
          }
        } else if (
          ann.annotationType === "text_note" ||
          ann.annotationType === "signal_marker"
        ) {
          const tn = d as TextNoteData | SignalMarkerData;
          const x = timeToX(tn.time);
          const y = priceToY(tn.price);
          if (x === null || y === null) continue;
          const ddx = clickX - x;
          const ddy = clickY - y;
          dist = Math.sqrt(ddx * ddx + ddy * ddy);
        } else if (ann.annotationType === "freehand") {
          const fh = d as FreehandData;
          for (let i = 1; i < fh.points.length; i++) {
            const a = fh.points[i - 1];
            const b = fh.points[i];
            const ax = timeToX(a.time);
            const ay = priceToY(a.price);
            const bx = timeToX(b.time);
            const by = priceToY(b.price);
            if (ax === null || bx === null || ay === null || by === null) continue;
            const segDist = pointToSegmentDistance(clickX, clickY, ax, ay, bx, by);
            if (segDist < dist) dist = segDist;
          }
        } else if (ann.annotationType === "fibonacci") {
          // A click near any of the level lines counts as a hit on the whole
          // fib. Levels are horizontal between startTime and the right edge,
          // so distance is min(|clickY - levelY|) across all levels.
          const fib = d as FibonacciData;
          const startX = timeToX(fib.startTime);
          if (startX === null) continue;
          // Only consider clicks to the right of the start anchor (where the
          // fib is actually drawn).
          if (clickX < startX - ERASER_HIT_THRESHOLD_PX) continue;
          const levels = fib.levels ?? FIB_LEVELS;
          for (const lvl of levels) {
            const levelPrice =
              fib.endPrice + (fib.startPrice - fib.endPrice) * lvl;
            const y = priceToY(levelPrice);
            if (y === null) continue;
            const levelDist = Math.abs(clickY - y);
            if (levelDist < dist) dist = levelDist;
          }
        }

        if (dist <= ERASER_HIT_THRESHOLD_PX && (!best || dist < best.dist)) {
          best = { ann, dist };
        }
      }

      return best?.ann ?? null;
    },
    [chart, series, annotations, assetSymbol]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chart || !series) return;
    if (activeTool === "select") return;

    const handleClick = (e: MouseEvent) => {
      const point = getTimePrice(e);
      if (!point) return;

      const userId = "local-analyst"; // Parent overrides analystId with session user id before persist.

      if (activeTool === "eraser") {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const hit = findClosestAnnotation(clickX, clickY);
        if (hit) onAnnotationDeleted(hit.id);
        return;
      }

      if (activeTool === "horizontal_line") {
        const data: HorizontalLineData = {
          price: point.price,
          color: activeColor,
          style: activeLineStyle,
        };
        onAnnotationCreated({
          analystId: userId,
          assetSymbol,
          annotationType: "horizontal_line",
          data,
          timeframe,
          isActive: true,
          isDraft: false,
        });
        return;
      }

      if (activeTool === "text_note") {
        const text = prompt("Enter note text:");
        if (!text) return;
        const data: TextNoteData = {
          time: point.time,
          price: point.price,
          text,
          fontSize: "md",
          color: activeColor,
        };
        onAnnotationCreated({
          analystId: userId,
          assetSymbol,
          annotationType: "text_note",
          data,
          timeframe,
          isActive: true,
          isDraft: false,
        });
        return;
      }

      if (activeTool === "signal_marker") {
        const direction = confirm("Long signal? (Cancel for Short)")
          ? "long"
          : "short";
        const data: SignalMarkerData = {
          time: point.time,
          price: point.price,
          direction,
          type: "entry",
          color: activeColor,
        };
        onAnnotationCreated({
          analystId: userId,
          assetSymbol,
          annotationType: "signal_marker",
          data,
          timeframe,
          isActive: true,
          isDraft: false,
        });
        return;
      }

      // Two-click tools: trend_line, price_zone, fibonacci
      if (
        activeTool === "trend_line" ||
        activeTool === "price_zone" ||
        activeTool === "fibonacci"
      ) {
        if (!firstPointRef.current) {
          firstPointRef.current = point;
          setIsDrawing(true);
          return;
        }

        const start = firstPointRef.current;
        firstPointRef.current = null;
        setIsDrawing(false);

        if (activeTool === "trend_line") {
          const data: TrendLineData = {
            startTime: start.time,
            startPrice: start.price,
            endTime: point.time,
            endPrice: point.price,
            color: activeColor,
            style: activeLineStyle,
          };
          onAnnotationCreated({
            analystId: userId,
            assetSymbol,
            annotationType: "trend_line",
            data,
            timeframe,
            isActive: true,
            isDraft: false,
          });
        } else if (activeTool === "fibonacci") {
          // Preserve click order: first click = startPrice (100% level),
          // second click = endPrice (0% level). Trader convention is to draw
          // from swing high → swing low, which puts 0% at the low.
          const data: FibonacciData = {
            startTime: Math.min(start.time, point.time),
            startPrice: start.price,
            endTime: Math.max(start.time, point.time),
            endPrice: point.price,
            color: activeColor,
          };
          onAnnotationCreated({
            analystId: userId,
            assetSymbol,
            annotationType: "fibonacci",
            data,
            timeframe,
            isActive: true,
            isDraft: false,
          });
        } else {
          const data: PriceZoneData = {
            topPrice: Math.max(start.price, point.price),
            bottomPrice: Math.min(start.price, point.price),
            color: activeColor,
            opacity: 0.15,
          };
          onAnnotationCreated({
            analystId: userId,
            assetSymbol,
            annotationType: "price_zone",
            data,
            timeframe,
            isActive: true,
            isDraft: false,
          });
        }
        return;
      }
    };

    // Freehand: mousedown -> track -> mouseup
    let freehandPoints: { time: number; price: number }[] = [];
    let isFreehandDrawing = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (activeTool !== "freehand") return;
      const point = getTimePrice(e);
      if (!point) return;
      isFreehandDrawing = true;
      freehandPoints = [point];
      setIsDrawing(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isFreehandDrawing || activeTool !== "freehand") return;
      const point = getTimePrice(e);
      if (!point) return;
      freehandPoints.push(point);
    };

    const handleMouseUp = () => {
      if (!isFreehandDrawing || activeTool !== "freehand") return;
      isFreehandDrawing = false;
      setIsDrawing(false);

      if (freehandPoints.length > 2) {
        const data: FreehandData = {
          points: freehandPoints,
          color: activeColor,
          width: 2,
        };
        onAnnotationCreated({
          // Parent overrides analystId with session user id before persist.
          analystId: "local-analyst",
          assetSymbol,
          annotationType: "freehand",
          data,
          timeframe,
          isActive: true,
          isDraft: false,
        });
      }
      freehandPoints = [];
    };

    container.addEventListener("click", handleClick);
    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    chart,
    series,
    containerRef,
    activeTool,
    activeColor,
    activeLineStyle,
    assetSymbol,
    timeframe,
    getTimePrice,
    onAnnotationCreated,
    onAnnotationDeleted,
    findClosestAnnotation,
    setIsDrawing,
  ]);
}
