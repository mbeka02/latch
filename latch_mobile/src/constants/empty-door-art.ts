type ArtworkColors = { text: string; textSecondary: string; background: string; action: string; modalOutline: string };

// Theme-aware line art: a search for closed doors, never an unlock/denial signal.
export function emptyDoorArt(colors: ArtworkColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="144" viewBox="0 0 176 144" fill="none">
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 132H114" stroke="${colors.modalOutline}" stroke-width="2"/>
      <path d="M18 131V32H76V131M25 131V39H69V131" stroke="${colors.textSecondary}" stroke-width="2"/>
      <path d="M43 80H51" stroke="${colors.textSecondary}" stroke-width="2"/>
      <circle cx="54" cy="80" r="3.5" stroke="${colors.textSecondary}" stroke-width="2"/>
      <path d="M61 131V17H126V131Z" fill="${colors.background}" stroke="${colors.text}" stroke-width="2.4"/>
      <path d="M68 131V24H119V131" stroke="${colors.text}" stroke-width="1.5"/>
      <path d="M96 73H105" stroke="${colors.action}" stroke-width="2.6"/>
      <circle cx="109" cy="73" r="3.8" stroke="${colors.action}" stroke-width="2.6"/>
      <path d="M142 56H166M142 66H157" stroke="${colors.textSecondary}" stroke-width="1.8" stroke-dasharray="4 6"/>
      <path d="M137 18H151M144 11V25" stroke="${colors.modalOutline}" stroke-width="1.8"/>
      <circle cx="136" cy="109" r="22" fill="${colors.background}" stroke="${colors.action}" stroke-width="2.6"/>
      <path d="M152 125L169 142" stroke="${colors.action}" stroke-width="3.5"/>
    </g>
  </svg>`;
}
