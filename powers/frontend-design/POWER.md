---
name: "frontend-design"
displayName: "Frontend Design Excellence"
description: "Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished code that avoids generic AI aesthetics."
keywords: ["frontend", "design", "ui", "components", "web", "react", "css", "aesthetics"]
author: "AMS Team"
---

# Frontend Design Excellence

## Overview

This power guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. When building web components, pages, or applications, implement real working code with exceptional attention to aesthetic details and creative choices.

Use this power when the user asks to build web components, pages, or applications that need to stand out visually.

## Design Thinking Process

Before writing any code, understand the context and commit to a BOLD aesthetic direction:

### 1. Purpose Analysis
- What problem does this interface solve?
- Who uses it?
- What's the emotional response we want?

### 2. Tone Selection
Pick an extreme aesthetic direction. Choose ONE and commit fully:

| Direction | Characteristics |
|-----------|-----------------|
| Brutally Minimal | Stark, essential, maximum whitespace, single accent |
| Maximalist Chaos | Layered, dense, controlled visual overload |
| Retro-Futuristic | Nostalgic tech meets tomorrow, CRT vibes, neon |
| Organic/Natural | Flowing shapes, earth tones, botanical elements |
| Luxury/Refined | Premium materials, subtle animations, gold accents |
| Playful/Toy-like | Rounded, bouncy, saturated, delightful |
| Editorial/Magazine | Grid-based, typographic hierarchy, dramatic imagery |
| Brutalist/Raw | Exposed structure, monospace, harsh contrasts |
| Art Deco/Geometric | Symmetry, gold lines, ornate patterns |
| Soft/Pastel | Gentle gradients, rounded corners, calming |
| Industrial/Utilitarian | Functional, exposed, mechanical precision |

### 3. Constraints Check
- Framework requirements (React, Vue, vanilla)
- Performance budgets
- Accessibility requirements (WCAG compliance)
- Browser support needs

### 4. Differentiation Question
**Ask yourself: What's the ONE thing someone will remember about this interface?**

## Typography Guidelines

### Font Selection Rules

**NEVER USE:**
- Inter
- Roboto  
- Arial
- System fonts
- Any "safe" default

**INSTEAD, CHOOSE:**
- Distinctive display fonts for headlines
- Characterful body fonts that complement
- Unexpected pairings that create tension or harmony

### Pairing Strategy
```css
/* Example: Editorial aesthetic */
--font-display: 'Playfair Display', serif;
--font-body: 'Source Serif Pro', serif;

/* Example: Tech-forward aesthetic */
--font-display: 'Space Mono', monospace;
--font-body: 'IBM Plex Sans', sans-serif;

/* Example: Luxury aesthetic */
--font-display: 'Cormorant Garamond', serif;
--font-body: 'Montserrat', sans-serif;
```

### Typography Scale
Use intentional, dramatic scale differences:
```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.25rem;
--text-xl: 1.5rem;
--text-2xl: 2rem;
--text-3xl: 3rem;
--text-4xl: 4.5rem;
--text-hero: 6rem;  /* Don't be afraid of BIG */
```

## Color & Theme System

### Commit to a Palette
Dominant colors with sharp accents outperform timid, evenly-distributed palettes.

**Pattern: 60-30-10 Rule**
- 60% dominant (background, large areas)
- 30% secondary (cards, sections)
- 10% accent (CTAs, highlights)

### CSS Variables Structure
```css
:root {
  /* Core palette */
  --color-primary: #1a1a2e;
  --color-secondary: #16213e;
  --color-accent: #e94560;
  --color-accent-subtle: #e9456020;
  
  /* Surfaces */
  --surface-base: #0f0f1a;
  --surface-elevated: #1a1a2e;
  --surface-overlay: rgba(26, 26, 46, 0.95);
  
  /* Text */
  --text-primary: #eaeaea;
  --text-secondary: #a0a0a0;
  --text-accent: #e94560;
  
  /* Effects */
  --glow-accent: 0 0 20px rgba(233, 69, 96, 0.4);
  --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### Theme Variation
**CRITICAL:** Vary between light and dark themes across generations. Never default to the same scheme.

## Motion & Animation

### Priority: High-Impact Moments
One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.

### Staggered Entry Pattern
```css
.stagger-item {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.6s ease forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0.1s; }
.stagger-item:nth-child(2) { animation-delay: 0.2s; }
.stagger-item:nth-child(3) { animation-delay: 0.3s; }
.stagger-item:nth-child(4) { animation-delay: 0.4s; }

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Hover States That Surprise
```css
.card {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card:hover {
  transform: translateY(-8px) rotate(1deg);
}

/* Magnetic effect */
.button {
  transition: transform 0.2s ease;
}

.button:hover {
  transform: scale(1.05);
  box-shadow: var(--glow-accent);
}
```

