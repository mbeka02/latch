// Shared vector source for the launch animation and generated launcher assets.
export const Brand = {
  background: '#111111',
  foreground: '#FFFFFF',
  red: '#ED1C20',
  orange: '#F38820',
  launchDuration: 700,
} as const;

// A rounded L and IFSS-inspired diagonal capsules; deliberately legible at icon size.
export const brandMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="warm" x1="324" y1="273" x2="366" y2="231" gradientUnits="userSpaceOnUse"><stop stop-color="#F38820"/><stop offset="1" stop-color="#ED1C20"/></linearGradient></defs>
  <path d="M145 122V354Q145 380 171 380H316" fill="none" stroke="#FFFFFF" stroke-width="68" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M292 135L334 93" fill="none" stroke="#ED1C20" stroke-width="58" stroke-linecap="round"/>
  <circle cx="400" cy="167" r="27" fill="#ED1C20"/>
  <path d="M324 273L366 231" fill="none" stroke="url(#warm)" stroke-width="58" stroke-linecap="round"/>
  <circle cx="398" cy="325" r="19" fill="#ED1C20"/>
</svg>`;
