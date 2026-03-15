import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlignmentCanvas } from "./AlignmentCanvas";
import { parseAlignment } from "./alignmentParser";
import { createLayoutMetrics, normalizeSelection } from "./layout";
import { exportPdf, exportPng, exportSvg } from "./export";
import { parseSecondaryStructureTrack } from "./secondaryStructure";
import { sampleAlignment } from "./sampleAlignment";
import { downloadBlob, makeId } from "./utils";
import type {
  AlignmentData,
  Annotation,
  CellAnchor,
  ConservationColorOverrides,
  EspriptPreset,
  SecondaryStructureTrack,
  Selection,
  TextAnnotation,
  Tool,
  VisualizationMode,
} from "./types";

const toolOptions: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "highlight", label: "Highlight" },
  { id: "box", label: "Box" },
  { id: "triangle-up", label: "Triangle Up" },
  { id: "triangle-down", label: "Triangle Down" },
  { id: "arrow-down", label: "Arrow Down" },
  { id: "arrow", label: "Arrow" },
  { id: "bracket", label: "Bracket" },
  { id: "circle", label: "Circle" },
  { id: "open-circle", label: "Open Circle" },
  { id: "star", label: "Star" },
  { id: "bridge", label: "Bridge" },
  { id: "text", label: "Text" },
  { id: "erase", label: "Erase" },
];

const quickToolOptions: { id: Tool; label: string }[] = [
  { id: "highlight", label: "Highlight" },
  { id: "box", label: "Box" },
  { id: "text", label: "Text" },
  { id: "arrow", label: "Arrow" },
  { id: "bridge", label: "Bridge" },
  { id: "bracket", label: "Bracket" },
  { id: "erase", label: "Erase" },
];

const toolIcons: Record<Tool, string> = {
  select: "⌖",
  highlight: "◧",
  box: "□",
  "triangle-up": "▲",
  "triangle-down": "▼",
  "arrow-down": "↓",
  arrow: "→",
  bracket: "⟦",
  circle: "●",
  "open-circle": "○",
  star: "✦",
  bridge: "⊓",
  text: "T",
  erase: "⌫",
};

const sectionIcons: Record<keyof typeof defaultOpenSections, string> = {
  alignment: "↕",
  appearance: "◫",
  structure: "α",
  library: "✦",
  project: "↓",
};

const defaultOpenSections = {
  alignment: true,
  appearance: true,
  structure: true,
  library: true,
  project: true,
};

const starterText = "Active-site loop";
const defaultConservationColors: ConservationColorOverrides = {
  strict: "#d92d20",
  similar: "#f79009",
  weak: "#fdb022",
  neutral: "#d0d5dd",
};

type DragSelection = {
  active: boolean;
  selection: Selection | null;
};

type AnnotationDrag = {
  mode: "text" | "arrow-tail" | "arrow-head";
  annotationId: string;
  pointerStartX: number;
  pointerStartY: number;
  originalDx: number;
  originalDy: number;
};

type ProjectState = {
  version: 1;
  inputText: string;
  annotations: Annotation[];
  activeTool: Tool;
  color: string;
  textValue: string;
  visualizationMode: VisualizationMode;
  showConservationStrip: boolean;
  useCustomConservationColors: boolean;
  conservationColors: ConservationColorOverrides;
  espriptPreset: EspriptPreset;
  showLegend: boolean;
  boxStrokeWidth: number;
  printColumns: number;
  printSpacing: number;
  exportScale: number;
  pdfQuality: number;
  structureInput: string;
  bottomStructureInput: string;
};

