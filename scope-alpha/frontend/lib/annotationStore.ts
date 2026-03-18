import { create } from "zustand";
import type {
  Annotation,
  AnnotationType,
  AnnotationData,
  DrawingTool,
  LineStyle,
} from "./annotations";

interface AnnotationState {
  // Drawing state
  activeTool: DrawingTool;
  activeColor: string;
  activeLineStyle: LineStyle;
  isDrawing: boolean;
  drawingPoints: { time: number; price: number }[];

  // Annotation data
  annotations: Annotation[];
  selectedAnnotationId: string | null;

  // Layer visibility (analystId -> visible)
  layerVisibility: Record<string, boolean>;

  // Actions
  setActiveTool: (tool: DrawingTool) => void;
  setActiveColor: (color: string) => void;
  setActiveLineStyle: (style: LineStyle) => void;
  setIsDrawing: (drawing: boolean) => void;
  addDrawingPoint: (point: { time: number; price: number }) => void;
  clearDrawingPoints: () => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, data: Partial<Annotation>) => void;
  setSelectedAnnotation: (id: string | null) => void;
  toggleLayerVisibility: (analystId: string) => void;
  setLayerVisibility: (analystId: string, visible: boolean) => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  activeTool: "select",
  activeColor: "#00D4AA",
  activeLineStyle: "solid",
  isDrawing: false,
  drawingPoints: [],
  annotations: [],
  selectedAnnotationId: null,
  layerVisibility: {},

  setActiveTool: (tool) => set({ activeTool: tool, isDrawing: false, drawingPoints: [] }),
  setActiveColor: (color) => set({ activeColor: color }),
  setActiveLineStyle: (style) => set({ activeLineStyle: style }),
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  addDrawingPoint: (point) =>
    set((state) => ({ drawingPoints: [...state.drawingPoints, point] })),
  clearDrawingPoints: () => set({ drawingPoints: [], isDrawing: false }),

  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    })),
  updateAnnotation: (id, data) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...data } : a
      ),
    })),
  setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),
  toggleLayerVisibility: (analystId) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [analystId]: !(state.layerVisibility[analystId] ?? true),
      },
    })),
  setLayerVisibility: (analystId, visible) =>
    set((state) => ({
      layerVisibility: { ...state.layerVisibility, [analystId]: visible },
    })),
}));
