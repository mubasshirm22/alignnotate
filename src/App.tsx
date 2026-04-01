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
  CustomLegendItem,
  EspriptPreset,
  SecondaryStructureTrack,
  Selection,
  StructureRenderStyle,
  TextAnnotation,
  Tool,
  VisualizationMode,
} from "./types";

type AppPage = "app" | "examples" | "quickstart" | "contact";
type ExportPreset = "paper" | "slide" | "poster" | "custom";
type WorkspaceStep = "setup" | "workspace" | "export";

const toolOptions: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "highlight", label: "Highlight" },
  { id: "box", label: "Box" },
  { id: "triangle-up", label: "Triangle Up" },
  { id: "triangle-down", label: "Triangle Down" },
  { id: "arrow-down", label: "Arrow Down" },
  { id: "span-arrow", label: "Span Arrow" },
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
  { id: "span-arrow", label: "Span Arrow" },
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
  "span-arrow": "↦",
  arrow: "→",
  bracket: "⟦",
  circle: "●",
  "open-circle": "○",
  star: "✦",
  bridge: "⊓",
  text: "T",
  erase: "⌫",
};

const toolMeta: Record<Tool, { tone: "region" | "marker" | "connector" | "label" | "utility"; hint: string }> = {
  select: { tone: "utility", hint: "Inspect" },
  highlight: { tone: "region", hint: "Fill" },
  box: { tone: "region", hint: "Outline" },
  "triangle-up": { tone: "marker", hint: "Marker" },
  "triangle-down": { tone: "marker", hint: "Marker" },
  "arrow-down": { tone: "marker", hint: "Pointer" },
  "span-arrow": { tone: "connector", hint: "Region" },
  arrow: { tone: "connector", hint: "Callout" },
  bracket: { tone: "connector", hint: "Span" },
  circle: { tone: "marker", hint: "Marker" },
  "open-circle": { tone: "marker", hint: "Marker" },
  star: { tone: "marker", hint: "Marker" },
  bridge: { tone: "connector", hint: "Link" },
  text: { tone: "label", hint: "Label" },
  erase: { tone: "utility", hint: "Remove" },
};

const sectionHelp = {
  alignment: "Load a Clustal or aligned FASTA file, paste alignment text, then render the figure.",
  appearance: "Choose the publication style, conservation display, and export-facing color behavior.",
  structure: "Paste aligned top and bottom structure tracks using H, E, T, C or DSSP-like symbols.",
  library: "Pick annotation tools, then manage layer order, locking, visibility, and duplication.",
  project: "Adjust export presets, legend behavior, raster quality, and save or reopen project JSON.",
};

const workflowSteps: { id: WorkspaceStep; label: string; description: string }[] = [
  { id: "setup", label: "1. Start", description: "Upload an alignment or open an example" },
  { id: "workspace", label: "2. Workspace", description: "Style the figure and annotate directly" },
  { id: "export", label: "3. Export", description: "Preview, save, and reopen figures" },
];

const starterText = "Active-site loop";
const defaultConservationColors: ConservationColorOverrides = {
  strict: "#d92d20",
  similar: "#f79009",
  weak: "#fdb022",
  neutral: "#d0d5dd",
};

