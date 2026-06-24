import type {
  AlignmentData,
  ConservationColorOverrides,
  EspriptPreset,
  EspriptScoreMode,
  RenderMode,
  VisualizationMode,
} from "./types";

const similarityGroups = [
  "STA",
  "STPA",
  "NEQK",
  "NHQK",
  "NDEQ",
  "QHRK",
  "FVLIM",
  "HY",
  "FYW",
  "CSA",
  "ATV",
];

const multAlinGroups = ["IV", "LM", "FY", "NDQEBZ"];
const equivalenceGroups = ["HKR", "DE", "STNQ", "AVLIM", "FYW", "P", "G", "C"];
const blosum62: Record<string, Record<string, number>> = {
  A: { A: 4, R: -1, N: -2, D: -2, C: 0, Q: -1, E: -1, G: 0, H: -2, I: -1, L: -1, K: -1, M: -1, F: -2, P: -1, S: 1, T: 0, W: -3, Y: -2, V: 0 },
  R: { A: -1, R: 5, N: 0, D: -2, C: -3, Q: 1, E: 0, G: -2, H: 0, I: -3, L: -2, K: 2, M: -1, F: -3, P: -2, S: -1, T: -1, W: -3, Y: -2, V: -3 },
  N: { A: -2, R: 0, N: 6, D: 1, C: -3, Q: 0, E: 0, G: 0, H: 1, I: -3, L: -3, K: 0, M: -2, F: -3, P: -2, S: 1, T: 0, W: -4, Y: -2, V: -3 },
  D: { A: -2, R: -2, N: 1, D: 6, C: -3, Q: 0, E: 2, G: -1, H: -1, I: -3, L: -4, K: -1, M: -3, F: -3, P: -1, S: 0, T: -1, W: -4, Y: -3, V: -3 },
  C: { A: 0, R: -3, N: -3, D: -3, C: 9, Q: -3, E: -4, G: -3, H: -3, I: -1, L: -1, K: -3, M: -1, F: -2, P: -3, S: -1, T: -1, W: -2, Y: -2, V: -1 },
  Q: { A: -1, R: 1, N: 0, D: 0, C: -3, Q: 5, E: 2, G: -2, H: 0, I: -3, L: -2, K: 1, M: 0, F: -3, P: -1, S: 0, T: -1, W: -2, Y: -1, V: -2 },
  E: { A: -1, R: 0, N: 0, D: 2, C: -4, Q: 2, E: 5, G: -2, H: 0, I: -3, L: -3, K: 1, M: -2, F: -3, P: -1, S: 0, T: -1, W: -3, Y: -2, V: -2 },
  G: { A: 0, R: -2, N: 0, D: -1, C: -3, Q: -2, E: -2, G: 6, H: -2, I: -4, L: -4, K: -2, M: -3, F: -3, P: -2, S: 0, T: -2, W: -2, Y: -3, V: -3 },
  H: { A: -2, R: 0, N: 1, D: -1, C: -3, Q: 0, E: 0, G: -2, H: 8, I: -3, L: -3, K: -1, M: -2, F: -1, P: -2, S: -1, T: -2, W: -2, Y: 2, V: -3 },
  I: { A: -1, R: -3, N: -3, D: -3, C: -1, Q: -3, E: -3, G: -4, H: -3, I: 4, L: 2, K: -3, M: 1, F: 0, P: -3, S: -2, T: -1, W: -3, Y: -1, V: 3 },
  L: { A: -1, R: -2, N: -3, D: -4, C: -1, Q: -2, E: -3, G: -4, H: -3, I: 2, L: 4, K: -2, M: 2, F: 0, P: -3, S: -2, T: -1, W: -2, Y: -1, V: 1 },
  K: { A: -1, R: 2, N: 0, D: -1, C: -3, Q: 1, E: 1, G: -2, H: -1, I: -3, L: -2, K: 5, M: -1, F: -3, P: -1, S: 0, T: -1, W: -3, Y: -2, V: -2 },
  M: { A: -1, R: -1, N: -2, D: -3, C: -1, Q: 0, E: -2, G: -3, H: -2, I: 1, L: 2, K: -1, M: 5, F: 0, P: -2, S: -1, T: -1, W: -1, Y: -1, V: 1 },
  F: { A: -2, R: -3, N: -3, D: -3, C: -2, Q: -3, E: -3, G: -3, H: -1, I: 0, L: 0, K: -3, M: 0, F: 6, P: -4, S: -2, T: -2, W: 1, Y: 3, V: -1 },
  P: { A: -1, R: -2, N: -2, D: -1, C: -3, Q: -1, E: -1, G: -2, H: -2, I: -3, L: -3, K: -1, M: -2, F: -4, P: 7, S: -1, T: -1, W: -4, Y: -3, V: -2 },
  S: { A: 1, R: -1, N: 1, D: 0, C: -1, Q: 0, E: 0, G: 0, H: -1, I: -2, L: -2, K: 0, M: -1, F: -2, P: -1, S: 4, T: 1, W: -3, Y: -2, V: -2 },
  T: { A: 0, R: -1, N: 0, D: -1, C: -1, Q: -1, E: -1, G: -2, H: -2, I: -1, L: -1, K: -1, M: -1, F: -2, P: -1, S: 1, T: 5, W: -2, Y: -2, V: 0 },
  W: { A: -3, R: -3, N: -4, D: -4, C: -2, Q: -2, E: -3, G: -2, H: -2, I: -3, L: -2, K: -3, M: -1, F: 1, P: -4, S: -3, T: -2, W: 11, Y: 2, V: -3 },
  Y: { A: -2, R: -2, N: -2, D: -3, C: -2, Q: -1, E: -2, G: -3, H: 2, I: -1, L: -1, K: -2, M: -1, F: 3, P: -3, S: -2, T: -2, W: 2, Y: 7, V: -1 },
  V: { A: 0, R: -3, N: -3, D: -3, C: -1, Q: -2, E: -2, G: -3, H: -3, I: 3, L: 1, K: -2, M: 1, F: -1, P: -2, S: -2, T: 0, W: -3, Y: -1, V: 4 },
};

