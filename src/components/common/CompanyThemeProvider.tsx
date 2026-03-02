import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import companyStore from "../../store/company.store";

const DEFAULT_BRAND_COLOR = "#2980b9";

type Rgb = { r: number; g: number; b: number };

const clamp = (value: number, min = 0, max = 255) =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizeHex = (hex: string): string | null => {
  if (!hex) return null;
  const trimmed = hex.trim().replace("#", "");

  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }

  return null;
};

const hexToRgb = (hex: string): Rgb => {
  const normalized = normalizeHex(hex) || DEFAULT_BRAND_COLOR;
  const raw = normalized.replace("#", "");

  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g)
    .toString(16)
    .padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;

const mixRgb = (base: Rgb, target: Rgb, weight: number): Rgb => ({
  r: base.r + (target.r - base.r) * weight,
  g: base.g + (target.g - base.g) * weight,
  b: base.b + (target.b - base.b) * weight,
});

const generateBrandScale = (baseHex: string): Record<string, string> => {
  const base = hexToRgb(baseHex);
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const black: Rgb = { r: 0, g: 0, b: 0 };

  return {
    "25": rgbToHex(mixRgb(base, white, 0.95)),
    "50": rgbToHex(mixRgb(base, white, 0.9)),
    "100": rgbToHex(mixRgb(base, white, 0.82)),
    "200": rgbToHex(mixRgb(base, white, 0.68)),
    "300": rgbToHex(mixRgb(base, white, 0.46)),
    "400": rgbToHex(mixRgb(base, white, 0.25)),
    "500": rgbToHex(base),
    "600": rgbToHex(mixRgb(base, black, 0.12)),
    "700": rgbToHex(mixRgb(base, black, 0.24)),
    "800": rgbToHex(mixRgb(base, black, 0.38)),
    "900": rgbToHex(mixRgb(base, black, 0.5)),
    "950": rgbToHex(mixRgb(base, black, 0.64)),
  };
};

const CompanyThemeProvider = observer(function CompanyThemeProvider() {
  useEffect(() => {
    const root = document.documentElement.style;
    const color = normalizeHex(companyStore.mainColor) || DEFAULT_BRAND_COLOR;
    const brandScale = generateBrandScale(color);
    const rgb = hexToRgb(color);

    root.setProperty("--company-color", color);
    root.setProperty("--company-color-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    root.setProperty(
      "--shadow-focus-ring",
      `0px 0px 0px 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
    );

    Object.entries(brandScale).forEach(([step, value]) => {
      root.setProperty(`--color-brand-${step}`, value);
    });
  }, [companyStore.mainColor]);

  return null;
});

export default CompanyThemeProvider;
