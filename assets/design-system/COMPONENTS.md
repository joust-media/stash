# Component reference — Stash core primitives

Reference implementations (React/JSX) with props contracts. Recreate these in the app's framework; values are exact from the Figma source.

---

## Button

Pill CTA button — every Stash primary action; one per screen.

```jsx
<Button>Start Earning</Button>
<Button variant="reward">Claim Reward!</Button>
<Button variant="onGreen">Log In</Button>
```

`reward` (gold) only when the kid wins. `onGreen` on Leaf Green surfaces.

### Props

```ts
/**
 * Pill CTA. Radius 999, min-height 56, Baloo 2 Bold 18. One primary CTA per screen.
 * Hover: lift 2px + scale 1.02 (primary darkens to Deep Leaf). Press: scale 0.97.
 * @startingPoint section="Core" subtitle="Pill CTA — leaf, gold (wins only), white-on-green" viewport="700x220"
 */
export interface ButtonProps {
  /** "primary" = Leaf pill/white text (default) · "reward" = Gold pill/mustache text — earned wins ONLY · "onGreen" = white pill/leaf text for green surfaces */
  variant?: "primary" | "reward" | "onGreen";
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
```

### Implementation

```jsx
import React, { useState } from "react";

const palettes = {
  primary: { bg: "var(--color-primary)", color: "var(--text-on-primary)", hoverBg: "var(--color-primary-deep)", shadow: "var(--shadow-button)" },
  reward: { bg: "var(--color-reward)", color: "var(--mustache-brown)", hoverBg: "var(--color-reward)", shadow: "var(--shadow-button)" },
  onGreen: { bg: "rgb(255,255,255)", color: "var(--color-primary)", hoverBg: "rgb(255,255,255)", shadow: "var(--shadow-button)" },
};

export function Button({ variant = "primary", children, style, ...rest }) {
  const p = palettes[variant] || palettes.primary;
  const [state, setState] = useState("rest");
  const transform = state === "press" ? "scale(0.97)" : state === "hover" ? "translateY(-2px) scale(1.02)" : "none";
  return (
    <button
      onMouseEnter={() => setState("hover")}
      onMouseLeave={() => setState("rest")}
      onMouseDown={() => setState("press")}
      onMouseUp={() => setState("hover")}
      style={{
        border: "none", cursor: "pointer", borderRadius: 999, minHeight: 56,
        display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
        padding: "14px 44px", font: "var(--text-button)", fontFamily: "var(--font-display)",
        backgroundColor: state === "hover" && variant === "primary" ? p.hoverBg : p.bg,
        color: p.color, boxShadow: p.shadow, transform, transition: "transform 140ms ease, background-color 140ms ease",
        ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
```

---

## Card

Stash surface card — white, radius 20, warm brown shadow.

```jsx
<Card><h3>Playful, not silly</h3><p>Acorn puns OK.</p></Card>
<Card accent="green">✓ Always…</Card>
<Card accent="coral">✗ Never…</Card>
<Card inset><em>"3 more to go — your Stash is growing!"</em></Card>
```

### Props

```ts
/**
 * White card: radius 20, shadow 0 6px 18px rgba(92,51,25,.10). Do/don't variants add a 6px top border.
 * inset=true renders the cream example panel (radius 12) used inside cards.
 */
export interface CardProps {
  /** "green" = ✓ do-card top border · "coral" = ✗ don't-card top border */
  accent?: "none" | "green" | "coral";
  /** Cream inset panel (radius 12) for example quotes inside a card */
  inset?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
```

### Implementation

```jsx
import React from "react";

export function Card({ accent = "none", inset = false, children, style, ...rest }) {
  const accents = { green: "6px solid var(--leaf-deep)", coral: "6px solid var(--accent-warning)" };
  if (inset) return (
    <div style={{ borderRadius: 12, backgroundColor: "var(--surface-inset)", padding: "10px 12px", ...style }} {...rest}>{children}</div>
  );
  return (
    <div style={{
      borderRadius: 20, backgroundColor: "var(--surface-card)", boxShadow: "var(--shadow-card)",
      borderTop: accents[accent] || "none", padding: accent !== "none" ? "24px 26px 26px" : "22px 20px",
      ...style,
    }} {...rest}>{children}</div>
  );
}
```

---

## Chip

Uppercase metadata pill, e.g. version/status tags.

```jsx
<Chip>BRAND GUIDELINES · V1.0 · AUGUST 2026</Chip>
<Chip onGreen={false}>PRIMARY — LOCKED</Chip>
```

### Props

```ts
/**
 * Uppercase metadata pill (Nunito Bold 12, 0.12em tracking). Translucent white on green surfaces; cream on light.
 */
export interface ChipProps {
  /** true (default) = rgba(255,255,255,.16) on Leaf Green · false = cream chip with deep-leaf text */
  onGreen?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Chip(props: ChipProps): JSX.Element;
```