export type ColumnProfile = {
  occupancy: number;
  dominantResidue: string | null;
  identityFraction: number;
  similarityFraction: number;
  score: number;
  threshold: number;
  espriptScoreMode: EspriptScoreMode | null;
  highlightResidues: string[];
  frameActive: boolean;
  differenceActive: boolean;
  differenceScore: number;
  level: "none" | "weak" | "similar" | "strict";
};

export type ResidueStyle = {
  fill: string;
  stroke: string;
  text: string;
  drawBox: boolean;
  frameColor: string | null;
};

export function buildColumnProfiles(
  alignment: AlignmentData,
  options?: {
    visualizationMode?: VisualizationMode;
    espriptScoreMode?: EspriptScoreMode;
    espriptThreshold?: number;
    espriptDiffThreshold?: number;
    sequenceGroups?: number[][];
  },
): ColumnProfile[] {
  const visualizationMode = options?.visualizationMode ?? "publication-classic";
  const espriptScoreMode = options?.espriptScoreMode ?? "B";
  const espriptThreshold = options?.espriptThreshold ?? espriptDefaultThreshold(espriptScoreMode);
  const espriptDiffThreshold = options?.espriptDiffThreshold ?? 0.5;
  const sequenceGroups = options?.sequenceGroups ?? [];

  return Array.from({ length: alignment.alignmentLength }, (_, column) => {
    const columnResidues = alignment.sequences.map((sequence, sequenceIndex) => ({
      sequenceIndex,
      residue: sequence.aligned[column]?.toUpperCase() ?? "-",
    }));
    const residues = columnResidues.map((entry) => entry.residue).filter((residue) => residue !== "-");

    const occupancy = residues.length / alignment.sequences.length;
    if (residues.length === 0) {
      return {
        occupancy,
        dominantResidue: null,
        identityFraction: 0,
        similarityFraction: 0,
        score: 0,
        threshold: espriptThreshold,
        espriptScoreMode: visualizationMode === "espript" ? espriptScoreMode : null,
        highlightResidues: [],
        frameActive: false,
        differenceActive: false,
        differenceScore: 0,
        level: "none",
      };
    }

    const counts = new Map<string, number>();
    for (const residue of residues) {
      counts.set(residue, (counts.get(residue) ?? 0) + 1);
    }

    let dominantResidue: string | null = null;
    let dominantCount = 0;
    for (const [residue, count] of counts) {
      if (count > dominantCount) {
        dominantResidue = residue;
        dominantCount = count;
      }
    }

    const identityFraction = dominantCount / residues.length;
    const similarityFraction = bestSimilarityFraction(residues);
    const strictIdentity = counts.size === 1 && residues.length >= 2 && occupancy >= 0.7;

    if (visualizationMode === "espript") {
      const espript = scoreEspriptColumn(
        columnResidues,
        strictIdentity,
        dominantResidue,
        espriptScoreMode,
        espriptThreshold,
        espriptDiffThreshold,
        sequenceGroups,
      );
      return {
        occupancy,
        dominantResidue,
        identityFraction,
        similarityFraction,
        score: espript.score,
        threshold: espriptThreshold,
        espriptScoreMode,
        highlightResidues: espript.highlightResidues,
        frameActive: espript.frameActive,
        differenceActive: espript.differenceActive,
        differenceScore: espript.differenceScore,
        level: strictIdentity ? "strict" : espript.score >= espriptThreshold && espript.highlightResidues.length > 0 ? "similar" : "none",
      };
    }

    let level: ColumnProfile["level"] = "none";
    if (occupancy >= 0.7 && strictIdentity) {
      level = "strict";
    } else if (occupancy >= 0.7 && similarityFraction >= 0.85) {
      level = "similar";
    } else if (occupancy >= 0.55 && identityFraction >= 0.6) {
      level = "weak";
    }

    return {
      occupancy,
      dominantResidue,
      identityFraction,
      similarityFraction,
      score: similarityFraction,
      threshold: 0.85,
      espriptScoreMode: null,
      highlightResidues: dominantResidue ? [dominantResidue] : [],
      frameActive: false,
      differenceActive: false,
      differenceScore: 0,
      level,
    };
  });
}

