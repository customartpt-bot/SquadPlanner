export interface Player {
  id: string;
  name: string;
  number: number;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'ATT'; // GK = Guarda-Redes, DEF = Defesa, MID = Médio, ATT = Avançado
  position?: string; // specific football position, e.g. "PL", "DE", "DC", etc.
  altPosition1?: string; // First alternative position (optional)
  altPosition2?: string; // Second alternative position (optional)
  preferredFoot: 'Direito' | 'Esquerdo' | 'Ambos';
  status: 'Titular' | 'Suplente' | 'Reservado' | 'Lesionado' | 'Negociação';
  rating: number; // 1 to 5 stars
  notes: string;
  birthDate?: string; // YYYY-MM-DD format
  isReferenced?: boolean; // Flag to separate referenced/watchlist players from main squad
  club?: string; // Current club
  photoUrl?: string; // Profile photo url or base64 data url
  priority?: number; // Priority rank for referenced players (1-10)
}

export interface TacticalPosition {
  id: string; // unique ID like "GK", "CB1", "LB", "ST"
  role: string; // localized label, e.g. "Guarda-Redes", "Defesa Esquerdo", "Ponta de Lança"
  shortRole: string; // e.g., "GR", "DE", "PL"
  // coordinate percentages on field (0 to 100)
  x: number; // horizontal from left (0) to right (100)
  y: number; // vertical from top (0 - goal) to bottom (100 - goal) or vice-versa. We'll set y=0-100 from top (Opponent goal) to bottom (My goal) or vice versa.
}

export interface Formation {
  id: string; // e.g. "4-3-3"
  name: string; // display name
  positions: TacticalPosition[];
}

export interface ShadowTeam {
  id: string;
  name: string; // e.g., "Equipa Principal - A", "Equipa B - Jovem", "Equipa Alvo (Mercado)"
  systemId: string; // e.g. "4-3-3"
  // maps TacticalPosition.id -> Player.id
  placements: Record<string, string>;
  notes: string;
  isReferencedScenario?: boolean;
}
