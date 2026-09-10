/* ==========================================================================
   SĀLFA — line art.

   Hand-drawn SVG, stroked in `currentColor` so it inherits whatever colour
   the surrounding text uses. No image files, no requests, scales to any size.
   Edit the paths here to redraw; nothing else imports geometry.
   ========================================================================== */

/** A dallah — the Arabic coffee pot. Used on the empty state. */
export function dallahArt({ size = 132, className = "", stroke = 2.2 } = {}) {
  return `
<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 120 130" fill="none"
     stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true" focusable="false">
  <!-- body: belly, waist, shoulder -->
  <path d="M46 48 C43 54 42 58 42 64 C42 72 32 76 32 90 C32 104 37 113 45 116
           L75 116 C83 113 88 104 88 90 C88 76 78 72 78 64 C78 58 77 54 74 48 Z"/>
  <!-- foot -->
  <path d="M45 116 L75 116" stroke-width="3"/>
  <!-- collar -->
  <path d="M48 48 L48 43 L72 43 L72 48"/>
  <!-- lid: a concave cone with a finial, closer to a minaret than a triangle -->
  <path d="M51 43 C54 33 57 26 60 19 C63 26 66 33 69 43"/>
  <circle cx="60" cy="15.5" r="3"/>
  <!-- the signature: a slim crescent spout rising from the left shoulder -->
  <path d="M44 52 C33 48 20 40 14 22 C19 40 30 52 44 60 Z"/>
  <!-- handle, arcing clear of the body instead of cutting through it -->
  <path d="M72 46 C102 52 110 78 88 94"/>
</svg>`;
}

/** An iced coffee — because not every cup is hot. */
export function icedCoffeeArt({ size = 52, className = "", stroke = 2.2 } = {}) {
  return `
<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 60 60" fill="none"
     stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true" focusable="false">
  <!-- straw -->
  <path d="M38 6 L32 20" stroke-width="2"/>
  <!-- glass -->
  <path d="M18 19 L21.5 53 C22 55.5 38 55.5 38.5 53 L42 19"/>
  <ellipse cx="30" cy="19" rx="12" ry="3.6"/>
  <!-- coffee level -->
  <path d="M20 29 C24 31 36 31 40 29" stroke-width="1.8" opacity=".6"/>
  <!-- ice -->
  <rect x="23" y="33" width="9" height="9" rx="1.5" transform="rotate(-12 27.5 37.5)" stroke-width="1.8"/>
  <rect x="30" y="41" width="8" height="8" rx="1.5" transform="rotate(14 34 45)" stroke-width="1.8"/>
</svg>`;
}

/** A finjan — the small handleless cup. Used as a brand mark and beside the dallah. */
export function finjanArt({ size = 52, className = "", steam = true, stroke = 2.2 } = {}) {
  return `
<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 60 60" fill="none"
     stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true" focusable="false">
  ${steam ? `<path d="M24 15 C20 10 28 8 24 3" stroke-width="1.8" opacity=".5"/>
             <path d="M35 15 C31 10 39 8 35 3" stroke-width="1.8" opacity=".5"/>` : ""}
  <!-- cup -->
  <path d="M15 24 C15 40 22 47 30 47 C38 47 45 40 45 24 Z"/>
  <path d="M13 24 L47 24"/>
  <!-- saucer -->
  <path d="M10 52 C16 55 44 55 50 52" stroke-width="2"/>
</svg>`;
}