export function getResidueStyle(
  residue: string,
  profile: ColumnProfile,
  renderMode: RenderMode,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  colorOverrides?: ConservationColorOverrides | null,
): ResidueStyle {
  const upper = residue.toUpperCase();
  if (upper === "-") {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: renderMode === "export" ? "#98a2b3" : "#9aa4b2",
      drawBox: false,
      frameColor: null,
    };
  }

  if (visualizationMode === "chemistry") {
    return chemistryStyle(upper, renderMode);
  }

  if (visualizationMode === "residue") {
    return residuePaletteStyle(upper, renderMode);
  }

  if (visualizationMode === "publication-mono") {
    return applyOverrides(monoPublicationStyle(upper, profile, renderMode), profile, colorOverrides);
  }

  if (visualizationMode === "publication-flashy") {
    return applyOverrides(flashyPublicationStyle(upper, profile, renderMode), profile, colorOverrides);
  }

  if (visualizationMode === "espript") {
    return applyOverrides(espriptStyle(upper, profile, renderMode, espriptPreset), profile, colorOverrides);
  }

  if (profile.level === "strict" && upper === profile.dominantResidue) {
    return applyOverrides(
      {
      fill: renderMode === "export" ? "#d92d20" : "#e5483f",
      stroke: renderMode === "export" ? "#d92d20" : "#e5483f",
      text: "#ffffff",
      drawBox: true,
      frameColor: null,
      },
      profile,
      colorOverrides,
    );
  }

  if (profile.level === "similar") {
    return applyOverrides(
      {
      fill: renderMode === "export" ? "#fff4cc" : "#fff3c4",
      stroke: renderMode === "export" ? "#f79009" : "#f79009",
      text: "#8f1d1d",
      drawBox: true,
      frameColor: null,
      },
      profile,
      colorOverrides,
    );
  }

  if (profile.level === "weak" && upper === profile.dominantResidue) {
    return applyOverrides(
      {
      fill: "transparent",
      stroke: "transparent",
      text: "#b42318",
      drawBox: false,
      frameColor: null,
      },
      profile,
      colorOverrides,
    );
  }

  return applyOverrides(
    {
    fill: "transparent",
    stroke: "transparent",
    text: "#101828",
    drawBox: false,
    frameColor: null,
    },
    profile,
    colorOverrides,
  );
}

