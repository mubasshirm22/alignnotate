const residuePalette: Record<string, string> = {
  A: "#d8ead6",
  V: "#d8ead6",
  L: "#d8ead6",
  I: "#d8ead6",
  M: "#d8ead6",
  F: "#f0d8cc",
  Y: "#f0d8cc",
  W: "#f0d8cc",
  K: "#d7e6fb",
  R: "#d7e6fb",
  H: "#d7e6fb",
  D: "#f6d2d3",
  E: "#f6d2d3",
  S: "#fff0c7",
  T: "#fff0c7",
  N: "#ece2fb",
  Q: "#ece2fb",
  C: "#f9f3a8",
  G: "#e8ebee",
  P: "#f1e0cf",
  "-": "#f5f7fa",
};

export function residueFill(residue: string): string {
  return residuePalette[residue.toUpperCase()] ?? "#f3f5f8";
}

export function residueTextColor(residue: string): string {
  if (residue === "-") {
    return "#93a1b3";
  }

  if ("DE".includes(residue.toUpperCase())) {
    return "#b42318";
  }

  if ("KRH".includes(residue.toUpperCase())) {
    return "#175cd3";
  }

  return "#123044";
}
