export type Sequence = {
  id: string;
  aligned: string;
  startIndex: number;
};

export type AlignmentData = {
  name: string;
  sourceFormat: "clustal" | "fasta" | "plain";
  sequences: Sequence[];
  alignmentLength: number;
  consensus?: string;
};

export type Tool =
  | "select"
  | "highlight"
  | "box"
  | "triangle-up"
  | "triangle-down"
  | "arrow-down"
  | "arrow"
  | "bracket"
  | "circle"
  | "open-circle"
  | "star"
  | "bridge"
  | "text"
  | "erase";

export type Selection = {
  startSequence: number;
  endSequence: number;
  startColumn: number;
  endColumn: number;
};

export type AnnotationBase = {
  id: string;
  color: string;
  label?: string;
  locked?: boolean;
  visible?: boolean;
};

export type RegionAnnotation = AnnotationBase & {
  type: "highlight" | "box";
  selection: Selection;
};

export type MarkerAnnotation = AnnotationBase & {
  type: "triangle-up" | "triangle-down" | "arrow-down" | "circle" | "open-circle" | "star" | "arrow" | "bracket";
  selection: Selection;
  size?: number;
  placement?: "top" | "bottom";
  tailDx?: number;
  tailDy?: number;
  headDx?: number;
  headDy?: number;
};

export type BridgeAnnotation = AnnotationBase & {
  type: "bridge";
  from: CellAnchor;
  to: CellAnchor;
  style?: "bracket" | "arch";
  placement?: "top" | "bottom";
  height?: number;
};

export type TextAnnotation = AnnotationBase & {
  type: "text";
  selection: Selection;
  text: string;
  dx: number;
  dy: number;
};

export type Annotation = RegionAnnotation | MarkerAnnotation | TextAnnotation | BridgeAnnotation;

export type CellAnchor = {
  sequenceIndex: number;
  column: number;
};

export type LayoutMetrics = {
  nameWidth: number;
  cellWidth: number;
  cellHeight: number;
  blockColumns: number;
  groupSize: number;
  blockGap: number;
  headerHeight: number;
  consensusHeight: number;
  rowGap: number;
  padding: number;
  labelOffset: number;
};

export type RenderMode = "editor" | "export";

export type VisualizationMode =
  | "publication-classic"
  | "publication-flashy"
  | "publication-mono"
  | "espript"
  | "chemistry"
  | "residue";

export type EspriptPreset = "classic" | "flashy" | "identity";

export type ConservationColorOverrides = {
  strict: string;
  similar: string;
  weak: string;
  neutral: string;
};

export type CustomLegendItem = {
  id: string;
  label: string;
  color: string;
  style: "fill" | "outline" | "text";
};

export type SecondaryStructureTrack = {
  label: string;
  residues: string;
};

export type BlockLayout = {
  blockIndex: number;
  startColumn: number;
  endColumn: number;
  y: number;
  rowY: number[];
  height: number;
};