export function conservationTrackColor(
  profile: ColumnProfile,
  colorOverrides?: ConservationColorOverrides | null,
): string {
  if (profile.level === "strict") {
    return colorOverrides?.strict ?? "#d92d20";
  }
  if (profile.level === "similar") {
    return colorOverrides?.similar ?? "#f79009";
  }
  if (profile.level === "weak") {
    return colorOverrides?.weak ?? "#fdb022";
  }
  return colorOverrides?.neutral ?? "#d0d5dd";
}

function bestSimilarityFraction(residues: string[]): number {
  let best = 0;
  for (const group of similarityGroups) {
    const count = residues.filter((residue) => group.includes(residue)).length;
    best = Math.max(best, count / residues.length);
  }
  return best;
}

function scoreEspriptColumn(
  columnResidues: Array<{ sequenceIndex: number; residue: string }>,
  strictIdentity: boolean,
  dominantResidue: string | null,
  mode: EspriptScoreMode,
  threshold: number,
  diffThreshold: number,
  sequenceGroups: number[][],
): {
  score: number;
  highlightResidues: string[];
  frameActive: boolean;
  differenceActive: boolean;
  differenceScore: number;
} {
  const residues = columnResidues.map((entry) => entry.residue).filter((residue) => residue !== "-");
  const occupancy = residues.length / Math.max(columnResidues.length, 1);
  const enoughOccupancy = occupancy >= 0.65 && residues.length >= 2;
  if (strictIdentity) {
    return {
      score: 1,
      highlightResidues: dominantResidue ? [dominantResidue] : [],
      frameActive: false,
      differenceActive: false,
      differenceScore: 0,
    };
  }

  if (!enoughOccupancy) {
    return {
      score: 0,
      highlightResidues: [],
      frameActive: false,
      differenceActive: false,
      differenceScore: 0,
    };
  }

  const groupedResidues = normalizeSequenceGroups(columnResidues, sequenceGroups);
  const hasMultipleGroups = groupedResidues.length > 1;

  if (mode === "I") {
    const score = pairIdentityScore(residues);
    const inGroupScore = computeGroupedScore(groupedResidues, pairIdentityScore, score);
    const crossGroupScore = hasMultipleGroups ? computeCrossGroupPairScore(groupedResidues, (a, b) => (a === b ? 1 : 0)) : inGroupScore;
    const totalScore = hasMultipleGroups ? (inGroupScore + crossGroupScore) / 2 : inGroupScore;
    const differenceScore = hasMultipleGroups ? (inGroupScore - crossGroupScore) / 2 : 0;
    const highlightResidues = hasMultipleGroups
      ? groupedHighlightResidues(groupedResidues, pairIdentityScore, threshold, true)
      : contributionHighlightResidues(residues, (a, b) => (a === b ? 1 : 0), dominantResidue, threshold);
    return {
      score: totalScore,
      highlightResidues,
      frameActive: totalScore >= threshold && highlightResidues.length > 0,
      differenceActive: hasMultipleGroups && inGroupScore >= threshold && differenceScore > diffThreshold,
      differenceScore,
    };
  }

  if (mode === "S") {
    const score = dominantResidue ? residues.filter((residue) => residue === dominantResidue).length / residues.length : 0;
    const highlightResidues = score >= threshold && dominantResidue ? [dominantResidue] : [];
    return {
      score,
      highlightResidues,
      frameActive: score >= threshold && highlightResidues.length > 0,
      differenceActive: false,
      differenceScore: 0,
    };
  }

  if (mode === "M") {
    const bestGroup = bestResidueGroup(residues, multAlinGroups);
    const highlightResidues = bestGroup.score >= threshold ? bestGroup.members : [];
    return {
      score: bestGroup.score,
      highlightResidues,
      frameActive: bestGroup.score >= threshold && highlightResidues.length > 0,
      differenceActive: false,
      differenceScore: 0,
    };
  }

  if (mode === "E") {
    const bestGroup = bestResidueGroup(residues, equivalenceGroups);
    const highlightResidues = bestGroup.score >= threshold ? bestGroup.members : [];
    return {
      score: bestGroup.score,
      highlightResidues,
      frameActive: bestGroup.score >= threshold && highlightResidues.length > 0,
      differenceActive: false,
      differenceScore: 0,
    };
  }

  const score = pairwiseMatrixScore(residues, blosum62);
  const inGroupScore = computeGroupedScore(groupedResidues, (items) => pairwiseMatrixScore(items, blosum62), score);
  const crossGroupScore = hasMultipleGroups ? computeCrossGroupPairScore(groupedResidues, (a, b) => normalizeMatrixScore(matrixScore(blosum62, a, b))) : inGroupScore;
  const totalScore = hasMultipleGroups ? (inGroupScore + crossGroupScore) / 2 : inGroupScore;
  const differenceScore = hasMultipleGroups ? (inGroupScore - crossGroupScore) / 2 : 0;
  const highlightResidues = hasMultipleGroups
    ? groupedHighlightResidues(groupedResidues, (items) => pairwiseMatrixScore(items, blosum62), threshold, true)
    : contributionHighlightResidues(residues, (a, b) => normalizeMatrixScore(matrixScore(blosum62, a, b)), dominantResidue, threshold);
  return {
    score: totalScore,
    highlightResidues,
    frameActive: totalScore >= threshold && highlightResidues.length > 0,
    differenceActive: hasMultipleGroups && inGroupScore >= threshold && differenceScore > diffThreshold,
    differenceScore,
  };
}

