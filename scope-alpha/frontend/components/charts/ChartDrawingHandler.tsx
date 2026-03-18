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
} from "@/lib/annotations";

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chart || !series) return;
    if (activeTool === "select") return;

    const handleClick = (e: MouseEvent) => {
      const point = getTimePrice(e);
      if (!point) return;

      const userId = "local-analyst"; // Will be replaced with session user ID

      if (activeTool === "eraser") {
        // Find closest annotation and delete it
        // For now, just deselect
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

      // Two-click tools: trend_line, price_zone
      if (
        activeTool === "trend_line" ||
        activeTool === "price_zone"
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
    setIsDrawing,
  ]);
}
