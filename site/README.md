# JarvisERP Explainer Website

Polished, animated explainer website for JarvisERP, built for Cal Hacks 2026 Hyphenate Track judging.

## Overview

This is a scroll-driven animated explainer that walks judges and laypeople through how JarvisERP works, using the same aesthetic as the JarvisERP Workbench (cream background, burgundy panels, orange accents).

## Features

- **10 content sections** with layered scroll animations
- **The Moment**: The PayPal split explained step-by-step with animations
- **Interactive elements**: Challenge/defense, tamper simulation, searchable glossary
- **Present Mode**: Fullscreen slide navigation with arrow keys/spacebar for pitch deck use
- **Responsive design** with prefers-reduced-motion support
- **Glossary**: 30+ accounting terms with flip-card animations

## Quick Start

### Development Mode (live reload)

```bash
cd site
npm install
npm run dev
```

Opens at http://localhost:3000

### Build for Production

```bash
cd site
npm install
npm run build
```

### Serve Built Site

```bash
cd site
npm run serve
```

Or with `npx serve`:

```bash
npx serve site/dist
```

## Architecture

- **HTML**: Single-page site with 10 sections
- **CSS**: Custom styles matching JarvisERP workbench aesthetic (variables from `ui/wb.css`)
- **JS**: GSAP ScrollTrigger for animations, vanilla JS for interactivity
- **Build**: Vite for fast dev server and optimized production build

## Sections

1. **Hero**: Title, tagline, CTA buttons
2. **The Moment**: Bank line → split → challenge → defense (animated)
3. **Company**: Afterglow Labs intro, seats filled
4. **Three Systems**: Mismatched shapes, discrepancy, solution
5. **Five Problems**: Layered problem/manual/jarvis/settled cards
6. **What Makes It Hard**: 5 forces (sources disagree, time, team, limits, accountability)
7. **Architecture**: Data flow diagram with animated packet
8. **Double-Entry**: Balance scale with real entry
9. **Trust & Limits**: Roles, audit chain, tamper simulation
10. **Proof**: Scores, real vs simulated
11. **Glossary**: Searchable, 30+ terms with flip cards

## Present Mode

Press "Present Mode" button or use these keyboard shortcuts when in present mode:
- **Arrow keys / Spacebar**: Next/previous slide
- **ESC**: Exit present mode

Perfect for live judging demos or pitch presentations.

## Colors & Fonts

Matches `ui/wb.css` exactly:
- Background: `#f9f7f2` (cream)
- Panels: `#fdfcfa` (card)
- Primary: `#7a1414` (maroon)
- Accent: `#fa6610` (orange)
- Fonts: DM Sans (sans), DM Mono (mono)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- GSAP 3.12+ for scroll animations

## Link to Live Product

The site includes buttons linking to `http://localhost:8000` (the actual JarvisERP Workbench). Make sure the main app is running when demoing.

## Performance

- 60fps animations with GSAP
- Lazy-loaded sections via ScrollTrigger
- Respects `prefers-reduced-motion`
- No console errors
- Accessible contrast ratios

## Development Notes

- All animations use GSAP ScrollTrigger for consistency
- Glossary terms are defined in `main.js` for easy updates
- Present mode clones section content for fullscreen display
- Tamper test demonstrates hash chain integrity

## Credits

Built for Cal Hacks 2026 · Hyphenate Track
Based on JarvisERP by the GeneticAlgorithms team