### React with Motion Library
```tsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
  }
};
```

## Spatial Composition

### Break the Grid
- Asymmetric layouts
- Overlapping elements
- Diagonal flow
- Grid-breaking hero sections
- Generous negative space OR controlled density

### Layout Patterns
```css
/* Asymmetric grid */
.layout-asymmetric {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
}

/* Overlap technique */
.overlap-container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
}

.overlap-image {
  grid-column: 1 / 8;
  grid-row: 1;
}

.overlap-content {
  grid-column: 6 / 13;
  grid-row: 1;
  z-index: 1;
  margin-top: 4rem;
}

/* Diagonal section */
.diagonal-section {
  clip-path: polygon(0 5%, 100% 0, 100% 95%, 0 100%);
  padding: 8rem 2rem;
}
```

## Backgrounds & Visual Details

### Create Atmosphere
Never default to solid colors. Add depth and texture.

### Gradient Meshes
```css
.mesh-gradient {
  background: 
    radial-gradient(at 40% 20%, hsla(280, 100%, 70%, 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsla(189, 100%, 56%, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsla(355, 85%, 63%, 0.2) 0px, transparent 50%),
    var(--surface-base);
}
```

### Noise Texture Overlay
```css
.noise-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}
```

### Geometric Patterns
```css
.geometric-bg {
  background-image: 
    linear-gradient(30deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent)),
    linear-gradient(150deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent)),
    linear-gradient(30deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent));
  background-size: 80px 140px;
  background-position: 0 0, 0 0, 40px 70px;
}
```

### Glass Morphism
```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

## Anti-Patterns to Avoid

### NEVER Generate:
- Purple gradients on white backgrounds (overused)
- Card grids with identical rounded corners
- Generic hero sections with stock imagery
- Predictable button styles
- Cookie-cutter component patterns
- Same fonts across different projects (especially Space Grotesk)

### Signs of "AI Slop":
- Everything looks "clean" but nothing is memorable
- Safe color choices that offend no one
- Perfectly balanced layouts with no tension
- Animations that exist but don't delight
- Typography that's readable but characterless

## Implementation Complexity Matching

**CRITICAL:** Match code complexity to aesthetic vision.

### Maximalist Design = Elaborate Code
- Extensive animations
- Multiple layered effects
- Complex state management for interactions
- Rich micro-interactions throughout

### Minimalist Design = Precise Restraint
- Fewer but perfect animations
- Obsessive attention to spacing
- Typography as the hero
- Subtle, refined details that reward attention

## Quick Reference: Design Checklist

Before submitting any frontend code, verify:

- [ ] **Font choice is distinctive** (not Inter, Roboto, Arial)
- [ ] **Color palette has clear hierarchy** (60-30-10)
- [ ] **At least one "wow" moment** exists (animation, layout, interaction)
- [ ] **Background has depth** (gradient, texture, pattern)
- [ ] **Typography scale is dramatic** where appropriate
- [ ] **Hover states surprise** rather than just indicate
- [ ] **Layout breaks expectations** somewhere
- [ ] **Theme is cohesive** throughout
- [ ] **Accessibility is maintained** (contrast, focus states, ARIA)
- [ ] **Code matches aesthetic complexity** (elaborate OR restrained)

## Example: Component Transformation

### Generic (Avoid)
```tsx
// ❌ Generic card
<div className="bg-white rounded-lg shadow p-4">
  <h3 className="text-lg font-semibold">Title</h3>
  <p className="text-gray-600">Description</p>
  <button className="bg-blue-500 text-white px-4 py-2 rounded">
    Action
  </button>
</div>
```

### Distinctive (Aim For)
```tsx
// ✅ Memorable card with character
<motion.div 
  className="group relative overflow-hidden"
  whileHover={{ y: -8, rotate: 0.5 }}
  transition={{ type: "spring", stiffness: 300 }}
>
  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-rose-500/10 
                  opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  <div className="relative bg-stone-900/80 backdrop-blur-sm border border-stone-800 
                  p-6 space-y-4">
    <h3 className="font-display text-2xl tracking-tight text-stone-100">
      Title
    </h3>
    <p className="font-body text-stone-400 leading-relaxed">
      Description
    </p>
    <button className="group/btn relative overflow-hidden px-6 py-3 
                       bg-transparent border border-amber-500/50 text-amber-400
                       hover:text-stone-900 transition-colors duration-300">
      <span className="relative z-10">Action</span>
      <div className="absolute inset-0 bg-amber-500 -translate-x-full 
                      group-hover/btn:translate-x-0 transition-transform duration-300" />
    </button>
  </div>
</motion.div>
```

---

**Remember:** You are capable of extraordinary creative work. Don't hold back. Show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