function normalizeSequenceGroups(
  columnResidues: Array<{ sequenceIndex: number; residue: string }>,
  groups: number[][],
): string[][] {
  if (!groups.length) {
    return [columnResidues.map((entry) => entry.residue).filter((residue) => residue !== "-")];
  }

  const grouped = groups
    .map((group) =>
      group
        .map((sequenceIndex) => columnResidues.find((entry) => entry.sequenceIndex === sequenceIndex)?.residue ?? "-")
        .filter((residue) => residue !== "-"),
    )
    .filter((group) => group.length > 0);

  const covered = new Set(groups.flat());
  const remainder = columnResidues
    .filter((entry) => !covered.has(entry.sequenceIndex) && entry.residue !== "-")
    .map((entry) => [entry.residue]);

  return [...grouped, ...remainder].filter((group) => group.length > 0);
}

function computeGroupedScore(
  groupedResidues: string[][],
  scorer: (residues: string[]) => number,
  fallback: number,
): number {
  const scoredGroups = groupedResidues.filter((group) => group.length > 1).map((group) => scorer(group));
  if (scoredGroups.length === 0) {
    return fallback;
  }
  return scoredGroups.reduce((sum, score) => sum + score, 0) / scoredGroups.length;
}

function computeCrossGroupPairScore(
  groupedResidues: string[][],
  pairScorer: (a: string, b: string) => number,
): number {
  const scores: number[] = [];
  for (let i = 0; i < groupedResidues.length; i += 1) {
    for (let j = i + 1; j < groupedResidues.length; j += 1) {
      const pairScores: number[] = [];
      for (const a of groupedResidues[i]) {
        for (const b of groupedResidues[j]) {
          pairScores.push(pairScorer(a, b));
        }
      }
      if (pairScores.length > 0) {
        scores.push(pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length);
      }
    }
  }
  if (scores.length === 0) {
    return 0;
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function groupedHighlightResidues(
  groupedResidues: string[][],
  scorer: (residues: string[]) => number,
  threshold: number,
  hasMultipleGroups: boolean,
): string[] {
  if (!hasMultipleGroups) {
    return uniqueCharacters(groupedResidues.flat());
  }

  const highlighted = groupedResidues
    .filter((group) => group.length > 1 && scorer(group) >= threshold)
    .flat();

  return uniqueCharacters(highlighted);
}

function contributionHighlightResidues(
  residues: string[],
  pairScorer: (a: string, b: string) => number,
  dominantResidue: string | null,
  threshold: number,
): string[] {
  if (residues.length <= 1) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const residue of residues) {
    counts.set(residue, (counts.get(residue) ?? 0) + 1);
  }

  const kept: string[] = [];
  for (const residue of counts.keys()) {
    let total = 0;
    let pairs = 0;
    for (const other of residues) {
      total += pairScorer(residue, other);
      pairs += 1;
    }

    const average = pairs === 0 ? 0 : total / pairs;
    const count = counts.get(residue) ?? 0;
    const dominantSimilarity = dominantResidue ? pairScorer(residue, dominantResidue) : 0;
    const dominantBoost =
      dominantResidue !== null &&
      residue === dominantResidue &&
      count / residues.length >= 0.5 &&
      average >= threshold - 0.08;
    const recurringCompatibleResidue = count >= 2 && dominantSimilarity >= threshold - 0.08 && average >= threshold - 0.12;

    if (average >= threshold || dominantBoost || recurringCompatibleResidue) {
      kept.push(residue);
    }
  }

  return uniqueCharacters(kept);
}

function pairIdentityScore(residues: string[]): number {
  if (residues.length <= 1) {
    return 1;
  }

  let identicalPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < residues.length; i += 1) {
    for (let j = i + 1; j < residues.length; j += 1) {
      totalPairs += 1;
      if (residues[i] === residues[j]) {
        identicalPairs += 1;
      }
    }
  }
  return totalPairs === 0 ? 1 : identicalPairs / totalPairs;
}