export default function App() {
  const [inputText, setInputText] = useState(sampleAlignment);
  const [alignment, setAlignment] = useState<AlignmentData | null>(() => parseAlignment(sampleAlignment, "Sample kinase alignment"));
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("highlight");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragState, setDragState] = useState<DragSelection>({ active: false, selection: null });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [color, setColor] = useState("#f79009");
  const [textValue, setTextValue] = useState(starterText);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>("publication-classic");
  const [espriptPreset, setEspriptPreset] = useState<EspriptPreset>("classic");
  const [showConservationStrip, setShowConservationStrip] = useState(true);
  const [useCustomConservationColors, setUseCustomConservationColors] = useState(false);
  const [conservationColors, setConservationColors] = useState<ConservationColorOverrides>(defaultConservationColors);
  const [showLegend, setShowLegend] = useState(true);
  const [boxStrokeWidth, setBoxStrokeWidth] = useState(2.2);
  const [printColumns, setPrintColumns] = useState(60);
  const [printSpacing, setPrintSpacing] = useState(1);
  const [exportScale, setExportScale] = useState(2);
  const [pdfQuality, setPdfQuality] = useState(0.94);
  const [structureInput, setStructureInput] = useState("");
  const [secondaryStructureTrack, setSecondaryStructureTrack] = useState<SecondaryStructureTrack | null>(null);
  const [bottomStructureInput, setBottomStructureInput] = useState("");
  const [bottomStructureTrack, setBottomStructureTrack] = useState<SecondaryStructureTrack | null>(null);
  const [pendingBridgeAnchor, setPendingBridgeAnchor] = useState<CellAnchor | null>(null);
  const [previewExport, setPreviewExport] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showToolTray, setShowToolTray] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return defaultOpenSections;
    }
    try {
      const stored = window.localStorage.getItem("alignnotate-open-sections");
      return stored ? { ...defaultOpenSections, ...JSON.parse(stored) } : defaultOpenSections;
    } catch {
      return defaultOpenSections;
    }
  });
  const [status, setStatus] = useState("Load an alignment, drag over residues, and annotate directly on the figure.");
  const editorSvgRef = useRef<SVGSVGElement | null>(null);
  const exportSvgRef = useRef<SVGSVGElement | null>(null);
  const librarySectionRef = useRef<HTMLElement | null>(null);
  const annotationDragRef = useRef<AnnotationDrag | null>(null);
  const dragSelectionRef = useRef<Selection | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const editorMetrics = useMemo(() => (alignment ? createLayoutMetrics(alignment, "editor") : null), [alignment]);
  const exportMetrics = useMemo(() => {
    if (!alignment) {
      return null;
    }

    const base = createLayoutMetrics(alignment, "export");
    return {
      ...base,
      blockColumns: printColumns,
      blockGap: Math.max(18, Number((base.blockGap * printSpacing).toFixed(1))),
      rowGap: Number((base.rowGap * printSpacing).toFixed(1)),
      headerHeight: Number((base.headerHeight * printSpacing).toFixed(1)),
      cellHeight: Number((base.cellHeight * printSpacing).toFixed(1)),
    };
  }, [alignment, printColumns, printSpacing]);
  const selectedAnnotation = useMemo(
    () => annotations.find((item) => item.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId],
  );

  useEffect(() => {
    const handlePointerUp = () => {
      annotationDragRef.current = null;
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      const latestSelection = dragSelectionRef.current ?? dragState.selection;
      if (dragState.active && latestSelection) {
        commitSelection(latestSelection);
        setDragState({ active: false, selection: null });
        dragSelectionRef.current = null;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!annotationDragRef.current) {
        return;
      }

      const drag = annotationDragRef.current;
      const deltaX = event.clientX - drag.pointerStartX;
      const deltaY = event.clientY - drag.pointerStartY;
      setAnnotations((current) =>
        current.map((annotation) => {
          if (annotation.id !== drag.annotationId) {
            return annotation;
          }

          if (drag.mode === "text" && annotation.type === "text") {
            return {
              ...annotation,
              dx: drag.originalDx + deltaX,
              dy: drag.originalDy + deltaY,
            } satisfies TextAnnotation;
          }

          if (annotation.type === "arrow") {
            if (drag.mode === "arrow-tail") {
              return {
                ...annotation,
                tailDx: snapDragOffset(drag.originalDx + deltaX, 4),
                tailDy: snapDragOffset(drag.originalDy + deltaY, 2),
              };
            }

            if (drag.mode === "arrow-head") {
              return {
                ...annotation,
                headDx: snapDragOffset(drag.originalDx + deltaX, 4),
                headDy: snapDragOffset(drag.originalDy + deltaY, 2),
              };
            }
          }

          return annotation;
        }),
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId) {
        setAnnotations((current) => current.filter((annotation) => annotation.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setAnnotations((current) => current.slice(0, -1));
        setSelectedAnnotationId(null);
      }

      if (event.key === "Escape") {
        setPendingBridgeAnchor(null);
        setDragState({ active: false, selection: null });
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragState.active, dragState.selection, selectedAnnotationId]);

  useEffect(() => {
    if (!alignment) {
      setSecondaryStructureTrack(null);
      setBottomStructureTrack(null);
      return;
    }

    try {
      setSecondaryStructureTrack(parseSecondaryStructureTrack(structureInput, alignment));
    } catch {
      setSecondaryStructureTrack(null);
    }
    try {
      setBottomStructureTrack(parseSecondaryStructureTrack(bottomStructureInput, alignment));
    } catch {
      setBottomStructureTrack(null);
    }
  }, [alignment, structureInput, bottomStructureInput]);

  useEffect(() => {
    if (!selectedAnnotationId) {
      return;
    }

    const annotation = annotations.find((item) => item.id === selectedAnnotationId);
    if (!annotation) {
      return;
    }

    setColor(annotation.color);
    if (annotation.type === "text") {
      setTextValue(annotation.text);
    }
  }, [annotations, selectedAnnotationId]);

  useEffect(() => {
    if (activeTool !== "bridge" && pendingBridgeAnchor) {
      setPendingBridgeAnchor(null);
    }
  }, [activeTool, pendingBridgeAnchor]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("alignnotate-open-sections", JSON.stringify(openSections));
  }, [openSections]);

  function updateSelectedAnnotation(mutator: (annotation: Annotation) => Annotation): void {
    if (!selectedAnnotationId) {
      return;
    }

    setAnnotations((current) =>
      current.map((annotation) => (annotation.id === selectedAnnotationId ? mutator(annotation) : annotation)),
    );
  }

  function toggleSection(section: keyof typeof defaultOpenSections): void {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function openToolLibrary(): void {
    setOpenSections((current) => ({
      ...current,
      library: true,
    }));
    setShowToolTray((current) => !current);
    requestAnimationFrame(() => {
      librarySectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function loadAlignment() {
    try {
      const parsed = parseAlignment(inputText, "User alignment");
      setAlignment(parsed);
      setAnnotations([]);
      setSelection(null);
      setSelectedAnnotationId(null);
      setPendingBridgeAnchor(null);
      setError(null);
      try {
        setSecondaryStructureTrack(parseSecondaryStructureTrack(structureInput, parsed));
      } catch {
        setSecondaryStructureTrack(null);
      }
      try {
        setBottomStructureTrack(parseSecondaryStructureTrack(bottomStructureInput, parsed));
      } catch {
        setBottomStructureTrack(null);
      }
      setStatus(`Loaded ${parsed.sequences.length} sequences across ${parsed.alignmentLength} alignment columns.`);
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "Could not parse alignment.";
      setError(message);
      setStatus("Parsing failed. Check the input format and try again.");
    }
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file.text().then((text) => {
      setInputText(text);
      try {
        const parsed = parseAlignment(text, file.name);
        setAlignment(parsed);
        setAnnotations([]);
        setSelection(null);
        setSelectedAnnotationId(null);
        setPendingBridgeAnchor(null);
        setError(null);
        try {
          setSecondaryStructureTrack(parseSecondaryStructureTrack(structureInput, parsed));
        } catch {
          setSecondaryStructureTrack(null);
        }
        try {
          setBottomStructureTrack(parseSecondaryStructureTrack(bottomStructureInput, parsed));
        } catch {
          setBottomStructureTrack(null);
        }
        setStatus(`Loaded ${file.name} with ${parsed.sequences.length} sequences.`);
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : "Could not parse alignment.";
        setError(message);
      }
    });
  }

  function updateConservationColor(key: keyof ConservationColorOverrides, value: string) {
    setConservationColors((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveProject() {
    const payload: ProjectState = {
      version: 1,
      inputText,
      annotations,
      activeTool,
      color,
      textValue,
      visualizationMode,
      espriptPreset,
      showConservationStrip,
      useCustomConservationColors,
      conservationColors,
      showLegend,
      boxStrokeWidth,
      printColumns,
      printSpacing,
      exportScale,
      pdfQuality,
      structureInput,
      bottomStructureInput,
    };

    downloadBlob("alignment-project.json", "application/json;charset=utf-8", `${JSON.stringify(payload, null, 2)}\n`);
    setStatus("Saved project JSON.");
  }

  function handleProjectUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file.text().then((text) => {
      try {
        const project = JSON.parse(text) as Partial<ProjectState>;
        if (typeof project.inputText !== "string") {
          throw new Error("Project file is missing alignment text.");
        }

        const parsed = parseAlignment(project.inputText, file.name);
        setInputText(project.inputText);
        setAlignment(parsed);
        setAnnotations(Array.isArray(project.annotations) ? project.annotations : []);
        setActiveTool(project.activeTool ?? "highlight");
        setColor(project.color ?? "#f79009");
        setTextValue(project.textValue ?? starterText);
        setVisualizationMode(project.visualizationMode ?? "publication-classic");
        setEspriptPreset(project.espriptPreset ?? "classic");
        setShowConservationStrip(project.showConservationStrip ?? true);
        setUseCustomConservationColors(project.useCustomConservationColors ?? false);
        setConservationColors(project.conservationColors ?? defaultConservationColors);
        setShowLegend(project.showLegend ?? true);
        setBoxStrokeWidth(project.boxStrokeWidth ?? 2.2);
        setPrintColumns(project.printColumns ?? 60);
        setPrintSpacing(project.printSpacing ?? 1);
        setExportScale(project.exportScale ?? 2);
        setPdfQuality(project.pdfQuality ?? 0.94);
        setStructureInput(project.structureInput ?? "");
        setBottomStructureInput(project.bottomStructureInput ?? "");
        setSelection(null);
        setSelectedAnnotationId(null);
        setPendingBridgeAnchor(null);
        setError(null);
        setStatus(`Loaded project ${file.name}.`);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Could not load project.";
        setStatus(message);
      } finally {
        event.target.value = "";
      }
    });
  }

  function loadSampleStructureTrack() {
    if (!alignment) {
      return;
    }

    const residues = Array.from({ length: alignment.alignmentLength }, (_, index) => {
      if (index >= 6 && index <= 22) return "H";
      if (index >= 34 && index <= 41) return "E";
      if (index >= 52 && index <= 56) return "T";
      if (index >= 68 && index <= 82) return "H";
      if (index >= 96 && index <= 103) return "E";
      return "C";
    }).join("");

    setStructureInput(`Reference structure\n${residues}`);
  }

  function loadSampleBottomTrack() {
    if (!alignment) {
      return;
    }

    const residues = Array.from({ length: alignment.alignmentLength }, (_, index) => {
      if (index >= 10 && index <= 18) return "E";
      if (index >= 28 && index <= 36) return "H";
      if (index >= 58 && index <= 63) return "T";
      if (index >= 90 && index <= 98) return "E";
      return "C";
    }).join("");

    setBottomStructureInput(`Bottom lane\n${residues}`);
  }

  function handleCellPointerDown(sequenceIndex: number, column: number) {
    if (!alignment) {
      return;
    }

    const baseSelection = {
      startSequence: sequenceIndex,
      endSequence: sequenceIndex,
      startColumn: column,
      endColumn: column,
    };

    setSelectedAnnotationId(null);

    if (activeTool === "bridge") {
      if (!pendingBridgeAnchor) {
        setPendingBridgeAnchor({ sequenceIndex, column });
        setSelection(baseSelection);
        setStatus(`Bridge start set at ${alignment.sequences[sequenceIndex].id}:${column + 1}. Click the second residue.`);
        return;
      }

      if (!editorMetrics) {
        return;
      }

      if (Math.floor(pendingBridgeAnchor.column / editorMetrics.blockColumns) !== Math.floor(column / editorMetrics.blockColumns)) {
        setPendingBridgeAnchor({ sequenceIndex, column });
        setSelection(baseSelection);
        setStatus("Bridge anchors must be placed in the same visible block. Start point reset.");
        return;
      }

      const annotation: Annotation = {
        id: makeId("bridge"),
        type: "bridge",
        color,
        from: pendingBridgeAnchor,
        to: { sequenceIndex, column },
        style: "bracket",
        placement: "top",
        height: 1,
      };
      setAnnotations((current) => [...current, annotation]);
      setPendingBridgeAnchor(null);
      setSelection(baseSelection);
      setStatus("Added bridge connector.");
      return;
    }

    if (activeTool === "select") {
      setSelection(baseSelection);
      setStatus(`Selected ${alignment.sequences[sequenceIndex].id}, column ${column + 1}.`);
      return;
    }

    if (
      activeTool === "triangle-up" ||
      activeTool === "triangle-down" ||
      activeTool === "arrow-down" ||
      activeTool === "arrow" ||
      activeTool === "bracket" ||
      activeTool === "circle" ||
      activeTool === "open-circle" ||
      activeTool === "star"
    ) {
      commitSelection(baseSelection);
      return;
    }

    dragSelectionRef.current = baseSelection;
    setDragState({ active: true, selection: baseSelection });
  }

  function handleCellPointerEnter(sequenceIndex: number, column: number) {
    if (!dragState.active || !dragState.selection) {
      return;
    }
    const nextSelection = {
      ...dragState.selection,
      endSequence: sequenceIndex,
      endColumn: column,
    };
    dragSelectionRef.current = nextSelection;

    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      setDragState((current) =>
        current.selection
          ? {
              active: true,
              selection: dragSelectionRef.current ?? current.selection,
            }
          : current,
      );
    });
  }

  function commitSelection(rawSelection: Selection) {
    const normalized = normalizeSelection(rawSelection);
    setSelection(normalized);

    if (activeTool === "erase") {
      setAnnotations((current) =>
        current.filter((annotation) => {
          if (!("selection" in annotation)) {
            const bridgeMinColumn = Math.min(annotation.from.column, annotation.to.column);
            const bridgeMaxColumn = Math.max(annotation.from.column, annotation.to.column);
            const bridgeMinSequence = Math.min(annotation.from.sequenceIndex, annotation.to.sequenceIndex);
            const bridgeMaxSequence = Math.max(annotation.from.sequenceIndex, annotation.to.sequenceIndex);
            const overlaps =
              normalized.startColumn <= bridgeMaxColumn &&
              normalized.endColumn >= bridgeMinColumn &&
              normalized.startSequence <= bridgeMaxSequence &&
              normalized.endSequence >= bridgeMinSequence;
            return !overlaps;
          }
          const item = normalizeSelection(annotation.selection);
          const overlaps =
            normalized.startColumn <= item.endColumn &&
            normalized.endColumn >= item.startColumn &&
            normalized.startSequence <= item.endSequence &&
            normalized.endSequence >= item.startSequence;
          return !overlaps;
        }),
      );
      setStatus("Removed annotations overlapping the selected region.");
      return;
    }

    if (
      activeTool === "highlight" ||
      activeTool === "box" ||
      activeTool === "triangle-up" ||
      activeTool === "triangle-down" ||
      activeTool === "arrow-down" ||
      activeTool === "arrow" ||
      activeTool === "bracket" ||
      activeTool === "circle" ||
      activeTool === "open-circle" ||
      activeTool === "star"
    ) {
      const annotation: Annotation = {
        id: makeId(activeTool),
        type: activeTool,
        color,
        selection: normalized,
        ...(activeTool === "arrow" || activeTool === "bracket"
          ? { placement: "top" as const, size: 1, tailDx: 0, tailDy: 0, headDx: 0, headDy: 0 }
          : activeTool === "triangle-up" ||
              activeTool === "triangle-down" ||
              activeTool === "arrow-down" ||
              activeTool === "circle" ||
              activeTool === "open-circle" ||
              activeTool === "star"
            ? { size: 1, placement: "top" as const }
            : {}),
      };
      setAnnotations((current) => [...current, annotation]);
      setStatus(`Added ${activeTool.replace("-", " ")} annotation.`);
      return;
    }

    if (activeTool === "text") {
      const annotation: TextAnnotation = {
        id: makeId("text"),
        type: "text",
        selection: normalized,
        color,
        text: textValue.trim() || starterText,
        dx: 26,
        dy: -18,
      };
      setAnnotations((current) => [...current, annotation]);
      setSelectedAnnotationId(annotation.id);
      setStatus(`Added text label "${annotation.text}". Drag the label to reposition it.`);
    }
  }

  function handleAnnotationPointerDown(
    annotationId: string,
    clientX: number,
    clientY: number,
    handle: "body" | "arrow-tail" | "arrow-head" = "body",
  ) {
    const annotation = annotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return;
    }

    if (activeTool === "erase") {
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
      setSelectedAnnotationId(null);
      setStatus("Deleted annotation.");
      return;
    }

    setSelectedAnnotationId(annotationId);
    if ("selection" in annotation) {
      setSelection(normalizeSelection(annotation.selection));
    } else {
      setSelection(null);
    }

    if (annotation.type === "text") {
      annotationDragRef.current = {
        mode: "text",
        annotationId,
        pointerStartX: clientX,
        pointerStartY: clientY,
        originalDx: annotation.dx,
        originalDy: annotation.dy,
      };
      return;
    }

    if (annotation.type === "arrow" && (handle === "arrow-tail" || handle === "arrow-head")) {
      annotationDragRef.current = {
        mode: handle,
        annotationId,
        pointerStartX: clientX,
        pointerStartY: clientY,
        originalDx: handle === "arrow-tail" ? annotation.tailDx ?? 0 : annotation.headDx ?? 0,
        originalDy: handle === "arrow-tail" ? annotation.tailDy ?? 0 : annotation.headDy ?? 0,
      };
    }
  }

  async function handleExport(format: "svg" | "png" | "pdf") {
    if (!exportSvgRef.current) {
      return;
    }

    try {
      if (format === "svg") {
        await exportSvg(exportSvgRef.current, "alignment-figure.svg");
      } else if (format === "pdf") {
        await exportPdf(exportSvgRef.current, "alignment-figure.pdf", { scale: exportScale, quality: pdfQuality });
      } else {
        await exportPng(exportSvgRef.current, "alignment-figure.png", { scale: exportScale });
      }
      setStatus(`Exported ${format.toUpperCase()} figure.`);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : "Export failed.";
      setStatus(message);
    }
  }

  return (
    <div className={focusMode ? "page-shell page-shell--focus" : "page-shell"}>
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Interactive Alignment Annotation Tool</p>
          <h1>AlignNotate</h1>
        </div>
      </header>

      <div className="app-shell">
        <aside className="left-panel">
          <section ref={librarySectionRef} className="panel-card collapsible-card">
            <button className="collapse-header" type="button" onClick={() => toggleSection("alignment")}>
              <span className="collapse-title">
                <span className="collapse-icon" aria-hidden="true">{sectionIcons.alignment}</span>
                <span>Alignment</span>
              </span>
              <span className="collapse-side">
                <span className="collapse-meta">upload and parse</span>
                <span className={openSections.alignment ? "collapse-caret open" : "collapse-caret"} aria-hidden="true">⌄</span>
              </span>
            </button>
            {openSections.alignment ? <div className="collapse-body">
              <div className="section-heading">
                <h2>Input</h2>
                <label className="file-button">
                  Upload .aln / text
                  <input type="file" accept=".aln,.aln-clustal_num,.clustal,.txt,.fa,.fasta,.fas" onChange={handleFileUpload} />
                </label>
              </div>
              <textarea
                className="alignment-input"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                spellCheck={false}
              />
              <div className="inline-actions">
                <button className="primary-button" onClick={loadAlignment}>
                  Render alignment
                </button>
                <button className="secondary-button" onClick={() => setInputText(sampleAlignment)}>
                  Load sample
                </button>
              </div>
              {error ? <p className="error-text">{error}</p> : null}
            </div> : null}
          </section>

          <section className="panel-card collapsible-card">
            <button className="collapse-header" type="button" onClick={() => toggleSection("appearance")}>
              <span className="collapse-title">
                <span className="collapse-icon" aria-hidden="true">{sectionIcons.appearance}</span>
                <span>Appearance</span>
              </span>
              <span className="collapse-side">
                <span className="collapse-meta">view and conservation</span>
                <span className={openSections.appearance ? "collapse-caret open" : "collapse-caret"} aria-hidden="true">⌄</span>
              </span>
            </button>
            {openSections.appearance ? <div className="collapse-body">
              <label className="field-label">
                View mode
                <select className="text-field" value={visualizationMode} onChange={(event) => setVisualizationMode(event.target.value as VisualizationMode)}>
                  <option value="espript">ESPript</option>
                  <option value="publication-classic">Classic</option>
                  <option value="publication-flashy">Flashy</option>
                  <option value="publication-mono">Mono</option>
                  <option value="chemistry">Chemistry</option>
                  <option value="residue">Residue</option>
                </select>
              </label>
              {visualizationMode === "espript" ? (
                <label className="field-label">
                  ESPript preset
                  <select className="text-field" value={espriptPreset} onChange={(event) => setEspriptPreset(event.target.value as EspriptPreset)}>
                    <option value="classic">Classic</option>
                    <option value="flashy">Flashy</option>
                    <option value="identity">Identity</option>
                  </select>
                </label>
              ) : null}
              <label className="toggle-row">
                <span>Conservation strip</span>
                <input
                  type="checkbox"
                  checked={showConservationStrip}
                  onChange={(event) => setShowConservationStrip(event.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>Custom conservation colors</span>
                <input
                  type="checkbox"
                  checked={useCustomConservationColors}
                  onChange={(event) => setUseCustomConservationColors(event.target.checked)}
                />
              </label>
              {useCustomConservationColors ? (
                <div className="color-grid">
                  <label className="mini-color-field">
                    <span>Strict</span>
                    <input
                      type="color"
                      value={conservationColors.strict}
                      onChange={(event) => updateConservationColor("strict", event.target.value)}
                    />
                  </label>
                  <label className="mini-color-field">
                    <span>Similar</span>
                    <input
                      type="color"
                      value={conservationColors.similar}
                      onChange={(event) => updateConservationColor("similar", event.target.value)}
                    />
                  </label>
                  <label className="mini-color-field">
                    <span>Weak</span>
                    <input
                      type="color"
                      value={conservationColors.weak}
                      onChange={(event) => updateConservationColor("weak", event.target.value)}
                    />
                  </label>
                  <label className="mini-color-field">
                    <span>Neutral</span>
                    <input
                      type="color"
                      value={conservationColors.neutral}
                      onChange={(event) => updateConservationColor("neutral", event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary-button reset-button"
                    onClick={() => {
                      setConservationColors(defaultConservationColors);
                      setUseCustomConservationColors(false);
                    }}
                  >
                    Reset colors
                  </button>
                </div>
              ) : null}
              <label className="field-label">
                Box weight
                <input
                  type="range"
                  min="1.2"
                  max="3.6"
                  step="0.2"
                  value={boxStrokeWidth}
                  onChange={(event) => setBoxStrokeWidth(Number(event.target.value))}
                />
              </label>
            </div> : null}
          </section>

          <section className="panel-card collapsible-card">
            <button className="collapse-header" type="button" onClick={() => toggleSection("structure")}>
              <span className="collapse-title">
                <span className="collapse-icon" aria-hidden="true">{sectionIcons.structure}</span>
                <span>Structure</span>
              </span>
              <span className="collapse-side">
                <span className="collapse-meta">top and bottom tracks</span>
                <span className={openSections.structure ? "collapse-caret open" : "collapse-caret"} aria-hidden="true">⌄</span>
              </span>
            </button>
            {openSections.structure ? <div className="collapse-body">
              <div className="section-heading">
                <h2>Top lane</h2>
                <button className="secondary-button" onClick={loadSampleStructureTrack}>
                  Load sample
                </button>
              </div>
              <textarea
                className="alignment-input structure-input"
                value={structureInput}
                onChange={(event) => setStructureInput(event.target.value)}
                placeholder={"Optional aligned track\nUse H for helix, E for strand, T for turn, C/. for coil"}
                spellCheck={false}
              />
              <div className="section-heading structure-subhead">
                <h2>Bottom lane</h2>
                <button className="secondary-button" onClick={loadSampleBottomTrack}>
                  Load sample
                </button>
              </div>
              <textarea
                className="alignment-input structure-input"
                value={bottomStructureInput}
                onChange={(event) => setBottomStructureInput(event.target.value)}
                placeholder={"Optional bottom track\nAccessibility / second structure lane"}
                spellCheck={false}
              />
            </div> : null}
          </section>

          <section className="panel-card collapsible-card">
            <button className="collapse-header" type="button" onClick={() => toggleSection("library")}>
              <span className="collapse-title">
                <span className="collapse-icon" aria-hidden="true">{sectionIcons.library}</span>
                <span>Library</span>
              </span>
              <span className="collapse-side">
                <span className="collapse-meta">all tools and layers</span>
                <span className={openSections.library ? "collapse-caret open" : "collapse-caret"} aria-hidden="true">⌄</span>
              </span>
            </button>
            {openSections.library ? <div className="collapse-body">
              <div className="tool-grid">
                {toolOptions.map((tool) => (
                  <button
                    key={tool.id}
                    className={tool.id === activeTool ? "tool-button active" : "tool-button"}
                    onClick={() => setActiveTool(tool.id)}
                  >
                    <span className="tool-icon" aria-hidden="true">
                      {toolIcons[tool.id]}
                    </span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
              <p className="helper-text">
                Drag across cells to apply region tools. Triangle tools place markers above the clicked residue. Bridge draws an overhead connector between two clicked residues in one block.
              </p>
              <div className="layer-list">
                {annotations.length === 0 ? (
                  <p className="helper-text">No annotations yet.</p>
                ) : (
                  [...annotations].reverse().map((annotation) => {
                    const index = annotations.findIndex((item) => item.id === annotation.id);
                    const isSelected = selectedAnnotationId === annotation.id;
                    return (
                      <div key={annotation.id} className={isSelected ? "layer-row active" : "layer-row"}>
                        <button
                          className="layer-swatch"
                          style={{ background: annotation.color }}
                          onClick={() => setSelectedAnnotationId(annotation.id)}
                          aria-label={`Select ${annotation.type}`}
                        />
                        <button className="layer-label" onClick={() => setSelectedAnnotationId(annotation.id)}>
                          {annotation.type.replace("-", " ")}
                        </button>
                        <button
                          className="layer-action"
                          onClick={() =>
                            setAnnotations((current) =>
                              current.map((item) =>
                                item.id === annotation.id ? { ...item, visible: item.visible === false ? true : false } : item,
                              ),
                            )
                          }
                        >
                          {annotation.visible === false ? "Show" : "Hide"}
                        </button>
                        <button
                          className="layer-action"
                          disabled={index === annotations.length - 1}
                          onClick={() =>
                            setAnnotations((current) => {
                              const next = [...current];
                              const from = next.findIndex((item) => item.id === annotation.id);
                              if (from < 0 || from === next.length - 1) {
                                return current;
                              }
                              const [item] = next.splice(from, 1);
                              next.splice(from + 1, 0, item);
                              return next;
                            })
                          }
                        >
                          Down
                        </button>
                        <button
                          className="layer-action"
                          disabled={index === 0}
                          onClick={() =>
                            setAnnotations((current) => {
                              const next = [...current];
                              const from = next.findIndex((item) => item.id === annotation.id);
                              if (from <= 0) {
                                return current;
                              }
                              const [item] = next.splice(from, 1);
                              next.splice(from - 1, 0, item);
                              return next;
                            })
                          }
                        >
                          Up
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div> : null}
          </section>

          <section className="panel-card collapsible-card">
            <button className="collapse-header" type="button" onClick={() => toggleSection("project")}>
              <span className="collapse-title">
                <span className="collapse-icon" aria-hidden="true">{sectionIcons.project}</span>
                <span>Project</span>
              </span>
              <span className="collapse-side">
                <span className="collapse-meta">export and save</span>
                <span className={openSections.project ? "collapse-caret open" : "collapse-caret"} aria-hidden="true">⌄</span>
              </span>
            </button>
            {openSections.project ? <div className="collapse-body">
              <label className="toggle-row">
                <span>Show legend</span>
                <input type="checkbox" checked={showLegend} onChange={(event) => setShowLegend(event.target.checked)} />
              </label>
              <label className="field-label">
                Print columns
                <input
                  type="range"
                  min="40"
                  max="80"
                  step="5"
                  value={printColumns}
                  onChange={(event) => setPrintColumns(Number(event.target.value))}
                />
                <span className="helper-text">{printColumns} residues per row</span>
              </label>
              <label className="field-label">
                Print spacing
                <input
                  type="range"
                  min="0.85"
                  max="1.2"
                  step="0.05"
                  value={printSpacing}
                  onChange={(event) => setPrintSpacing(Number(event.target.value))}
                />
                <span className="helper-text">{printSpacing.toFixed(2)}x spacing</span>
              </label>
              <label className="field-label">
                Raster scale
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={exportScale}
                  onChange={(event) => setExportScale(Number(event.target.value))}
                />
                <span className="helper-text">{exportScale}x PNG/PDF resolution</span>
              </label>
              <label className="field-label">
                PDF quality
                <input
                  type="range"
                  min="0.75"
                  max="1"
                  step="0.05"
                  value={pdfQuality}
                  onChange={(event) => setPdfQuality(Number(event.target.value))}
                />
                <span className="helper-text">{Math.round(pdfQuality * 100)}% JPEG quality in PDF</span>
              </label>
              <div className="inline-actions export-actions">
                <button className="secondary-button" onClick={saveProject}>
                  Save project JSON
                </button>
                <label className="file-button">
                  Load project JSON
                  <input type="file" accept=".json,application/json" onChange={handleProjectUpload} />
                </label>
              </div>
            </div> : null}
          </section>
        </aside>

        <main className="canvas-panel">
          <div className="workspace-toolbar">
            <div className="toolbar-group toolbar-group--grow">
              <span className="toolbar-label">Tools</span>
              <div className="toolbar-tools">
                {quickToolOptions.map((tool) => (
                  <button
                    key={tool.id}
                    className={tool.id === activeTool ? "toolbar-chip active" : "toolbar-chip"}
                    onClick={() => setActiveTool(tool.id)}
                  >
                    <span className="toolbar-chip-icon" aria-hidden="true">
                      {toolIcons[tool.id]}
                    </span>
                    <span>{tool.label}</span>
                  </button>
                ))}
                <button className={showToolTray ? "toolbar-chip active" : "toolbar-chip"} onClick={openToolLibrary}>
                  <span className="toolbar-chip-icon" aria-hidden="true">‹</span>
                  <span>More tools</span>
                </button>
              </div>
            </div>
            <div className="toolbar-group">
              <span className="toolbar-label">Color</span>
              <input
                className="toolbar-color"
                type="color"
                value={color}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setColor(nextColor);
                  updateSelectedAnnotation((annotation) => ({ ...annotation, color: nextColor }));
                }}
              />
            </div>
            <label className="toolbar-toggle">
              <span>Print preview</span>
              <input type="checkbox" checked={previewExport} onChange={(event) => setPreviewExport(event.target.checked)} />
            </label>
            <div className="toolbar-actions">
              <button className={focusMode ? "secondary-button active-toggle" : "secondary-button"} onClick={() => setFocusMode((current) => !current)}>
                <span className="toolbar-chip-icon" aria-hidden="true">{focusMode ? "⤢" : "⛶"}</span>
                {focusMode ? "Exit focus" : "Focus"}
              </button>
              <button className="primary-button" onClick={() => handleExport("svg")}>
                <span className="toolbar-chip-icon" aria-hidden="true">⌘</span>
                SVG
              </button>
              <button className="secondary-button" onClick={() => handleExport("png")}>
                <span className="toolbar-chip-icon" aria-hidden="true">▣</span>
                PNG
              </button>
              <button className="secondary-button" onClick={() => handleExport("pdf")}>
                <span className="toolbar-chip-icon" aria-hidden="true">▤</span>
                PDF
              </button>
            </div>
          </div>

          {showToolTray ? (
            <div className="panel-card tool-tray-card">
              <div className="section-heading">
                <h2>Tool library</h2>
                <button className="secondary-button" onClick={() => setShowToolTray(false)}>
                  Close
                </button>
              </div>
              <div className="tool-grid tool-grid--tray">
                {toolOptions.map((tool) => (
                  <button
                    key={`tray-${tool.id}`}
                    className={tool.id === activeTool ? "tool-button active" : "tool-button"}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setShowToolTray(false);
                    }}
                  >
                    <span className="tool-icon" aria-hidden="true">
                      {toolIcons[tool.id]}
                    </span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

        <div className="status-bar">
          <span>{status}</span>
          {alignment ? (
            <span>
              {alignment.name} · {alignment.sequences.length} sequences · {alignment.alignmentLength} columns
            </span>
          ) : null}
        </div>

        {selectedAnnotation ? (
          <div className="panel-card inspector-card">
            <div className="section-heading">
              <h2>Selection</h2>
              <span className="inspector-tag">{selectedAnnotation.type.replace("-", " ")}</span>
            </div>
            <div className="inspector-grid">
              <label className="field-label">
                Color
                <input
                  className="toolbar-color"
                  type="color"
                  value={selectedAnnotation.color}
                  onChange={(event) => {
                    const nextColor = event.target.value;
                    setColor(nextColor);
                    updateSelectedAnnotation((annotation) => ({ ...annotation, color: nextColor }));
                  }}
                />
              </label>
              {selectedAnnotation.type === "text" ? (
                <label className="field-label">
                  Label
                  <input
                    className="text-field"
                    value={selectedAnnotation.text}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTextValue(nextValue);
                      updateSelectedAnnotation((annotation) =>
                        annotation.type === "text" ? { ...annotation, text: nextValue || starterText } : annotation,
                      );
                    }}
                  />
                </label>
              ) : null}
              {"selection" in selectedAnnotation &&
              (selectedAnnotation.type === "triangle-up" ||
                selectedAnnotation.type === "triangle-down" ||
                selectedAnnotation.type === "arrow-down" ||
                selectedAnnotation.type === "circle" ||
                selectedAnnotation.type === "open-circle" ||
                selectedAnnotation.type === "star" ||
                selectedAnnotation.type === "arrow" ||
                selectedAnnotation.type === "bracket") ? (
                <label className="field-label">
                  Marker size
                  <input
                    type="range"
                    min="0.7"
                    max="1.8"
                    step="0.1"
                    value={selectedAnnotation.size ?? 1}
                    onChange={(event) => {
                      const nextSize = Number(event.target.value);
                      updateSelectedAnnotation((annotation) =>
                        "selection" in annotation &&
                        (annotation.type === "triangle-up" ||
                          annotation.type === "triangle-down" ||
                          annotation.type === "arrow-down" ||
                          annotation.type === "circle" ||
                          annotation.type === "open-circle" ||
                          annotation.type === "star" ||
                          annotation.type === "arrow" ||
                          annotation.type === "bracket")
                          ? { ...annotation, size: nextSize }
                          : annotation,
                      );
                    }}
                  />
                </label>
              ) : null}
              {"selection" in selectedAnnotation &&
              (selectedAnnotation.type === "arrow" ||
                selectedAnnotation.type === "bracket" ||
                selectedAnnotation.type === "arrow-down") ? (
                <label className="field-label">
                  Placement
                  <select
                    className="text-field"
                    value={selectedAnnotation.placement ?? "top"}
                    onChange={(event) => {
                      const placement = event.target.value as "top" | "bottom";
                      updateSelectedAnnotation((annotation) =>
                        "selection" in annotation &&
                        (annotation.type === "arrow" || annotation.type === "bracket" || annotation.type === "arrow-down")
                          ? { ...annotation, placement }
                          : annotation,
                      );
                    }}
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
              ) : null}
              {selectedAnnotation.type === "bridge" ? (
                <label className="field-label">
                  Bridge style
                  <select
                    className="text-field"
                    value={selectedAnnotation.style ?? "bracket"}
                    onChange={(event) => {
                      const style = event.target.value as "bracket" | "arch";
                      updateSelectedAnnotation((annotation) =>
                        annotation.type === "bridge" ? { ...annotation, style } : annotation,
                      );
                    }}
                  >
                    <option value="bracket">Bracket</option>
                    <option value="arch">Arch</option>
                  </select>
                </label>
              ) : null}
              {selectedAnnotation.type === "bridge" ? (
                <label className="field-label">
                  Placement
                  <select
                    className="text-field"
                    value={selectedAnnotation.placement ?? "top"}
                    onChange={(event) => {
                      const placement = event.target.value as "top" | "bottom";
                      updateSelectedAnnotation((annotation) =>
                        annotation.type === "bridge" ? { ...annotation, placement } : annotation,
                      );
                    }}
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
              ) : null}
              {selectedAnnotation.type === "bridge" ? (
                <label className="field-label">
                  Bridge height
                  <input
                    type="range"
                    min="0.8"
                    max="2.2"
                    step="0.1"
                    value={selectedAnnotation.height ?? 1}
                    onChange={(event) => {
                      const height = Number(event.target.value);
                      updateSelectedAnnotation((annotation) =>
                        annotation.type === "bridge" ? { ...annotation, height } : annotation,
                      );
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="canvas-card">
          {alignment ? (
            <AlignmentCanvas
              ref={editorSvgRef}
              alignment={alignment}
              annotations={annotations}
              metrics={previewExport ? exportMetrics ?? createLayoutMetrics(alignment, "export") : editorMetrics ?? createLayoutMetrics(alignment, "editor")}
              renderMode={previewExport ? "export" : "editor"}
              visualizationMode={visualizationMode}
              espriptPreset={espriptPreset}
              conservationColors={useCustomConservationColors ? conservationColors : null}
              showConservationStrip={showConservationStrip}
              showLegend={showLegend}
              secondaryStructureTrack={secondaryStructureTrack}
              bottomStructureTrack={bottomStructureTrack}
              boxStrokeWidth={boxStrokeWidth}
              pendingBridgeAnchor={pendingBridgeAnchor}
              interactive
              selection={selection}
              activeTool={activeTool}
              dragState={dragState}
              onCellPointerDown={handleCellPointerDown}
              onCellPointerEnter={handleCellPointerEnter}
              onAnnotationPointerDown={handleAnnotationPointerDown}
              selectedAnnotationId={selectedAnnotationId}
            />
          ) : (
            <div className="empty-state">Load an alignment to begin.</div>
          )}
        </div>

        {!focusMode ? (
        <article className="note-card compact-note">
          <p>
            Annotations are stored in alignment coordinates, so they stay attached on redraw and export. Delete removes the selected annotation, Cmd/Ctrl+Z removes the last one, and project JSON lets you reopen a figure later.
          </p>
        </article>
        ) : null}
        </main>
      </div>

      {alignment ? (
        <div className="export-stage" aria-hidden="true">
          <AlignmentCanvas
            ref={exportSvgRef}
            alignment={alignment}
            annotations={annotations}
            metrics={exportMetrics ?? createLayoutMetrics(alignment, "export")}
            renderMode="export"
            visualizationMode={visualizationMode}
            espriptPreset={espriptPreset}
            conservationColors={useCustomConservationColors ? conservationColors : null}
            showConservationStrip={showConservationStrip}
            showLegend={showLegend}
            secondaryStructureTrack={secondaryStructureTrack}
            bottomStructureTrack={bottomStructureTrack}
            boxStrokeWidth={boxStrokeWidth}
            pendingBridgeAnchor={null}
            interactive={false}
            selection={null}
            activeTool={activeTool}
            dragState={{ active: false, selection: null }}
            onCellPointerDown={() => undefined}
            onCellPointerEnter={() => undefined}
            onAnnotationPointerDown={() => undefined}
            selectedAnnotationId={null}
          />
        </div>
      ) : null}
    </div>
  );
}

function snapDragOffset(value: number, step: number): number {
  return Math.round(value / step) * step;
}
