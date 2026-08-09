import type { CSSProperties } from "react";

type ApothecaryPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

const slatePalette = [
  "#f4f1eb",
  "#e8e3da",
  "#d8d0c4",
  "#c0b5a6",
  "#a69a8a",
  "#8f8375",
  "#6B5F52",
  "#5c5249",
  "#4e4640",
  "#3d3429",
] as const;

const mossPalette = [
  "#e9f0eb",
  "#d5e3d9",
  "#b6ccb9",
  "#92b098",
  "#73957c",
  "#5f8269",
  "#4f6f58",
  "#435c4b",
  "#384b3f",
  "#2d3d34",
] as const;

const denimPalette = [
  "#edf1f4",
  "#d9e2e9",
  "#b9c9d6",
  "#94aabd",
  "#7893a8",
  "#637f94",
  "#526d80",
  "#465c6d",
  "#3a4d5b",
  "#2f404c",
] as const;

const clayPalette = [
  "#f5ebe3",
  "#e8d9c9",
  "#d9c0a5",
  "#c4a07a",
  "#b08d62",
  "#9c7a52",
  "#8a6b48",
  "#755a3c",
  "#614b32",
  "#4f3d28",
] as const;

const amberPalette = [
  "#faf4eb",
  "#f5e8d4",
  "#edd4b0",
  "#e0b87a",
  "#d4a256",
  "#c4903f",
  "#b07d35",
  "#94682c",
  "#7a5524",
  "#61441d",
] as const;

const dangerPalette = [
  "#f5e8e8",
  "#e8cfcf",
  "#d4a8a8",
  "#c08080",
  "#a85858",
  "#9b5454",
  "#9B4D4D",
  "#854343",
  "#6f3939",
  "#592f2f",
] as const;

export function apothecaryPillStyle(palette: ApothecaryPalette): CSSProperties {
  return {
    backgroundColor: palette[1],
    color: palette[8],
    border: `1px solid ${palette[3]}`,
  };
}

export const apothecaryBooleanPills = {
  yes: apothecaryPillStyle(mossPalette),
  no: apothecaryPillStyle(slatePalette),
  noAlert: apothecaryPillStyle(dangerPalette),
} as const;

export {
  amberPalette,
  clayPalette,
  dangerPalette,
  denimPalette,
  mossPalette,
  slatePalette,
};
export type { ApothecaryPalette };