function pairwiseMatrixScore(residues: string[], matrix: Record<string, Record<string, number>>): number {
  if (residues.length <= 1) {
    return 1;
  }

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < residues.length; i += 1) {
    for (let j = i + 1; j < residues.length; j += 1) {
      total += normalizeMatrixScore(matrixScore(matrix, residues[i], residues[j]));
      pairs += 1;
    }
  }
  return pairs === 0 ? 1 : total / pairs;
}

function bestResidueGroup(
  residues: string[],
  groups: string[],
): {
  score: number;
  members: string[];
} {
  let bestScore = 0;
  let bestMembers: string[] = [];

  for (const group of groups) {
    const members = uniqueCharacters(
      residues.filter((residue) => residueMatchesGroup(residue, group)),
    );
    const score = members.length === 0 ? 0 : residues.filter((residue) => residueMatchesGroup(residue, group)).length / residues.length;
    if (score > bestScore) {
      bestScore = score;
      bestMembers = members;
    }
  }

  return {
    score: bestScore,
    members: bestMembers,
  };
}

function residueMatchesGroup(residue: string, group: string): boolean {
  if (group.includes(residue)) {
    return true;
  }

  if (residue === "B") {
    return group.includes("D") || group.includes("N");
  }

  if (residue === "Z") {
    return group.includes("E") || group.includes("Q");
  }

  return false;
}

function uniqueCharacters(values: string[]): string[] {
  return [...new Set(values)];
}

function matrixScore(matrix: Record<string, Record<string, number>>, a: string, b: string): number {
  const row = matrix[a];
  if (row?.[b] !== undefined) {
    return row[b];
  }
  const reverse = matrix[b];
  if (reverse?.[a] !== undefined) {
    return reverse[a];
  }
  return 0;
}

function normalizeMatrixScore(score: number): number {
  return (score + 4) / 15;
}

function espriptDefaultThreshold(mode: EspriptScoreMode): number {
  if (mode === "B") return 0.7;
  if (mode === "I") return 0.7;
  if (mode === "S") return 0.7;
  if (mode === "M") return 0.75;
  return 0.75;
}

