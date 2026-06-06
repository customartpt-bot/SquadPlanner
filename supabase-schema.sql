import { createClient } from '@supabase/supabase-js';
import { Player, ShadowTeam } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Helper to ensure all IDs comply with the standard UUID format
export const ensureUUID = (id: string): string => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  
  // Try to parse visual number (e.g., 'p12' -> 12, 'p4' -> 4)
  const numMatches = id.match(/\d+/);
  if (numMatches) {
    const numStr = numMatches[0];
    const padded = numStr.padStart(12, '0');
    // If it is a team indicator, use different UUID prefix pattern
    if (id.startsWith('t') || id.includes('team')) {
      return `11111111-1111-1111-1111-${padded.slice(-12)}`;
    }
    return `00000000-0000-0000-0000-${padded.slice(-12)}`;
  }
  
  // Fallback to safe hash-string converter
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const absoluteHash = Math.abs(hash).toString().padStart(12, '0');
  return `22222222-2222-2222-2222-${absoluteHash.slice(-12)}`;
};

// Helper to convert React Player type to DB/snake_case format
const mapPlayerToDB = (player: Player) => {
  return {
    id: ensureUUID(player.id),
    name: player.name,
    number: player.number,
    position_group: player.positionGroup,
    position: player.position || 'MC',
    preferred_foot: player.preferredFoot,
    status: player.status,
    rating: player.rating,
    notes: player.notes || '',
    birth_date: player.birthDate || null,
  };
};

// Helper to convert DB format to React Player type
const mapDBToPlayer = (dbPlayer: any): Player => {
  return {
    id: dbPlayer.id,
    name: dbPlayer.name,
    number: Number(dbPlayer.number),
    positionGroup: dbPlayer.position_group as any,
    position: dbPlayer.position,
    preferredFoot: dbPlayer.preferred_foot as any,
    status: dbPlayer.status as any,
    rating: Number(dbPlayer.rating),
    notes: dbPlayer.notes || '',
    birthDate: dbPlayer.birth_date || undefined,
  };
};

// Helper to convert React ShadowTeam type to DB/snake_case format
const mapTeamToDB = (team: ShadowTeam) => {
  const mappedPlacements: Record<string, string> = {};
  if (team.placements) {
    Object.entries(team.placements).forEach(([posId, plId]) => {
      if (plId) {
        mappedPlacements[posId] = ensureUUID(plId);
      }
    });
  }

  return {
    id: ensureUUID(team.id),
    name: team.name,
    system_id: team.systemId,
    placements: mappedPlacements,
    notes: team.notes || '',
  };
};

// Helper to convert DB format to React ShadowTeam type
const mapDBToTeam = (dbTeam: any): ShadowTeam => {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    systemId: dbTeam.system_id,
    placements: dbTeam.placements || {},
    notes: dbTeam.notes || '',
  };
};

export const dbService = {
  // --- Players standard endpoints ---
  async getPlayers(): Promise<Player[]> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
    return (data || []).map(mapDBToPlayer);
  },

  async upsertPlayer(player: Player): Promise<Player> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const dbData = mapPlayerToDB(player);
    const { data, error } = await supabase
      .from('players')
      .upsert(dbData)
      .select();

    if (error) {
      console.error('Error upserting player:', error);
      throw error;
    }
    return mapDBToPlayer(data[0]);
  },

  async deletePlayer(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting player:', error);
      throw error;
    }
  },

  async clearAllPlayers(): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('players')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

    if (error) {
      console.error('Error clearing all players:', error);
      throw error;
    }
  },

  // --- Shadow Teams (Tactical scenarios) endpoints ---
  async getShadowTeams(): Promise<ShadowTeam[]> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase
      .from('shadow_teams')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching shadow teams:', error);
      throw error;
    }
    return (data || []).map(mapDBToTeam);
  },

  async upsertShadowTeam(team: ShadowTeam): Promise<ShadowTeam> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const dbData = mapTeamToDB(team);
    const { data, error } = await supabase
      .from('shadow_teams')
      .upsert(dbData)
      .select();

    if (error) {
      console.error('Error upserting shadow team:', error);
      throw error;
    }
    return mapDBToTeam(data[0]);
  },

  async deleteShadowTeam(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('shadow_teams')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shadow team:', error);
      throw error;
    }
  }
};