### Implementation

```jsx
import React from "react";

export function Chip({ onGreen = true, children, style, ...rest }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 999, padding: "8px 20px",
      backgroundColor: onGreen ? "rgba(255,255,255,0.16)" : "var(--surface-inset)",
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 12, lineHeight: 1,
      letterSpacing: "var(--chip-tracking)", textTransform: "uppercase",
      color: onGreen ? "rgb(255,255,255)" : "var(--leaf-deep)", ...style,
    }} {...rest}>{children}</span>
  );
}
```

---

## Eyebrow

Section eyebrow label above titles.

```jsx
<Eyebrow>03 — Typography</Eyebrow>
```

### Props

```ts
/**
 * Section eyebrow label — Nunito Bold 13, 0.16em tracking, Deep Leaf (white on green).
 */
export interface EyebrowProps {
  children: React.ReactNode;
  onGreen?: boolean;
  style?: React.CSSProperties;
}
export declare function Eyebrow(props: EyebrowProps): JSX.Element;
```

### Implementation

```jsx
import React from "react";

export function Eyebrow({ children, onGreen = false, style }) {
  return (
    <span style={{
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, lineHeight: 1,
      letterSpacing: "var(--eyebrow-tracking)", textTransform: "uppercase",
      color: onGreen ? "rgb(255,255,255)" : "var(--text-eyebrow)", ...style,
    }}>{children}</span>
  );
}
```

---

## ForestBackdrop

Leaf Green hero/celebration surface with the locked faint forest background layer. "Felt, not seen."

```jsx
<ForestBackdrop style={{ padding: 44 }}>
  <h1 style={{ color: "#fff" }}>Welcome back!</h1>
</ForestBackdrop>
```

### Props

```ts
/**
 * Leaf Green surface with the locked "Faint Forest Layer" — tone-on-tone shapes at ≤10% opacity,
 * large scale, cropped at edges. Only legal on Leaf Green; never behind text-bearing cream.
 */
export interface ForestBackdropProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ForestBackdrop(props: ForestBackdropProps): JSX.Element;
```

### Implementation

```jsx
import React from "react";

// Locked "Faint Forest Layer": tone-on-tone shapes over Leaf Green ONLY.
// White @6–8% (or black @4–5%), 80–160px, cropped at edges, 3–6 per screen.
const shapes = [
  { left: "-6%", top: "-12%", w: 150, h: 110, o: 0.07 },
  { right: "-5%", top: "18%", w: 120, h: 120, o: 0.06 },
  { left: "12%", bottom: "-14%", w: 160, h: 100, o: 0.08 },
  { right: "22%", bottom: "-8%", w: 90, h: 90, o: 0.06 },
];

export function ForestBackdrop({ children, style, ...rest }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", backgroundColor: "var(--color-primary)", borderRadius: 20, ...style }} {...rest}>
      {shapes.map((s, i) => (
        <div key={i} aria-hidden="true" style={{ position: "absolute", left: s.left, right: s.right, top: s.top, bottom: s.bottom, width: s.w, height: s.h, borderRadius: "50%", backgroundColor: `rgba(255,255,255,${s.o})`, pointerEvents: "none" }}></div>
      ))}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
```

---

## Money

Money amount per the type rules: Baloo 2 ExtraBold, cents at 60%, gold bounce for earnings.

```jsx
<Money amount={24.5} />
<Money amount={24.5} delta={1} />
```

### Props

```ts
/**
 * Money display — Baloo 2 ExtraBold, cents at 60% size, chestnut. Earnings deltas bounce in Acorn Gold.
 */
export interface MoneyProps {
  /** Dollar amount, e.g. 24.5 */
  amount: number;
  /** Optional earned delta, rendered "+$X.XX" in gold with a bounce-in */
  delta?: number;
  /** Base font size in px (default 42) */
  size?: number;
  style?: React.CSSProperties;
}
export declare function Money(props: MoneyProps): JSX.Element;
```

### Implementation

```jsx
import React from "react";

export function Money({ amount, delta, size = 42, style }) {
  const [dollars, cents] = Number(amount).toFixed(2).split(".");
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35em", fontFamily: "var(--font-display)", fontWeight: 800, lineHeight: 1, color: "var(--text-heading)", fontSize: size, ...style }}>
      <span>${dollars}<span style={{ fontSize: "60%" }}>.{cents}</span></span>
      {delta != null && (
        <span style={{ color: "var(--color-reward)", fontSize: "55%", animation: "stash-bounce 600ms cubic-bezier(.34,1.56,.64,1)" }}>
          +${Number(delta).toFixed(2)}
          <style>{"@keyframes stash-bounce{0%{transform:translateY(8px) scale(.6);opacity:0}60%{transform:translateY(-3px) scale(1.08);opacity:1}100%{transform:none;opacity:1}}"}</style>
        </span>
      )}
    </span>
  );
}
```