const exportPresetDefaults: Record<Exclude<ExportPreset, "custom">, { printColumns: number; printSpacing: number; exportScale: number; pdfQuality: number; showLegend: boolean; boxStrokeWidth: number }> = {
  paper: {
    printColumns: 60,
    printSpacing: 1,
    exportScale: 3,
    pdfQuality: 0.96,
    showLegend: true,
    boxStrokeWidth: 2.2,
  },
  slide: {
    printColumns: 50,
    printSpacing: 1.08,
    exportScale: 4,
    pdfQuality: 0.98,
    showLegend: false,
    boxStrokeWidth: 2.6,
  },
  poster: {
    printColumns: 70,
    printSpacing: 1.12,
    exportScale: 4,
    pdfQuality: 0.98,
    showLegend: true,
    boxStrokeWidth: 2.8,
  },
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
  includeAutoLegend: boolean;
  customLegendItems: CustomLegendItem[];
  boxStrokeWidth: number;
  exportPreset: ExportPreset;
  printColumns: number;
  printSpacing: number;
  exportScale: number;
  pdfQuality: number;
  structureRenderStyle: StructureRenderStyle;
  structureInput: string;
  bottomStructureInput: string;
};

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("app");
  const [workspaceStep, setWorkspaceStep] = useState<WorkspaceStep>("setup");
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
  const [includeAutoLegend, setIncludeAutoLegend] = useState(true);
  const [customLegendItems, setCustomLegendItems] = useState<CustomLegendItem[]>([]);
  const [boxStrokeWidth, setBoxStrokeWidth] = useState(2.2);
  const [exportPreset, setExportPreset] = useState<ExportPreset>("paper");
  const [printColumns, setPrintColumns] = useState(60);
  const [printSpacing, setPrintSpacing] = useState(1);
  const [exportScale, setExportScale] = useState(2);
  const [pdfQuality, setPdfQuality] = useState(0.94);
  const [structureRenderStyle, setStructureRenderStyle] = useState<StructureRenderStyle>("classic");
  const [structureInput, setStructureInput] = useState("");
  const [secondaryStructureTrack, setSecondaryStructureTrack] = useState<SecondaryStructureTrack | null>(null);
  const [bottomStructureInput, setBottomStructureInput] = useState("");
  const [bottomStructureTrack, setBottomStructureTrack] = useState<SecondaryStructureTrack | null>(null);
  const [pendingBridgeAnchor, setPendingBridgeAnchor] = useState<CellAnchor | null>(null);
  const [previewExport, setPreviewExport] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showToolTray, setShowToolTray] = useState(false);
  const [showPasteComposer, setShowPasteComposer] = useState(false);
  const [status, setStatus] = useState("Upload an alignment or open an example, then annotate directly on the figure.");
  const editorSvgRef = useRef<SVGSVGElement | null>(null);
  const exportSvgRef = useRef<SVGSVGElement | null>(null);
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
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId) {
        const selected = annotations.find((annotation) => annotation.id === selectedAnnotationId);
        if (selected?.locked) {
          setStatus("Unlock the annotation before deleting it.");
          return;
        }
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
  }, [annotations, dragState.active, dragState.selection, selectedAnnotationId]);

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

  function updateSelectedAnnotation(mutator: (annotation: Annotation) => Annotation): void {
    if (!selectedAnnotationId) {
      return;
    }

    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === selectedAnnotationId ? (annotation.locked ? annotation : mutator(annotation)) : annotation,
      ),
    );
  }

  function markExportPresetCustom(): void {
    setExportPreset("custom");
  }

  function applyExportPreset(preset: Exclude<ExportPreset, "custom">): void {
    const next = exportPresetDefaults[preset];
    setExportPreset(preset);
    setPrintColumns(next.printColumns);
    setPrintSpacing(next.printSpacing);
    setExportScale(next.exportScale);
    setPdfQuality(next.pdfQuality);
    setShowLegend(next.showLegend);
    setBoxStrokeWidth(next.boxStrokeWidth);
    setStatus(`Applied ${preset} export preset.`);
  }

  function annotationDisplayName(annotation: Annotation): string {
    return annotation.label?.trim() || annotation.type.replace("-", " ");
  }

  function addLegendItem(): void {
    setCustomLegendItems((current) => [
      ...current,
      { id: makeId("legend"), label: "Custom item", color: "#7c3aed", style: "fill" },
    ]);
  }

  function duplicateAnnotation(annotationId: string): void {
    const source = annotations.find((item) => item.id === annotationId);
    if (!source) {
      return;
    }
    if (source.locked) {
      setStatus("Unlock the annotation before duplicating it.");
      return;
    }

    const duplicate: Annotation =
      source.type === "text"
        ? { ...source, id: makeId(source.type), dx: source.dx + 18, dy: source.dy - 10, label: `${annotationDisplayName(source)} copy` }
        : source.type === "bridge"
          ? { ...source, id: makeId(source.type), label: `${annotationDisplayName(source)} copy` }
          : { ...source, id: makeId(source.type), label: `${annotationDisplayName(source)} copy` };

    setAnnotations((current) => [...current, duplicate]);
    setSelectedAnnotationId(duplicate.id);
    setStatus(`Duplicated ${annotationDisplayName(source)}.`);
  }

  function loadExampleWorkspace(example: "espript" | "story" | "mono"): void {
    const parsed = parseAlignment(sampleAlignment, "Sample kinase alignment");
    const topTrack = buildSampleTrack(parsed.alignmentLength, "top");
    const bottomTrack = buildSampleTrack(parsed.alignmentLength, "bottom");
    setInputText(sampleAlignment);
    setAlignment(parsed);
    setSecondaryStructureTrack(parseSecondaryStructureTrack(`Reference structure\n${topTrack}`, parsed));
    setBottomStructureTrack(parseSecondaryStructureTrack(`Bottom lane\n${bottomTrack}`, parsed));
    setStructureInput(`Reference structure\n${topTrack}`);
    setBottomStructureInput(`Bottom lane\n${bottomTrack}`);
    setSelection(null);
    setSelectedAnnotationId(null);
    setPendingBridgeAnchor(null);
    setError(null);

    if (example === "espript") {
      setVisualizationMode("espript");
      setEspriptPreset("classic");
      applyExportPreset("paper");
      setAnnotations(buildDemoAnnotations("espript"));
      setShowConservationStrip(true);
    } else if (example === "story") {
      setVisualizationMode("publication-flashy");
      applyExportPreset("slide");
      setAnnotations(buildDemoAnnotations("story"));
      setShowConservationStrip(true);
    } else {
      setVisualizationMode("publication-mono");
      applyExportPreset("poster");
      setAnnotations(buildDemoAnnotations("mono"));
      setShowConservationStrip(false);
    }

    setActivePage("app");
    setWorkspaceStep("workspace");
    setShowPasteComposer(true);
    setStatus(`Loaded ${example} example workspace.`);
  }

  function openToolLibrary(): void {
    setWorkspaceStep("workspace");
    setShowToolTray((current) => !current);
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
    setWorkspaceStep("workspace");
    setShowPasteComposer(true);
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
        setWorkspaceStep("workspace");
        setShowPasteComposer(true);
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
      includeAutoLegend,
      customLegendItems,
      boxStrokeWidth,
      exportPreset,
      printColumns,
      printSpacing,
      exportScale,
      pdfQuality,
      structureRenderStyle,
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
        setIncludeAutoLegend(project.includeAutoLegend ?? true);
        setCustomLegendItems(Array.isArray(project.customLegendItems) ? project.customLegendItems : []);
        setBoxStrokeWidth(project.boxStrokeWidth ?? 2.2);
        setExportPreset(project.exportPreset ?? "paper");
        setPrintColumns(project.printColumns ?? 60);
        setPrintSpacing(project.printSpacing ?? 1);
        setExportScale(project.exportScale ?? 2);
        setPdfQuality(project.pdfQuality ?? 0.94);
        setStructureRenderStyle(project.structureRenderStyle ?? "classic");
        setStructureInput(project.structureInput ?? "");
        setBottomStructureInput(project.bottomStructureInput ?? "");
        setSelection(null);
        setSelectedAnnotationId(null);
        setPendingBridgeAnchor(null);
        setError(null);
        setWorkspaceStep("workspace");
        setShowPasteComposer(true);
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
        label: "Bridge",
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
          if (annotation.locked) {
            return true;
          }
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
      activeTool === "span-arrow" ||
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
        label: toolOptions.find((tool) => tool.id === activeTool)?.label,
        selection: normalized,
        ...(activeTool === "arrow" || activeTool === "bracket" || activeTool === "span-arrow"
          ? { placement: activeTool === "span-arrow" ? ("bottom" as const) : ("top" as const), size: 1, tailDx: 0, tailDy: 0, headDx: 0, headDy: 0 }
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
        label: "Text label",
        text: textValue.trim() || starterText,
        dx: 26,
        dy: -18,
        boxed: true,
        connector: true,
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
      if (annotation.locked) {
        setStatus("Unlock the annotation before deleting it.");
        return;
      }
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
      if (annotation.locked) {
        return;
      }
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
      if (annotation.locked) {
        return;
      }
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
          <p className="eyebrow">Singh Lab sequence figure tool</p>
          <h1>AlignNotate</h1>
          <p className="lede">Interactive multiple-sequence-alignment annotation for clean, publication-ready figures.</p>
        </div>
        <nav className="top-nav" aria-label="Primary">
          {([
            ["app", "App"],
            ["examples", "Examples"],
            ["quickstart", "Quickstart"],
            ["contact", "Contact"],
          ] as const).map(([page, label]) => (
            <button
              key={page}
              className={activePage === page ? "top-nav-link active" : "top-nav-link"}
              onClick={() => setActivePage(page)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {activePage === "app" ? (
      <div className="app-shell app-shell--workflow">
        <aside className="left-panel workflow-sidebar">
          <section className="panel-card workflow-nav-card">
            <div className="workflow-nav-head">
              <div>
                <p className="eyebrow workflow-eyebrow">Workspace flow</p>
                <h2>Build figure</h2>
              </div>
              <span className="workflow-summary-tag">{workflowSteps.find((step) => step.id === workspaceStep)?.label}</span>
            </div>
            <div className="workflow-step-list">
              {workflowSteps.map((step) => (
                <button
                  key={step.id}
                  className={workspaceStep === step.id ? "workflow-step active" : "workflow-step"}
                  onClick={() => setWorkspaceStep(step.id)}
                >
                  <span className="workflow-step-label">{step.label}</span>
                  <span className="workflow-step-copy">{step.description}</span>
                </button>
              ))}
            </div>
          </section>

          {workspaceStep === "setup" ? (
            <>
              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Start a figure</h2>
                    <p className="helper-text">Choose one path to begin. The sample alignment stays visible on the canvas so you can immediately see how the editor works.</p>
                  </div>
                  <span className="help-dot" aria-label={sectionHelp.alignment} data-tip={sectionHelp.alignment} tabIndex={0}>?</span>
                </div>
                <div className="start-grid">
                  <label className="file-button">
                    Upload `.aln` / FASTA
                    <input type="file" accept=".aln,.aln-clustal_num,.clustal,.txt,.fa,.fasta,.fas" onChange={handleFileUpload} />
                  </label>
                  <button className="secondary-button" onClick={() => loadExampleWorkspace("espript")}>
                    Open sample workspace
                  </button>
                  <button className="secondary-button" onClick={() => setShowPasteComposer((current) => !current)}>
                    {showPasteComposer ? "Hide pasted text" : "Paste alignment text"}
                  </button>
                </div>
                {showPasteComposer ? (
                  <>
                    <textarea
                      className="alignment-input"
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      spellCheck={false}
                    />
                    <div className="inline-actions">
                      <button className="primary-button" onClick={loadAlignment}>
                        Render pasted alignment
                      </button>
                      <button className="secondary-button" onClick={() => setInputText(sampleAlignment)}>
                        Use sample text
                      </button>
                    </div>
                  </>
                ) : null}
                {error ? <p className="error-text">{error}</p> : null}
              </section>

              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Resume or start from an example</h2>
                    <p className="helper-text">Reopen a project JSON or jump into a prepared demo workspace.</p>
                  </div>
                </div>
                <div className="inline-actions">
                  <label className="file-button">
                    Load project JSON
                    <input type="file" accept=".json,application/json" onChange={handleProjectUpload} />
                  </label>
                  <button className="secondary-button" onClick={() => loadExampleWorkspace("espript")}>
                    ESPript example
                  </button>
                  <button className="secondary-button" onClick={() => loadExampleWorkspace("story")}>
                    Talk example
                  </button>
                  <button className="secondary-button" onClick={() => loadExampleWorkspace("mono")}>
                    Mono example
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {workspaceStep === "workspace" ? (
            <>
              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Appearance</h2>
                    <p className="helper-text">Choose the alignment style and conservation behavior you want to publish.</p>
                  </div>
                  <span className="help-dot" aria-label={sectionHelp.appearance} data-tip={sectionHelp.appearance} tabIndex={0}>?</span>
                </div>
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
                    onChange={(event) => {
                      markExportPresetCustom();
                      setBoxStrokeWidth(Number(event.target.value));
                    }}
                  />
                </label>
              </section>

              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Structure tracks</h2>
                    <p className="helper-text">Add top and bottom lanes and choose how helices, strands, and linkers are drawn.</p>
                  </div>
                  <span className="help-dot" aria-label={sectionHelp.structure} data-tip={sectionHelp.structure} tabIndex={0}>?</span>
                </div>
                <label className="field-label">
                  Track style
                  <select
                    className="text-field"
                    value={structureRenderStyle}
                    onChange={(event) => setStructureRenderStyle(event.target.value as StructureRenderStyle)}
                  >
                    <option value="classic">Classic</option>
                    <option value="ssdraw">SSDraw</option>
                    <option value="protopo">ProTopo</option>
                  </select>
                  <span className="helper-text">
                    `Classic` uses a wave-and-arrow alignment track, `SSDraw` follows the stacked ribbon style, and `ProTopo` uses topology-style helix blocks, arrows, and linkers.
                  </span>
                </label>
                <div className="section-heading">
                  <h3>Top lane</h3>
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
                  <h3>Bottom lane</h3>
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
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => setStatus("Structure tracks updated for the current workspace.")}>
                    Keep these tracks
                  </button>
                </div>
              </section>

              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Annotation palette</h2>
                    <p className="helper-text">Pick a tool, set its color, then annotate directly on the alignment.</p>
                  </div>
                  <span className="help-dot" aria-label={sectionHelp.library} data-tip={sectionHelp.library} tabIndex={0}>?</span>
                </div>
                <div className="palette-toolbar">
                  <label className="palette-color-field">
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
                  </label>
                  <div className="palette-active-tool" data-tone={toolMeta[activeTool].tone}>
                    <span className="tool-icon" aria-hidden="true">{toolIcons[activeTool]}</span>
                    <div>
                      <strong>{toolOptions.find((tool) => tool.id === activeTool)?.label}</strong>
                      <span>{toolMeta[activeTool].hint}</span>
                    </div>
                  </div>
                </div>
                <div className="toolbar-tools palette-quick-tools">
                  {quickToolOptions.map((tool) => (
                    <button
                      key={tool.id}
                      className={tool.id === activeTool ? "toolbar-chip active" : "toolbar-chip"}
                      onClick={() => setActiveTool(tool.id)}
                      data-tone={toolMeta[tool.id].tone}
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
                {showToolTray ? (
                  <div className="tool-grid tool-grid--tray">
                    {toolOptions.map((tool) => (
                      <button
                        key={`tray-${tool.id}`}
                        className={tool.id === activeTool ? "tool-button active" : "tool-button"}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setShowToolTray(false);
                        }}
                        data-tone={toolMeta[tool.id].tone}
                      >
                        <span className="tool-icon" aria-hidden="true">
                          {toolIcons[tool.id]}
                        </span>
                        <span>{tool.label}</span>
                        <span className="tool-caption">{toolMeta[tool.id].hint}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="helper-text">
                  Drag across cells to apply region tools. Markers place above the clicked residue, arrows can be dragged, and bridges connect two residues in one visible block.
                </p>
              </section>

              {selectedAnnotation ? (
                <section className="panel-card workspace-card inspector-card">
                  <div className="workspace-card-head">
                    <div>
                      <h2>Selected annotation</h2>
                      <p className="helper-text">Edit the selected element without leaving the canvas.</p>
                    </div>
                    <span className="inspector-tag">{selectedAnnotation.type.replace("-", " ")}</span>
                  </div>
                  <div className="inspector-actions">
                    <button className="secondary-button" onClick={() => duplicateAnnotation(selectedAnnotation.id)}>
                      Duplicate
                    </button>
                    <button
                      className={selectedAnnotation.locked ? "secondary-button active-toggle" : "secondary-button"}
                      onClick={() =>
                        setAnnotations((current) =>
                          current.map((annotation) =>
                            annotation.id === selectedAnnotation.id ? { ...annotation, locked: !annotation.locked } : annotation,
                          ),
                        )
                      }
                    >
                      {selectedAnnotation.locked ? "Locked" : "Lock"}
                    </button>
                  </div>
                  <div className="inspector-grid">
                    <label className="field-label">
                      Name
                      <input
                        className="text-field"
                        value={selectedAnnotation.label ?? ""}
                        onChange={(event) => {
                          const nextLabel = event.target.value;
                          updateSelectedAnnotation((annotation) => ({ ...annotation, label: nextLabel }));
                        }}
                      />
                    </label>
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
                      selectedAnnotation.type === "span-arrow" ||
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
                                annotation.type === "span-arrow" ||
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
                      selectedAnnotation.type === "arrow-down" ||
                      selectedAnnotation.type === "span-arrow") ? (
                      <label className="field-label">
                        Placement
                        <select
                          className="text-field"
                          value={selectedAnnotation.placement ?? "top"}
                          onChange={(event) => {
                            const placement = event.target.value as "top" | "bottom";
                            updateSelectedAnnotation((annotation) =>
                              "selection" in annotation &&
                              (annotation.type === "arrow" || annotation.type === "bracket" || annotation.type === "arrow-down" || annotation.type === "span-arrow")
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
                    {selectedAnnotation.type === "text" ? (
                      <label className="toggle-row inspector-toggle">
                        <span>Show text box</span>
                        <input
                          type="checkbox"
                          checked={selectedAnnotation.boxed ?? true}
                          onChange={(event) =>
                            updateSelectedAnnotation((annotation) =>
                              annotation.type === "text" ? { ...annotation, boxed: event.target.checked } : annotation,
                            )
                          }
                        />
                      </label>
                    ) : null}
                    {selectedAnnotation.type === "text" ? (
                      <label className="toggle-row inspector-toggle">
                        <span>Show connector line</span>
                        <input
                          type="checkbox"
                          checked={selectedAnnotation.connector ?? true}
                          onChange={(event) =>
                            updateSelectedAnnotation((annotation) =>
                              annotation.type === "text" ? { ...annotation, connector: event.target.checked } : annotation,
                            )
                          }
                        />
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
                </section>
              ) : null}

              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Layers</h2>
                    <p className="helper-text">Select, lock, reorder, duplicate, or hide annotations without changing the figure geometry.</p>
                  </div>
                </div>
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
                            aria-label={`Select ${annotationDisplayName(annotation)}`}
                          />
                          <div className="layer-main">
                            <button className="layer-label" onClick={() => setSelectedAnnotationId(annotation.id)}>
                              {annotationDisplayName(annotation)}
                            </button>
                            <div className="layer-meta">
                              <span>{annotation.type.replace("-", " ")}</span>
                              {annotation.locked ? <span>locked</span> : null}
                              {annotation.visible === false ? <span>hidden</span> : null}
                            </div>
                          </div>
                          <div className="layer-actions">
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
                              onClick={() =>
                                setAnnotations((current) =>
                                  current.map((item) => (item.id === annotation.id ? { ...item, locked: !item.locked } : item)),
                                )
                              }
                            >
                              {annotation.locked ? "Unlock" : "Lock"}
                            </button>
                            <button className="layer-action" onClick={() => duplicateAnnotation(annotation.id)}>
                              Copy
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
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => setWorkspaceStep("export")}>
                    Continue to export
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {workspaceStep === "export" ? (
            <>
              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Export figure</h2>
                    <p className="helper-text">Preview the final layout, tune spacing, and export SVG, PNG, or PDF.</p>
                  </div>
                  <span className="help-dot" aria-label={sectionHelp.project} data-tip={sectionHelp.project} tabIndex={0}>?</span>
                </div>
                <div className="inline-actions export-button-row">
                  <button className="primary-button" onClick={() => handleExport("svg")}>SVG</button>
                  <button className="secondary-button" onClick={() => handleExport("png")}>PNG</button>
                  <button className="secondary-button" onClick={() => handleExport("pdf")}>PDF</button>
                </div>
                <div className="workflow-toggles">
                  <label className="toggle-row compact-toggle">
                    <span>Print preview</span>
                    <input type="checkbox" checked={previewExport} onChange={(event) => setPreviewExport(event.target.checked)} />
                  </label>
                  <button className={focusMode ? "secondary-button active-toggle" : "secondary-button"} onClick={() => setFocusMode((current) => !current)}>
                    {focusMode ? "Exit focus" : "Focus mode"}
                  </button>
                </div>
                <label className="field-label">
                  Export preset
                  <div className="segmented">
                    {(["paper", "slide", "poster"] as const).map((preset) => (
                      <button
                        key={preset}
                        className={exportPreset === preset ? "segment-button active" : "segment-button"}
                        onClick={() => applyExportPreset(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <span className="helper-text">
                    {exportPreset === "custom" ? "Custom export settings" : `${exportPreset} preset active`}
                  </span>
                </label>
                <label className="field-label">
                  Print columns
                  <input
                    type="range"
                    min="40"
                    max="80"
                    step="5"
                    value={printColumns}
                    onChange={(event) => {
                      markExportPresetCustom();
                      setPrintColumns(Number(event.target.value));
                    }}
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
                    onChange={(event) => {
                      markExportPresetCustom();
                      setPrintSpacing(Number(event.target.value));
                    }}
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
                    onChange={(event) => {
                      markExportPresetCustom();
                      setExportScale(Number(event.target.value));
                    }}
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
                    onChange={(event) => {
                      markExportPresetCustom();
                      setPdfQuality(Number(event.target.value));
                    }}
                  />
                  <span className="helper-text">{Math.round(pdfQuality * 100)}% JPEG quality in PDF</span>
                </label>
              </section>

              <section className="panel-card workspace-card">
                <div className="workspace-card-head">
                  <div>
                    <h2>Legend and project</h2>
                    <p className="helper-text">Control the legend, then save or reopen a project without changing the exported format.</p>
                  </div>
                </div>
                <label className="toggle-row">
                  <span>Show legend</span>
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={(event) => {
                      markExportPresetCustom();
                      setShowLegend(event.target.checked);
                    }}
                  />
                </label>
                {showLegend ? (
                  <>
                    <label className="toggle-row">
                      <span>Include standard legend</span>
                      <input
                        type="checkbox"
                        checked={includeAutoLegend}
                        onChange={(event) => setIncludeAutoLegend(event.target.checked)}
                      />
                    </label>
                    <div className="legend-editor">
                      <div className="section-heading">
                        <h3>Custom legend items</h3>
                        <button className="secondary-button" onClick={addLegendItem}>
                          Add item
                        </button>
                      </div>
                      {customLegendItems.length === 0 ? (
                        <p className="helper-text">Add figure-specific legend rows for motifs, annotations, or custom callouts.</p>
                      ) : (
                        <div className="legend-list">
                          {customLegendItems.map((item) => (
                            <div key={item.id} className="legend-row">
                              <input
                                className="text-field"
                                value={item.label}
                                onChange={(event) =>
                                  setCustomLegendItems((current) =>
                                    current.map((entry) =>
                                      entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                                    ),
                                  )
                                }
                                placeholder="Legend label"
                              />
                              <select
                                className="text-field"
                                value={item.style}
                                onChange={(event) =>
                                  setCustomLegendItems((current) =>
                                    current.map((entry) =>
                                      entry.id === item.id
                                        ? { ...entry, style: event.target.value as CustomLegendItem["style"] }
                                        : entry,
                                    ),
                                  )
                                }
                              >
                                <option value="fill">Fill</option>
                                <option value="outline">Outline</option>
                                <option value="text">Text</option>
                              </select>
                              <input
                                className="toolbar-color"
                                type="color"
                                value={item.color}
                                onChange={(event) =>
                                  setCustomLegendItems((current) =>
                                    current.map((entry) =>
                                      entry.id === item.id ? { ...entry, color: event.target.value } : entry,
                                    ),
                                  )
                                }
                              />
                              <button
                                className="layer-action"
                                onClick={() => setCustomLegendItems((current) => current.filter((entry) => entry.id !== item.id))}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
                <div className="inline-actions export-actions">
                  <button className="secondary-button" onClick={saveProject}>
                    Save project JSON
                  </button>
                  <label className="file-button">
                    Load project JSON
                    <input type="file" accept=".json,application/json" onChange={handleProjectUpload} />
                  </label>
                </div>
              </section>
            </>
          ) : null}
        </aside>

        <main className="canvas-panel">
          <section className="panel-card workspace-banner">
            <div>
              <p className="eyebrow workflow-eyebrow">Current step</p>
              <h2>{workflowSteps.find((step) => step.id === workspaceStep)?.label}</h2>
              <p className="helper-text">{workflowSteps.find((step) => step.id === workspaceStep)?.description}</p>
            </div>
            <div className="workspace-banner-meta">
              <span className="workspace-pill">Tool: {toolOptions.find((tool) => tool.id === activeTool)?.label}</span>
              {previewExport ? <span className="workspace-pill">Print preview</span> : null}
              {focusMode ? <span className="workspace-pill">Focus mode</span> : null}
            </div>
          </section>

          <div className="status-bar">
            <span>{status}</span>
            {alignment ? (
              <span>
                {alignment.name} · {alignment.sequences.length} sequences · {alignment.alignmentLength} columns
              </span>
            ) : null}
          </div>

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
                includeAutoLegend={includeAutoLegend}
                customLegendItems={customLegendItems}
                structureRenderStyle={structureRenderStyle}
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
      ) : (
        <main className="info-shell">
          {activePage === "examples" ? (
            <section className="panel-card info-card-stack">
              <div className="section-heading">
                <div>
                  <h2>Examples gallery</h2>
                  <p className="helper-text">Load a prepared workspace and jump back into the editor with sensible presets, structure lanes, and example markup.</p>
                </div>
              </div>
              <div className="examples-grid">
                <article className="example-card">
                  <div className="example-preview example-preview--espript" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <h3>ESPript-style paper panel</h3>
                  <p className="helper-text">Classic conservation styling, visible legend, structure lanes, and compact manuscript-oriented spacing.</p>
                  <div className="example-tags">
                    <span className="example-tag">ESPript Classic</span>
                    <span className="example-tag">Paper preset</span>
                  </div>
                  <button className="primary-button" onClick={() => loadExampleWorkspace("espript")}>
                    Load in app
                  </button>
                </article>
                <article className="example-card">
                  <div className="example-preview example-preview--story" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <h3>Talk / lab meeting figure</h3>
                  <p className="helper-text">Flashier view mode, bigger export preset, and clear callout-style annotations for presentations.</p>
                  <div className="example-tags">
                    <span className="example-tag">Flashy</span>
                    <span className="example-tag">Slide preset</span>
                  </div>
                  <button className="primary-button" onClick={() => loadExampleWorkspace("story")}>
                    Load in app
                  </button>
                </article>
                <article className="example-card">
                  <div className="example-preview example-preview--mono" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <h3>Minimal poster panel</h3>
                  <p className="helper-text">Monochrome alignment with annotations preserved and a wider column layout for posters or supplementary figures.</p>
                  <div className="example-tags">
                    <span className="example-tag">Mono</span>
                    <span className="example-tag">Poster preset</span>
                  </div>
                  <button className="primary-button" onClick={() => loadExampleWorkspace("mono")}>
                    Load in app
                  </button>
                </article>
              </div>
            </section>
          ) : null}

          {activePage === "quickstart" ? (
            <section className="panel-card info-card-stack">
              <div className="section-heading">
                <div>
                  <h2>Docs and quickstart</h2>
                  <p className="helper-text">Everything you need to go from raw alignment to finished figure quickly.</p>
                </div>
              </div>
              <div className="docs-grid">
                <article className="doc-card">
                  <h3>1. Load an alignment</h3>
                  <p className="helper-text">Upload a Clustal `.aln` file or paste alignment text. FASTA-aligned sequences also work when formatted consistently.</p>
                </article>
                <article className="doc-card">
                  <h3>2. Choose a view mode</h3>
                  <p className="helper-text">Use `ESPript`, `Classic`, `Flashy`, `Mono`, `Chemistry`, or `Residue`, then tune conservation colors if needed.</p>
                </article>
                <article className="doc-card">
                  <h3>3. Annotate directly</h3>
                  <p className="helper-text">Drag to highlight or box, click to place markers, click twice for a bridge, and drag text labels or arrow endpoints.</p>
                </article>
                <article className="doc-card">
                  <h3>4. Add structure tracks</h3>
                  <p className="helper-text">Paste aligned H/E/T/C or DSSP-like tracks into the top or bottom lane to render helices, strands, and turns.</p>
                </article>
                <article className="doc-card">
                  <h3>5. Use export presets</h3>
                  <p className="helper-text">`Paper`, `Slide`, and `Poster` presets set spacing, scale, legend, and line weight before SVG/PNG/PDF export.</p>
                </article>
                <article className="doc-card">
                  <h3>6. Save project state</h3>
                  <p className="helper-text">Project JSON preserves alignment text, annotations, export settings, and structure tracks so figures can be reopened later.</p>
                </article>
              </div>
              <div className="code-note">
                <strong>Supported inputs:</strong> Clustal `.aln`, pasted alignment text, aligned FASTA.
              </div>
            </section>
          ) : null}

          {activePage === "contact" ? (
            <section className="panel-card info-card-stack contact-card">
              <div>
                <h2>Contact</h2>
                <p className="helper-text">AlignNotate is intended as one tool within a larger Singh Lab web presence, with the editor kept focused on figure production.</p>
              </div>
              <div className="contact-grid">
                <div>
                  <h3>Email</h3>
                  <a className="contact-link" href="mailto:mubasshirm22@gmail.com">mubasshirm22@gmail.com</a>
                </div>
                <div>
                  <h3>GitHub</h3>
                  <a className="contact-link" href="https://github.com/mubasshirm22/alignnotate" target="_blank" rel="noreferrer">
                    github.com/mubasshirm22/alignnotate
                  </a>
                </div>
                <div>
                  <h3>Use case</h3>
                  <p className="helper-text">Protein multiple-sequence-alignment figure preparation for papers, posters, lab meetings, and talks.</p>
                </div>
                <div>
                  <h3>Feedback</h3>
                  <p className="helper-text">Feature requests, parser edge cases, and annotation/export bugs are all useful to collect as the tool matures.</p>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      )}

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
            includeAutoLegend={includeAutoLegend}
            customLegendItems={customLegendItems}
            structureRenderStyle={structureRenderStyle}
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

function buildSampleTrack(length: number, lane: "top" | "bottom"): string {
  return Array.from({ length }, (_, index) => {
    if (lane === "top") {
      if (index >= 6 && index <= 22) return "H";
      if (index >= 34 && index <= 41) return "E";
      if (index >= 52 && index <= 56) return "T";
      if (index >= 68 && index <= 82) return "H";
      if (index >= 96 && index <= 103) return "E";
      return "C";
    }

    if (index >= 10 && index <= 18) return "E";
    if (index >= 28 && index <= 36) return "H";
    if (index >= 58 && index <= 63) return "T";
    if (index >= 90 && index <= 98) return "E";
    return "C";
  }).join("");
}

function buildDemoAnnotations(kind: "espript" | "story" | "mono"): Annotation[] {
  if (kind === "espript") {
    return [
      {
        id: "demo-highlight-1",
        type: "highlight",
        label: "Catalytic patch",
        color: "#7c3aed",
        selection: { startSequence: 0, endSequence: 3, startColumn: 12, endColumn: 16 },
      },
      {
        id: "demo-bridge-1",
        type: "bridge",
        label: "Bridge",
        color: "#2563eb",
        from: { sequenceIndex: 0, column: 36 },
        to: { sequenceIndex: 0, column: 42 },
        style: "bracket",
        placement: "top",
        height: 1.2,
      },
      {
        id: "demo-text-1",
        type: "text",
        label: "Motif label",
        color: "#0f172a",
        selection: { startSequence: 0, endSequence: 0, startColumn: 48, endColumn: 48 },
        text: "Motif A",
        dx: 18,
        dy: -20,
      },
    ];
  }

  if (kind === "story") {
    return [
      {
        id: "demo-box-1",
        type: "box",
        label: "Variable loop",
        color: "#16a34a",
        selection: { startSequence: 0, endSequence: 3, startColumn: 66, endColumn: 74 },
      },
      {
        id: "demo-arrow-1",
        type: "arrow",
        label: "Callout",
        color: "#dc2626",
        selection: { startSequence: 1, endSequence: 1, startColumn: 88, endColumn: 94 },
        placement: "top",
        size: 1.1,
        tailDx: 0,
        tailDy: 0,
        headDx: 0,
        headDy: 0,
      },
      {
        id: "demo-text-2",
        type: "text",
        label: "Talk label",
        color: "#111827",
        selection: { startSequence: 1, endSequence: 1, startColumn: 93, endColumn: 93 },
        text: "Helix cap",
        dx: 24,
        dy: -18,
      },
    ];
  }

  return [
    {
      id: "demo-bracket-1",
      type: "bracket",
      label: "Domain span",
      color: "#1d4ed8",
      selection: { startSequence: 0, endSequence: 0, startColumn: 24, endColumn: 44 },
      placement: "top",
      size: 1,
      tailDx: 0,
      tailDy: 0,
      headDx: 0,
      headDy: 0,
    },
    {
      id: "demo-circle-1",
      type: "open-circle",
      label: "Site marker",
      color: "#b45309",
      selection: { startSequence: 2, endSequence: 2, startColumn: 82, endColumn: 82 },
      placement: "top",
      size: 1,
    },
  ];
}
