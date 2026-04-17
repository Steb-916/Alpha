"use client";

import { useEffect, useRef, useCallback } from "react";
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
  AnnotationType,
} from "@/lib/annotations";
import { FIB_LEVELS } from "@/lib/annotations";

interface AnnotationOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useAnnotationRenderer({
  chart,
  series,
  containerRef,
}: AnnotationOverlayProps) {
  const priceLineRefs = useRef<Map<string, ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>>>(new Map());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { annotations, layerVisibility } = useAnnotationStore();

  // Get visible annotations
  const visibleAnnotations = annotations.filter((a) => {
    if (!a.isActive) return false;
    if (a.isDraft) return false;
    const visible = layerVisibility[a.analystId] ?? true;
    return visible;
  });

  // Convert time/price to pixel coordinates
  const toPixel = useCallback(
    (time: number, price: number): { x: number; y: number } | null => {
      if (!chart || !series) return null;
      try {
        const timeCoord = chart.timeScale().timeToCoordinate(time as any);
        const priceCoord = series.priceToCoordinate(price);
        if (timeCoord === null || priceCoord === null) return null;
        return { x: timeCoord, y: priceCoord };
      } catch {
        return null;
      }
    },
    [chart, series]
  );

  // Render horizontal lines using lightweight-charts price lines
  useEffect(() => {
    if (!series) return;

    // Clear old price lines
    priceLineRefs.current.forEach((pl) => {
      try {
        series.removePriceLine(pl);
      } catch {
        // ignore
      }
    });
    priceLineRefs.current.clear();

    // Add new price lines for horizontal_line annotations
    const hLines = visibleAnnotations.filter(
      (a) => a.annotationType === "horizontal_line"
    );

    hLines.forEach((a) => {
      const data = a.data as HorizontalLineData;
      const lineStyle =
        data.style === "dashed" ? 1 : data.style === "dotted" ? 2 : 0;
      const pl = series.createPriceLine({
        price: data.price,
        color: data.color,
        lineWidth: 1,
        lineStyle,
        axisLabelVisible: true,
        title: data.label || "",
      });
      priceLineRefs.current.set(a.id, pl);
    });

    // Add signal markers as price lines too
    const signals = visibleAnnotations.filter(
      (a) => a.annotationType === "signal_marker"
    );
    signals.forEach((a) => {
      const data = a.data as SignalMarkerData;
      const isEntry = data.type === "entry";
      const isTarget = data.type === "target";
      const color = isEntry
        ? data.direction === "long"
          ? "#10B981"
          : "#EF4444"
        : isTarget
        ? "#10B981"
        : "#EF4444";
      const label = isEntry
        ? `${data.direction === "long" ? "▲" : "▼"} ENTRY`
        : isTarget
        ? "TP"
        : "SL";
      const pl = series.createPriceLine({
        price: data.price,
        color,
        lineWidth: 1,
        lineStyle: isEntry ? 0 : 1,
        axisLabelVisible: true,
        title: label,
      });
      priceLineRefs.current.set(a.id, pl);
    });

    return () => {
      priceLineRefs.current.forEach((pl) => {
        try {
          series.removePriceLine(pl);
        } catch {
          // ignore
        }
      });
      priceLineRefs.current.clear();
    };
  }, [series, visibleAnnotations]);

  // Render SVG overlays (trend lines, zones, text, freehand)
  useEffect(() => {
    if (!containerRef.current || !chart || !series) return;

    // Create or get SVG overlay
    let svg = svgRef.current;
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.pointerEvents = "none";
      svg.style.zIndex = "5";
      containerRef.current.appendChild(svg);
      svgRef.current = svg;
    }

    const render = () => {
      if (!svg) return;
      // Clear existing SVG content
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      // Render trend lines
      visibleAnnotations
        .filter((a) => a.annotationType === "trend_line")
        .forEach((a) => {
          const data = a.data as TrendLineData;
          const start = toPixel(data.startTime, data.startPrice);
          const end = toPixel(data.endTime, data.endPrice);
          if (!start || !end) return;

          const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          line.setAttribute("x1", String(start.x));
          line.setAttribute("y1", String(start.y));
          line.setAttribute("x2", String(end.x));
          line.setAttribute("y2", String(end.y));
          line.setAttribute("stroke", data.color);
          line.setAttribute("stroke-width", "2");
          if (data.style === "dashed")
            line.setAttribute("stroke-dasharray", "6,4");
          if (data.style === "dotted")
            line.setAttribute("stroke-dasharray", "2,3");
          svg!.appendChild(line);
        });

      // Render zones
      visibleAnnotations
        .filter((a) => a.annotationType === "price_zone")
        .forEach((a) => {
          const data = a.data as PriceZoneData;
          const topCoord = series!.priceToCoordinate(data.topPrice);
          const bottomCoord = series!.priceToCoordinate(data.bottomPrice);
          if (topCoord === null || bottomCoord === null) return;

          const rect = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          const containerWidth = containerRef.current?.clientWidth || 800;
          rect.setAttribute("x", "0");
          rect.setAttribute("y", String(Math.min(topCoord, bottomCoord)));
          rect.setAttribute("width", String(containerWidth));
          rect.setAttribute(
            "height",
            String(Math.abs(bottomCoord - topCoord))
          );
          rect.setAttribute("fill", data.color);
          rect.setAttribute("opacity", String(data.opacity || 0.15));
          svg!.appendChild(rect);
        });

      // Render text notes
      visibleAnnotations
        .filter((a) => a.annotationType === "text_note")
        .forEach((a) => {
          const data = a.data as TextNoteData;
          const pos = toPixel(data.time, data.price);
          if (!pos) return;

          const fontSize =
            data.fontSize === "lg" ? 14 : data.fontSize === "md" ? 12 : 10;

          // Background rect
          const bg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          bg.setAttribute("x", String(pos.x - 2));
          bg.setAttribute("y", String(pos.y - fontSize - 2));
          bg.setAttribute("width", String(data.text.length * fontSize * 0.6 + 8));
          bg.setAttribute("height", String(fontSize + 8));
          bg.setAttribute("rx", "4");
          bg.setAttribute("fill", "rgba(0,0,0,0.6)");
          svg!.appendChild(bg);

          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          text.setAttribute("x", String(pos.x + 2));
          text.setAttribute("y", String(pos.y - 2));
          text.setAttribute("fill", data.color || "#fff");
          text.setAttribute("font-size", String(fontSize));
          text.setAttribute("font-family", "'JetBrains Mono', monospace");
          text.textContent = data.text;
          svg!.appendChild(text);
        });

      // Render freehand
      visibleAnnotations
        .filter((a) => a.annotationType === "freehand")
        .forEach((a) => {
          const data = a.data as FreehandData;
          if (data.points.length < 2) return;

          const pathParts: string[] = [];
          data.points.forEach((pt, i) => {
            const pos = toPixel(pt.time, pt.price);
            if (!pos) return;
            pathParts.push(
              `${i === 0 ? "M" : "L"} ${pos.x} ${pos.y}`
            );
          });

          if (pathParts.length < 2) return;

          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          path.setAttribute("d", pathParts.join(" "));
          path.setAttribute("stroke", data.color);
          path.setAttribute("stroke-width", String(data.width || 2));
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          svg!.appendChild(path);
        });

      // Render Fibonacci retracement — draws horizontal level lines between
      // startPrice (100%) and endPrice (0%) from startTime to the chart's
      // right edge, with a labeled percentage at the right end of each line.
      visibleAnnotations
        .filter((a) => a.annotationType === "fibonacci")
        .forEach((a) => {
          const data = a.data as FibonacciData;
          const startX = chart!.timeScale().timeToCoordinate(data.startTime as any);
          if (startX === null) return;
          const containerWidth = containerRef.current?.clientWidth || 800;
          // Extend lines to the right edge (leave 60px for labels).
          const endX = containerWidth - 60;
          if (endX <= startX) return;

          const levels = data.levels ?? FIB_LEVELS;
          // Golden ratio gets a slightly bolder treatment.
          const isGolden = (lvl: number) => Math.abs(lvl - 0.618) < 0.001;
          // Light fill between 0 and 1 for visual anchoring.
          const startY = series!.priceToCoordinate(data.startPrice);
          const endY = series!.priceToCoordinate(data.endPrice);
          if (startY !== null && endY !== null) {
            const fillRect = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect"
            );
            fillRect.setAttribute("x", String(startX));
            fillRect.setAttribute("y", String(Math.min(startY, endY)));
            fillRect.setAttribute("width", String(endX - startX));
            fillRect.setAttribute("height", String(Math.abs(endY - startY)));
            fillRect.setAttribute("fill", data.color);
            fillRect.setAttribute("opacity", "0.04");
            svg!.appendChild(fillRect);
          }

          for (const lvl of levels) {
            const levelPrice =
              data.endPrice + (data.startPrice - data.endPrice) * lvl;
            const y = series!.priceToCoordinate(levelPrice);
            if (y === null) continue;

            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", String(startX));
            line.setAttribute("y1", String(y));
            line.setAttribute("x2", String(endX));
            line.setAttribute("y2", String(y));
            line.setAttribute("stroke", data.color);
            line.setAttribute("stroke-width", isGolden(lvl) ? "1.5" : "1");
            line.setAttribute(
              "stroke-opacity",
              lvl === 0 || lvl === 1 ? "0.9" : isGolden(lvl) ? "0.75" : "0.5"
            );
            if (lvl !== 0 && lvl !== 1 && !isGolden(lvl)) {
              line.setAttribute("stroke-dasharray", "3,3");
            }
            svg!.appendChild(line);

            // Label (e.g. "61.8%") to the right of the line. Integer levels
            // (0, 50, 100) drop the decimal; fractional levels keep one digit.
            const pctNum = lvl * 100;
            const pct = Number.isInteger(pctNum)
              ? pctNum.toFixed(0)
              : pctNum.toFixed(1);
            const label = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "text"
            );
            label.setAttribute("x", String(endX + 4));
            label.setAttribute("y", String(y + 3));
            label.setAttribute("fill", data.color);
            label.setAttribute("font-size", "10");
            label.setAttribute("font-family", "'JetBrains Mono', monospace");
            label.setAttribute(
              "opacity",
              lvl === 0 || lvl === 1 ? "1" : isGolden(lvl) ? "0.95" : "0.7"
            );
            label.textContent = `${pct}%`;
            svg!.appendChild(label);
          }
        });
    };

    render();

    // Re-render on chart scroll/zoom
    chart.timeScale().subscribeVisibleLogicalRangeChange(render);

    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(render);
      } catch {
        // chart may already be disposed
      }
    };
  }, [chart, series, containerRef, visibleAnnotations, toPixel]);

  // Cleanup SVG on unmount
  useEffect(() => {
    return () => {
      if (svgRef.current && svgRef.current.parentNode) {
        svgRef.current.parentNode.removeChild(svgRef.current);
        svgRef.current = null;
      }
    };
  }, []);
}