function chemistryStyle(residue: string, renderMode: RenderMode): ResidueStyle {
  const category = classifyResidue(residue);
  const styles: Record<string, ResidueStyle> = {
    hydrophobic: {
      fill: renderMode === "export" ? "#e7f3e8" : "#eaf6ec",
      stroke: "#88b38f",
      text: "#23462a",
      drawBox: true,
      frameColor: null,
    },
    aromatic: {
      fill: renderMode === "export" ? "#f6eadc" : "#fbefe2",
      stroke: "#d5a264",
      text: "#6a3e12",
      drawBox: true,
      frameColor: null,
    },
    positive: {
      fill: renderMode === "export" ? "#e8f0ff" : "#edf3ff",
      stroke: "#84a3ff",
      text: "#1d3f91",
      drawBox: true,
      frameColor: null,
    },
    negative: {
      fill: renderMode === "export" ? "#fde7e7" : "#feebeb",
      stroke: "#f19999",
      text: "#9b1c1c",
      drawBox: true,
      frameColor: null,
    },
    polar: {
      fill: renderMode === "export" ? "#fff3d6" : "#fff6df",
      stroke: "#e2bd62",
      text: "#7a5a12",
      drawBox: true,
      frameColor: null,
    },
    special: {
      fill: renderMode === "export" ? "#efe8fb" : "#f2ecfe",
      stroke: "#b39ddb",
      text: "#5a3e8a",
      drawBox: true,
      frameColor: null,
    },
  };
  return styles[category];
}

function residuePaletteStyle(residue: string, renderMode: RenderMode): ResidueStyle {
  const palette: Record<string, [string, string]> = {
    A: ["#e8f5e9", "#2e7d32"],
    C: ["#fff4bf", "#8d6e00"],
    D: ["#ffe2e2", "#c62828"],
    E: ["#ffd6d6", "#b71c1c"],
    F: ["#f9e6d9", "#8d4b20"],
    G: ["#eef2f6", "#455a64"],
    H: ["#e6f0ff", "#1e40af"],
    I: ["#e7f4e8", "#2f6d38"],
    K: ["#e0ebff", "#1d4ed8"],
    L: ["#e7f4e8", "#2f6d38"],
    M: ["#e1f0e2", "#2b6c35"],
    N: ["#fff1d6", "#946200"],
    P: ["#efe7fb", "#6b46c1"],
    Q: ["#fff1d6", "#946200"],
    R: ["#deebff", "#1d4ed8"],
    S: ["#fff6dc", "#8b6c00"],
    T: ["#fff6dc", "#8b6c00"],
    V: ["#e7f4e8", "#2f6d38"],
    W: ["#f8e5d6", "#8b4513"],
    Y: ["#f8e5d6", "#8b4513"],
  };
  const [fill, text] = palette[residue] ?? ["#f1f5f9", "#334155"];
  return {
    fill: renderMode === "export" ? fill : fill,
    stroke: renderMode === "export" ? "#d0d5dd" : "#d8dee6",
    text,
    drawBox: true,
    frameColor: null,
  };
}

function classifyResidue(residue: string):
  | "hydrophobic"
  | "aromatic"
  | "positive"
  | "negative"
  | "polar"
  | "special" {
  if ("AILMV".includes(residue)) return "hydrophobic";
  if ("FYW".includes(residue)) return "aromatic";
  if ("KRH".includes(residue)) return "positive";
  if ("DE".includes(residue)) return "negative";
  if ("STNQ".includes(residue)) return "polar";
  return "special";
}

function flashyPublicationStyle(residue: string, profile: ColumnProfile, renderMode: RenderMode): ResidueStyle {
  if (profile.level === "strict" && residue === profile.dominantResidue) {
    return {
      fill: renderMode === "export" ? "#c81e1e" : "#d92d20",
      stroke: renderMode === "export" ? "#c81e1e" : "#d92d20",
      text: "#ffffff",
      drawBox: true,
      frameColor: null,
    };
  }
  if (profile.level === "similar") {
    return {
      fill: renderMode === "export" ? "#fff0b3" : "#fff2bd",
      stroke: "#335cff",
      text: "#c81e1e",
      drawBox: true,
      frameColor: null,
    };
  }
  if (profile.level === "weak" && residue === profile.dominantResidue) {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#c81e1e",
      drawBox: false,
      frameColor: null,
    };
  }
  return {
    fill: "transparent",
    stroke: "transparent",
    text: "#101828",
    drawBox: false,
    frameColor: null,
  };
}

