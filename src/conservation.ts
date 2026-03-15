import type { AlignmentData, ConservationColorOverrides, EspriptPreset, RenderMode, VisualizationMode } from "./types";

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

export type ColumnProfile = {
  occupancy: number;
  dominantResidue: string | null;
  identityFraction: number;
  similarityFraction: number;
  level: "none" | "weak" | "similar" | "strict";
};

export type ResidueStyle = {
  fill: string;
  stroke: string;
  text: string;
  drawBox: boolean;
  frameColor: string | null;
};

export function buildColumnProfiles(alignment: AlignmentData): ColumnProfile[] {
  return Array.from({ length: alignment.alignmentLength }, (_, column) => {
    const residues = alignment.sequences
      .map((sequence) => sequence.aligned[column]?.toUpperCase() ?? "-")
      .filter((residue) => residue !== "-");

    const occupancy = residues.length / alignment.sequences.length;
    if (residues.length === 0) {
      return {
        occupancy,
        dominantResidue: null,
        identityFraction: 0,
        similarityFraction: 0,
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

    let level: ColumnProfile["level"] = "none";
    if (occupancy >= 0.7 && identityFraction >= 0.95) {
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

  if (profile.level === "similar") {
    if (preset === "flashy") {
      return {
        fill: renderMode === "export" ? "#ffef78" : "#fff08b",
        stroke: renderMode === "export" ? "#d1b400" : "#d8b400",
        text: "#111111",
        drawBox: true,
        frameColor: blueFrame,
      };
    }
    return {
      fill: "transparent",
      stroke: "transparent",
      text: "#ff1f1f",
      drawBox: false,
      frameColor: blueFrame,
    };
  }
  if (profile.level === "weak" && residue === profile.dominantResidue) {
    return {
      fill: "transparent",
      stroke: "transparent",
      text: preset === "flashy" ? "#111111" : "#ff1f1f",
      drawBox: false,
      frameColor: blueFrame,
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
      text: colorOverrides.similar,
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