function monoPublicationStyle(residue: string, profile: ColumnProfile, renderMode: RenderMode): ResidueStyle {
  if (profile.level === "strict" && residue === profile.dominantResidue) {
    return {
      fill: renderMode === "export" ? "#111111" : "#2b2b2b",
      stroke: renderMode === "export" ? "#111111" : "#2b2b2b",
      text: "#ffffff",
      drawBox: true,
      frameColor: null,
    };
  }
  if (profile.level === "similar") {
    return {
      fill: renderMode === "export" ? "#f3f4f6" : "#f5f6f8",
      stroke: "#667085",
      text: "#111111",
      drawBox: true,
      frameColor: null,
    };
  }
  if (profile.level === "weak" && residue === profile.dominantResidue) {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#344054",
      drawBox: false,
      frameColor: null,
    };
  }
  return {
    fill: "transparent",
    stroke: "transparent",
    text: "#101828",
    drawBox: false,
    frameColor: null,
  };
}

function espriptStyle(
  residue: string,
  profile: ColumnProfile,
  renderMode: RenderMode,
  preset: EspriptPreset,
): ResidueStyle {
  const blueFrame = renderMode === "export" ? "#335cff" : "#4c6fff";
  const highlighted = profile.highlightResidues.includes(residue);

  if (profile.level === "strict" && residue === profile.dominantResidue) {
    return {
      fill: renderMode === "export" ? "#ff1f1f" : "#ff3030",
      stroke: renderMode === "export" ? "#ff1f1f" : "#ff3030",
      text: "#ffffff",
      drawBox: true,
      frameColor: null,
    };
  }

  if (preset === "identity") {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#111111",
      drawBox: false,
      frameColor: null,
    };
  }

  if (profile.level === "similar" && highlighted) {
    if (preset === "flashy") {
      return {
        fill: renderMode === "export" ? "#ffef78" : "#fff08b",
        stroke: renderMode === "export" ? "#d1b400" : "#d8b400",
        text: "#111111",
        drawBox: true,
        frameColor: profile.frameActive ? blueFrame : null,
      };
    }
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#ff1f1f",
      drawBox: false,
      frameColor: profile.frameActive ? blueFrame : null,
    };
  }
  if (profile.level === "similar" && !highlighted && profile.frameActive) {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#111111",
      drawBox: false,
      frameColor: blueFrame,
    };
  }
  if (profile.level === "weak" && highlighted) {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: preset === "flashy" ? "#111111" : "#ff1f1f",
      drawBox: false,
      frameColor: null,
    };
  }
  return {
    fill: "transparent",
    stroke: "transparent",
    text: "#111111",
    drawBox: false,
    frameColor: null,
  };
}

function applyOverrides(
  style: ResidueStyle,
  profile: ColumnProfile,
  colorOverrides?: ConservationColorOverrides | null,
): ResidueStyle {
  if (!colorOverrides) {
    return style;
  }

  if (profile.level === "strict") {
    const strictColor = colorOverrides.strict;
    return {
      ...style,
      fill: style.drawBox ? strictColor : style.fill,
      stroke: style.drawBox ? strictColor : style.stroke,
      text: chooseReadableText(strictColor),
    };
  }

  if (profile.level === "similar") {
    return {
      ...style,
      fill: style.drawBox ? mixHex(colorOverrides.similar, "#ffffff", 0.84) : style.fill,
      stroke: style.drawBox ? colorOverrides.similar : style.stroke,
      text: style.text === "#111111" ? style.text : colorOverrides.similar,
      frameColor: style.frameColor ? colorOverrides.similar : style.frameColor,
    };
  }

  if (profile.level === "weak") {
    return {
      ...style,
      text: colorOverrides.weak,
      frameColor: style.frameColor ? colorOverrides.similar : style.frameColor,
    };
  }

  return {
    ...style,
    text: colorOverrides.neutral,
  };
}

function chooseReadableText(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64 ? "#111111" : "#ffffff";
}

function mixHex(base: string, other: string, ratio: number): string {
  const a = parseHex(base);
  const b = parseHex(other);
  const clampRatio = Math.max(0, Math.min(1, ratio));
  return toHex({
    r: Math.round(a.r * (1 - clampRatio) + b.r * clampRatio),
    g: Math.round(a.g * (1 - clampRatio) + b.g * clampRatio),
    b: Math.round(a.b * (1 - clampRatio) + b.b * clampRatio),
  });
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function toHex(color: { r: number; g: number; b: number }): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
