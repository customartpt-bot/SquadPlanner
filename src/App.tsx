/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, TacticalPosition, Formation, ShadowTeam } from './types';
import { FORMATIONS } from './constants';
import SquadDepthChart from './components/SquadDepthChart';
import { createClient } from '@supabase/supabase-js';

// Helper to generate a valid/genuine UUID v4 string directly on client-side
export const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// --- Supabase Client & Database Service Integration (Self-Contained) ---
// Configuração do cliente Supabase usando variáveis de ambiente cliente (VITE_)
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

export const FOOTBALL_POSITIONS = [
  { code: 'GR', label: 'Guarda-Redes (GR)', group: 'GK' },
  { code: 'DC', label: 'Defesa Central (DC)', group: 'DEF' },
  { code: 'DE', label: 'Lateral Esquerdo (DE)', group: 'DEF' },
  { code: 'DD', label: 'Lateral Direito (DD)', group: 'DEF' },
  { code: 'MDF', label: 'Médio Defensivo (MDF)', group: 'MID' },
  { code: 'MC', label: 'Médio Centro (MC)', group: 'MID' },
  { code: 'MCO', label: 'Médio Ofensivo (MCO)', group: 'MID' },
  { code: 'ME', label: 'Médio Esquerdo (ME)', group: 'MID' },
  { code: 'MD', label: 'Médio Direito (MD)', group: 'MID' },
  { code: 'EE', label: 'Extremo Esquerdo (EE)', group: 'ATT' },
  { code: 'ED', label: 'Extremo Direito (ED)', group: 'ATT' },
  { code: 'PL', label: 'Ponta de Lança (PL)', group: 'ATT' },
];

export const getBirthDateDisplay = (dateString?: string) => {
  if (!dateString) return 'N/D';
  const parts = dateString.split('-');
  if (parts.length < 3) return dateString;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  let suffix = '';
  if (year === '2009') suffix = ' (1º ano)';
  else if (year === '2008') suffix = ' (2º ano)';
  
  return `${day}/${month}/${year}${suffix}`;
};
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Undo,
  UserPlus,
  Search,
  Check,
  User,
  Activity,
  Footprints,
  Star,
  Info,
  X,
  FileText,
  Smartphone,
  ChevronDown,
  CornerDownRight,
  Sparkles,
  Award,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  Calendar
} from 'lucide-react';

const DEFAULT_TEAMS: ShadowTeam[] = [
  {
    id: 't1',
    name: 'Equipa Favorita (A)',
    systemId: '4-3-3',
    placements: {
      'GR': 'p1', // Diogo Costa
      'DE': 'p6', // Nuno Mendes
      'CE': 'p4', // Gonçalo Inácio
      'CD': 'p3', // António Silva
      'DD': 'p7', // João Cancelo
      'MDF': 'p9', // João Neves
      'MC_E': 'p13', // Daniel Bragança
      'MC_D': 'p10', // Vitinha Ferreira
      'EE': 'p14', // Rafael Leão
      'PL': 'p17', // Gonçalo Ramos
      'ED': 'p16', // Francisco Conceição
    },
    notes: 'Bloco tático para pressão alta agressiva. Saída curta pelos centrais e diagonais velozes dos extremos.'
  },
  {
    id: 't2',
    name: 'Bloco Baixo / Transição (B)',
    systemId: '4-4-2',
    placements: {
      'GR': 'p2', // Ricardo Velho
      'DE': 'p6', // Nuno Mendes
      'CE': 'p5', // Diogo Leite
      'CD': 'p3', // António Silva
      'DD': 'p8', // Diogo Dalot
      'MD_E': 'p14', // Rafael Leão
      'MC_E': 'p9', // João Neves
      'MC_D': 'p11', // Otávio
      'MD_D': 'p18', // Trincão
      'PL_E': 'p15', // Diogo Jota
      'PL_D': 'p17', // Gonçalo Ramos
    },
    notes: 'Sistema para segurança defensiva. Linhas próximas e transições de contra-ataque direcionadas para as alas.'
  }
];

export default function App() {
  // --- Persistent States ---
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('MISTER_TACTIC_PLAYERS');
    return saved ? JSON.parse(saved) : [];
  });

  const [shadowTeams, setShadowTeams] = useState<ShadowTeam[]>(() => {
    const saved = localStorage.getItem('MISTER_TACTIC_TEAMS');
    return saved ? JSON.parse(saved) : DEFAULT_TEAMS;
  });

  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    const saved = localStorage.getItem('MISTER_TACTIC_ACTIVE_TEAM');
    if (saved) return saved;
    return DEFAULT_TEAMS[0]?.id || 't1';
  });

  // --- UI Action States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'>('ALL');
  
  // Selection states for manual positioning & editor
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null); // If clicking pitch spot to assign manually
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // --- Forms State ---
  // Athlete Form
  const [formName, setFormName] = useState('');
  const [formNumber, setFormNumber] = useState<number>(10);
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formPosition, setFormPosition] = useState('MC');
  const [formFoot, setFormFoot] = useState<'Direito' | 'Esquerdo' | 'Ambos'>('Direito');
  const [formRating, setFormRating] = useState<number>(3);
  const [formNotes, setFormNotes] = useState('');

  // Filtering variables
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');

  // Custom UI alert / confirmation states
  const [playerToDeleteId, setPlayerToDeleteId] = useState<string | null>(null);
  const [confirmClearPitch, setConfirmClearPitch] = useState(false);
  const [confirmClearSquad, setConfirmClearSquad] = useState(false);
  const [squadBackup, setSquadBackup] = useState<{ players: Player[], shadowTeams: ShadowTeam[] } | null>(null);
  const [teamScenarioToDeleteId, setTeamScenarioToDeleteId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Active Team Scenario form
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [tempTeamName, setTempTeamName] = useState('');

  // Supabase states
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState<string | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    if (isSupabaseConfigured) {
      const loadInitialData = async () => {
        setIsDbLoading(true);
        setDbConnectionError(null);
        try {
          const dbPlayers = await dbService.getPlayers();
          const dbTeams = await dbService.getShadowTeams();
          
          let finalPlayers = dbPlayers;
          let finalTeams = dbTeams;

          if (dbPlayers) {
            setPlayers(dbPlayers);
          }

          if (dbTeams && dbTeams.length > 0) {
            setShadowTeams(dbTeams);
            const savedActiveId = localStorage.getItem('MISTER_TACTIC_ACTIVE_TEAM');
            if (savedActiveId && dbTeams.some(t => t.id === savedActiveId)) {
              setActiveTeamId(savedActiveId);
            } else {
              setActiveTeamId(dbTeams[0].id);
            }
          } else {
            // Pre-populate database with default scenario structures
            try {
              for (const team of DEFAULT_TEAMS) {
                await dbService.upsertShadowTeam(team);
              }
              finalTeams = await dbService.getShadowTeams();
              setShadowTeams(finalTeams);
              if (finalTeams.length > 0) {
                setActiveTeamId(finalTeams[0].id);
              }
            } catch (err) {
              console.error("Failed to seed default teams to Supabase:", err);
            }
          }
        } catch (error: any) {
          console.error("Failed to fetch initial Supabase data:", error);
          setDbConnectionError(error?.message || "Erro ao carregar dados do Supabase");
        } finally {
          setIsDbLoading(false);
        }
      };
      loadInitialData();
    }
  }, []);

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('MISTER_TACTIC_PLAYERS', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('MISTER_TACTIC_TEAMS', JSON.stringify(shadowTeams));
  }, [shadowTeams]);

  useEffect(() => {
    localStorage.setItem('MISTER_TACTIC_ACTIVE_TEAM', activeTeamId);
  }, [activeTeamId]);

  // Find active Shadow Team Scenario
  const currentTeam = shadowTeams.find((team) => team.id === activeTeamId) || shadowTeams[0] || DEFAULT_TEAMS[0];
  const activeFormation = FORMATIONS.find((f) => f.id === currentTeam.systemId) || FORMATIONS[0];

  // Sync temp team name when active team changes
  useEffect(() => {
    if (currentTeam) {
      setTempTeamName(currentTeam.name);
    }
  }, [currentTeam?.id]);

  // Handle Team Name Change
  const saveTeamName = () => {
    if (!tempTeamName.trim()) return;
    const updatedTeam = { ...currentTeam, name: tempTeamName };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));
    setEditingTeamName(false);

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error saving team name in Supabase:", err);
        setAlertMessage(`Falha ao atualizar o nome do cenário no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }
  };

  // Switch systems (4-3-3 to 4-4-2 etc.), keeps/clears incompatible slots
  const handleSystemChange = (systemId: string) => {
    const nextPlacements: Record<string, string> = {};
    const targetSystem = FORMATIONS.find(f => f.id === systemId);
    if (targetSystem) {
      targetSystem.positions.forEach(pos => {
        if (currentTeam.placements[pos.id]) {
          nextPlacements[pos.id] = currentTeam.placements[pos.id];
        }
      });
    }
    const updatedTeam = { ...currentTeam, systemId, placements: nextPlacements };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error saving system change in Supabase:", err);
        setAlertMessage(`Falha ao alterar o sistema tático no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }
  };

  // Add athlete to club pool
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const mappedGroup = FOOTBALL_POSITIONS.find(p => p.code === formPosition)?.group || 'MID';
    const newPlayerId = generateUUID();

    const newPlayer: Player = {
      id: newPlayerId,
      name: formName,
      number: formNumber || 1,
      positionGroup: mappedGroup as any,
      position: formPosition,
      preferredFoot: formFoot,
      status: 'Suplente', // Default status as UI fields for status are removed
      rating: formRating,
      notes: formNotes,
      birthDate: formBirthDate || undefined,
    };

    // Adiciona localmente de imediato
    setPlayers(prev => [newPlayer, ...prev]);
    
    if (isSupabaseConfigured) {
      dbService.upsertPlayer(newPlayer)
        .then((savedPlayer) => {
          // Garante a substituição pelo objeto persistido oficial do Supabase
          setPlayers(prev => prev.map(p => p.id === newPlayerId ? savedPlayer : p));
        })
        .catch(err => {
          console.error("Error upserting player to Supabase:", err);
          // Revoga o atleta temporário caso falhe de verdade, preservando a coerência com a BD
          setPlayers(prev => prev.filter(p => p.id !== newPlayerId));
          // Expõe o erro de SQL/Políticas RLS visualmente na UI para o Mister
          setAlertMessage(`Falha ao gravar atleta na Base de Dados (Supabase). Detalhes técnicos: ${err?.message || JSON.stringify(err)}`);
        });
    }
    
    // Reset form
    setFormName('');
    setFormNumber(10);
    setFormBirthDate('');
    setFormPosition('MC');
    setFormNotes('');
    setFormRating(3);
    setShowAddForm(false);
  };

  // Update athlete changes
  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
    setActivePlayer(updatedPlayer);
    setIsEditingPlayer(false);
    if (isSupabaseConfigured) {
      dbService.upsertPlayer(updatedPlayer).catch(err => console.error("Error updating player in Supabase:", err));
    }
  };

  // Set athlete deletion confirm
  const handleDeletePlayer = (playerId: string) => {
    setPlayerToDeleteId(playerId);
  };

  // Handle Dragging
  const handleDragStart = (playerId: string) => {
    setDraggedPlayerId(playerId);
  };

  const handleDropOnPosition = (positionId: string) => {
    if (!draggedPlayerId) return;

    // Check if player is already in this position
    if (currentTeam.placements[positionId] === draggedPlayerId) {
      setDraggedPlayerId(null);
      return;
    }

    const nextPlacements = { ...currentTeam.placements };

    // Clear duplicates of this player
    Object.keys(nextPlacements).forEach(k => {
      if (nextPlacements[k] === draggedPlayerId) {
        delete nextPlacements[k];
      }
    });

    nextPlacements[positionId] = draggedPlayerId;
    const updatedTeam = { ...currentTeam, placements: nextPlacements };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error saving drag-and-drop placements:", err);
        setAlertMessage(`Falha ao colocar o atleta em campo no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }

    setDraggedPlayerId(null);
  };

  // Non-drag selection placement helper
  const handleSelectSpotToAssign = (spotId: string) => {
    setSelectedSpotId(spotId);
  };

  const handleManualAssign = (playerId: string) => {
    if (!selectedSpotId) return;

    const nextPlacements = { ...currentTeam.placements };

    // Clear duplicates of this player
    Object.keys(nextPlacements).forEach(k => {
      if (nextPlacements[k] === playerId) {
        delete nextPlacements[k];
      }
    });

    nextPlacements[selectedSpotId] = playerId;
    const updatedTeam = { ...currentTeam, placements: nextPlacements };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error saving manual placements:", err);
        setAlertMessage(`Falha ao atribuir o atleta no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }

    setSelectedSpotId(null);
  };

  // Remove player from active position
  const handleRemoveFromPosition = (positionId: string) => {
    const nextPlacements = { ...currentTeam.placements };
    delete nextPlacements[positionId];
    const updatedTeam = { ...currentTeam, placements: nextPlacements };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error removing player from position in Supabase:", err);
        setAlertMessage(`Falha ao retirar o atleta do relvado no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }
  };

  // Empty entire active pitch
  const handleClearPitch = () => {
    setConfirmClearPitch(true);
  };

  // Create new Shadow Team plan
  const handleCreateNewTeam = () => {
    const newTeamName = `Cenário Tático #${shadowTeams.length + 1}`;
    const newTeamId = generateUUID();
    const newTeam: ShadowTeam = {
      id: newTeamId,
      name: newTeamName,
      systemId: '4-3-3',
      placements: {},
      notes: 'Escreva anotações importantes sobre este cenário tático ou análise fantasma aqui.'
    };

    setShadowTeams(prev => [...prev, newTeam]);
    setActiveTeamId(newTeamId);
    setEditingTeamName(true);
    setTempTeamName(newTeamName);

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(newTeam).catch(err => {
        console.error("Error creating new scenario in Supabase:", err);
        setAlertMessage(`Falha ao criar o cenário tático no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
      });
    }
  };

  // Delete Active Scenario Team
  const handleDeleteActiveTeam = () => {
    if (shadowTeams.length <= 1) {
      setAlertMessage('Precisa de manter pelo menos um cenário no seu planeador.');
      return;
    }
    setTeamScenarioToDeleteId(currentTeam.id);
  };

  // Save Scenario Notes
  const handleSaveTeamNotes = (noteText: string) => {
    const updatedTeam = { ...currentTeam, notes: noteText };
    setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));

    if (isSupabaseConfigured) {
      dbService.upsertShadowTeam(updatedTeam).catch(err => {
        console.error("Error saving team notes in Supabase:", err);
      });
    }
  };

  // Filters available roster
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          player.number.toString().includes(searchQuery);
    
    const matchesGroup = selectedGroupFilter === 'ALL' || player.positionGroup === selectedGroupFilter;

    let matchesYear = true;
    if (selectedYearFilter !== 'ALL') {
      if (!player.birthDate) {
        matchesYear = false;
      } else {
        const year = player.birthDate.substring(0, 4);
        matchesYear = year === selectedYearFilter;
      }
    }

    return matchesSearch && matchesGroup && matchesYear;
  });

  // Get unique birth years from existing squad
  const availableYears = Array.from<string>(
    new Set(
      players
        .map(p => p.birthDate ? p.birthDate.substring(0, 4) : null)
        .filter((y): y is string => !!y)
    )
  ).sort((a, b) => b.localeCompare(a));

  // Check where players currently are placed in the Active team
  const getPlayerPlacement = (playerId: string) => {
    const spot = Object.keys(currentTeam.placements).find(
      (key) => currentTeam.placements[key] === playerId
    );
    if (!spot) return null;
    const pos = activeFormation.positions.find((p) => p.id === spot);
    return pos ? { id: spot, role: pos.shortRole } : { id: spot, role: spot };
  };

  // Find alternatives/substitutes for a specific position spot on the pitch
  const getAlternativesForPosition = (posId: string) => {
    // Current starting player ID on this spot
    const startingPlayerId = currentTeam.placements[posId];
    
    // Identify the core position category code (GR, DE, DD, DC, MDF, MC, MCO, ME, MD, EE, ED, PL)
    let targetPosCode = '';
    const cleanId = posId.toUpperCase();
    if (cleanId === 'GR') targetPosCode = 'GR';
    else if (cleanId === 'DE') targetPosCode = 'DE';
    else if (cleanId === 'DD') targetPosCode = 'DD';
    else if (cleanId === 'CE' || cleanId === 'CD' || cleanId === 'CC') targetPosCode = 'DC';
    else if (cleanId.includes('MDF')) targetPosCode = 'MDF';
    else if (cleanId.includes('MCO') || cleanId === 'MO') targetPosCode = 'MCO';
    else if (cleanId.includes('MCE') || cleanId.includes('MCD') || cleanId.includes('MC_E') || cleanId.includes('MC_D') || cleanId === 'MC') targetPosCode = 'MC';
    else if (cleanId.includes('ME') || cleanId.includes('MD_E')) targetPosCode = 'ME';
    else if (cleanId.includes('MD') || cleanId.includes('MD_D')) targetPosCode = 'MD';
    else if (cleanId.includes('EE')) targetPosCode = 'EE';
    else if (cleanId.includes('ED')) targetPosCode = 'ED';
    else if (cleanId.includes('PL') || cleanId.includes('PLE') || cleanId.includes('PLD')) targetPosCode = 'PL';
    
    // Fallback to general positionGroups if needed:
    let targetGroup: 'GK' | 'DEF' | 'MID' | 'ATT' = 'MID';
    if (cleanId === 'GR') targetGroup = 'GK';
    else if (['DE', 'DD', 'CE', 'CD', 'CC'].some(p => cleanId.includes(p))) targetGroup = 'DEF';
    else if (['MDF', 'MC', 'MCO', 'MO', 'ME', 'MD', 'ALA', 'MCE', 'MCD'].some(p => cleanId.includes(p))) targetGroup = 'MID';
    else if (['PL', 'EE', 'ED'].some(p => cleanId.includes(p))) targetGroup = 'ATT';

    // True alternatives are players who are NOT starting ANYWHERE in the pitch,
    // so they are currently unplaced (substitutes)
    const placedPlayerIds = Object.values(currentTeam.placements);
    const unplacedPlayers = players.filter(p => !placedPlayerIds.includes(p.id));

    // First try to match by exact position
    let matches = unplacedPlayers.filter(p => p.position === targetPosCode);

    // Filter by positionGroup as fallback if no exact matches are available
    if (matches.length === 0) {
      matches = unplacedPlayers.filter(p => p.positionGroup === targetGroup);
    }

    return matches;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col selection:bg-red-600 selection:text-white" id="main-layout-root">
      
      {/* 🔴 RED AND WHITE STRIPED HEADER */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b-4 border-red-600 shadow-sm relative overflow-hidden shrink-0" id="app-header">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: 'repeating-linear-gradient(90deg, #dc2626 0, #dc2626 20px, #ffffff 20px, #ffffff 40px)' }}></div>
        
        <div className="flex items-center gap-3 z-10">
          <div className="relative w-10 h-10 select-none flex items-center justify-center">
            <img
              src="https://raw.githubusercontent.com/customartpt-bot/fcbfotos/main/logo.png"
              alt="SquadPlanner Logo"
              className="w-10 h-10 object-contain shadow-sm"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('logo-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div id="logo-fallback" style={{ display: 'none' }} className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-black shadow-md select-none">SP</div>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">SQUAD<span className="text-red-600 italic">PLANNER</span></h1>

          {/* Database connection badge */}
          {isSupabaseConfigured ? (
            isDbLoading ? (
              <span className="flex items-center gap-1 text-[9px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-extrabold animate-pulse uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                A sincronizar...
              </span>
            ) : dbConnectionError ? (
              <span className="flex items-center gap-1 text-[9px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider font-mono" title={dbConnectionError}>
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                BD: Sem Acesso
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                BD: Ligada (Supabase)
              </span>
            )
          ) : (
            <span className="flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 border border-slate-250 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider font-mono" title="Defina as credenciais VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar gravação na nuvem">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
              Modo Local (Offline)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 z-10">
          {/* Tactical System Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200" id="system-selector">
            <select
              id="formation-select"
              value={currentTeam.systemId}
              onChange={(e) => handleSystemChange(e.target.value)}
              className="px-3 py-1 bg-white shadow-sm rounded-md text-xs font-bold text-slate-800 border-none outline-none focus:ring-1 focus:ring-red-600 cursor-pointer appearance-none"
            >
              {FORMATIONS.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.id} ({form.name})
                </option>
              ))}
            </select>
          </div>

          {/* Plan Scenarios Selector */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 items-center gap-1" id="scenario-selector">
            <select
              id="team-scenario-select"
              value={activeTeamId}
              onChange={(e) => {
                setActiveTeamId(e.target.value);
                setEditingTeamName(false);
              }}
              className="px-3 py-1 bg-white shadow-sm rounded-md text-xs font-bold text-slate-800 border-none outline-none focus:ring-1 focus:ring-red-600 cursor-pointer max-w-[130px] appearance-none"
            >
              {shadowTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleCreateNewTeam}
              title="Criar Novo Cenário"
              className="text-slate-600 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={handleDeleteActiveTeam}
              title="Apagar Cenário Ativo"
              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 🏟️ MAIN CONTENT SECTION */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="app-main-body">
        
        {/* LEFT / CENTER PANEL: THE FOOTBALL TACTICAL FIELD (8 COLS ON DESKTOP) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          
          {/* Quick Scenario Title and Clear Button */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              {editingTeamName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTeamName}
                    onChange={(e) => setTempTeamName(e.target.value)}
                    className="bg-slate-50 text-slate-900 font-bold text-base px-2.5 py-1 rounded border border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 w-full max-w-[280px]"
                    placeholder="Nome do cenário..."
                  />
                  <button
                    onClick={saveTeamName}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded transition-colors cursor-pointer shadow-sm"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTeamName(false);
                      setTempTeamName(currentTeam.name);
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded transition-colors cursor-pointer shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-0.5">
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    {currentTeam.name}
                    <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded ml-1">
                      {activeFormation.id}
                    </span>
                  </h2>
                  <button
                    onClick={() => setEditingTeamName(true)}
                    className="p-1 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Renomear Cenário"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearPitch}
                className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-colors text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Retirar todos os jogadores do campo"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar Campo
              </button>
            </div>
          </div>

          {/* THE TACTICAL PITCH CANVAS */}
          <div className="relative bg-slate-200 rounded-2xl overflow-hidden border border-slate-300 p-8 flex items-center justify-center shadow-xl" id="pitch-container">
            
            {/* Visual Pitch Outer Grass Margin */}
            <div 
              className="relative w-full aspect-[4/5] sm:aspect-[4/5] md:aspect-[3/4.2] bg-classic-pitch rounded-xl border-[6px] border-white overflow-hidden shadow-2xl flex flex-col justify-between"
              onDragOver={(e) => e.preventDefault()}
              id="football-field-canvas"
            >
              
              {/* WHITE FIELD PAINT MARKINGS */}
              <div className="absolute inset-4 border border-white/30 pointer-events-none rounded-sm">
                
                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 sm:w-36 h-28 sm:h-36 rounded-full border border-white/30"></div>
                {/* Center Line */}
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/30"></div>
                {/* Center point */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30"></div>

                {/* Opponent Penalty Box (Top) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 sm:w-60 h-20 sm:h-24 border border-t-0 border-white/30">
                  {/* Goal Area */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 sm:w-28 h-6 sm:h-8 border border-t-0 border-white/30"></div>
                  {/* Penalty Mark */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/30"></div>
                </div>

                {/* Our Penalty Box (Bottom) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 sm:w-60 h-20 sm:h-24 border border-b-0 border-white/30">
                  {/* Goal Area */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 sm:w-28 h-6 sm:h-8 border border-b-0 border-white/30"></div>
                  {/* Penalty Mark */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/30"></div>
                </div>

                {/* Goal Nets */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-4 bg-white/5 border border-white/20 rounded-t-sm"></div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-4 bg-white/5 border border-white/20 rounded-b-sm"></div>

              </div>

              {/* TACTICAL SPOTS ON THE FIELD */}
              <AnimatePresence>
                {activeFormation.positions.map((pos) => {
                  const assignedPlayerId = currentTeam.placements[pos.id];
                  const assignedPlayer = players.find((p) => p.id === assignedPlayerId);
                  
                  return (
                    <div
                      key={pos.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 select-none flex flex-col items-center"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnPosition(pos.id)}
                      id={`spot-${pos.id}`}
                    >
                      {assignedPlayer ? (
                        /* OCCUPIED POSITION SLOT */
                        <motion.div
                          layoutId={`player-card-${assignedPlayer.id}`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="flex flex-col items-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePlayer(assignedPlayer);
                            setIsEditingPlayer(false);
                          }}
                        >
                          <div className="relative">
                            
                            {/* Standardized circular player badges */}
                            <div className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full border-4 flex items-center justify-center font-black shadow-lg relative transition-all duration-300 ${
                              activePlayer?.id === assignedPlayer.id
                                ? 'bg-red-600 border-white text-white ring-4 ring-red-600/20 scale-105'
                                : 'bg-white border-red-600 text-red-600 hover:border-red-500 hover:scale-105'
                            }`}>
                              <span className="text-base sm:text-lg font-black">{assignedPlayer.number}</span>

                              {/* Preferred Foot Indicator */}
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-white text-[8px] font-bold text-white flex items-center justify-center shadow" title={`Pé Preferido: ${assignedPlayer.preferredFoot}`}>
                                {assignedPlayer.preferredFoot === 'Ambos' ? 'A' : assignedPlayer.preferredFoot === 'Esquerdo' ? 'E' : 'D'}
                              </span>

                              {/* Injury Status */}
                              {assignedPlayer.status === 'Lesionado' && (
                                <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-rose-600 border border-white text-[9px] font-bold text-white flex items-center justify-center shadow" title="Lesionado">
                                  🚑
                                </span>
                              )}
                            </div>

                            {/* Small Quick Action: Remove Player */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromPosition(pos.id);
                              }}
                              className="absolute -top-1.5 -left-1.5 bg-red-600 hover:bg-neutral-905 border border-white rounded-full p-0.5 shadow-md text-white hover:scale-110 transition-transform cursor-pointer"
                              title="Retirar do campo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Player name bubble */}
                          <div className="mt-1 text-center max-w-[84px] sm:max-w-[110px]">
                            <div className="bg-white border border-slate-200 text-slate-800 font-extrabold text-[10px] sm:text-xs py-0.5 px-2 rounded-md shadow-md truncate leading-tight uppercase">
                              {assignedPlayer.name.split(' ').pop()}
                            </div>
                            <div className="text-[8px] font-mono tracking-wider font-extrabold text-white/95 drop-shadow-sm uppercase mt-0.5">
                              {pos.shortRole}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        /* EMPTY SLOT PLACEHOLDER DROP ZONE */
                        <div
                          className={`flex flex-col items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-full border-2 border-dashed transition-all duration-305 cursor-pointer ${
                            selectedSpotId === pos.id
                              ? 'border-yellow-405 bg-yellow-600/20 text-yellow-101 scale-110 animate-pulse'
                              : 'border-white/40 hover:border-white/85 bg-white/10 hover:bg-white/20 text-white hover:scale-105 shadow-sm'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSpotToAssign(pos.id);
                          }}
                          title={`Clique ou arraste um atleta para a posição ${pos.role}`}
                        >
                          <span className="text-[10px] sm:text-xs font-mono font-black tracking-wide">
                            {pos.shortRole}
                          </span>
                          <span className="text-[7px] font-sans font-bold uppercase text-white/80 leading-none">
                            Vazio
                          </span>
                        </div>
                      )}

                      {/* Alternatives/substitutes list directly under each position spot on field */}
                      {(() => {
                        const alts = getAlternativesForPosition(pos.id);
                        if (alts.length === 0) return null;
                        return (
                          <div className="mt-1 bg-slate-950/80 backdrop-blur-sm text-white rounded-md p-1 text-[8px] font-extrabold space-y-0.5 w-[75px] sm:w-[90px] shadow-lg border border-white/20 select-none overflow-hidden hover:scale-105 transition-all">
                            <div className="text-[7px] text-amber-400 font-mono scale-95 leading-none mb-0.5 border-b border-white/10 pb-0.5 text-center uppercase tracking-wider">
                              Suplentes
                            </div>
                            {alts.slice(0, 2).map((alt) => (
                              <div
                                key={alt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShadowTeams(prev =>
                                    prev.map(t => {
                                      if (t.id === currentTeam.id) {
                                        const nextPlacements = { ...t.placements };
                                        nextPlacements[pos.id] = alt.id;
                                        return { ...t, placements: nextPlacements };
                                      }
                                      return t;
                                    })
                                  );
                                }}
                                className="truncate leading-normal px-1 py-0.5 rounded bg-white/10 hover:bg-red-600 hover:text-white transition-all text-center cursor-pointer font-bold border border-transparent hover:border-white/20"
                                title={`Clique para colocar ${alt.name} como titular nesta posição`}
                              >
                                {alt.number}. {alt.name.split(' ').pop()}
                              </div>
                            ))}
                            {alts.length > 2 && (
                              <div className="text-[6.5px] text-slate-300 text-center leading-none mt-0.5 font-normal">
                                +{alts.length - 2} suplentes
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>
                  );
                })}
              </AnimatePresence>

              {/* WATERMARK */}
              <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none opacity-30">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white font-extrabold">
                  FC PLANOR • ESTADO TÁTICO
                </span>
              </div>

            </div>

            {/* CLICK FALLBACK DROPDOWN / MANUAL SELECTOR */}
            <AnimatePresence>
              {selectedSpotId && (
                <div 
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-35 flex items-center justify-center p-4"
                  onClick={() => setSelectedSpotId(null)}
                  id="selection-modal-overlay"
                >
                  <div 
                    className="bg-white border border-slate-205 rounded-xl max-w-sm w-full p-5 shadow-2xl relative text-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[9px] font-black uppercase text-red-650 tracking-widest">
                          Selecionar para Posição
                        </span>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 leading-tight">
                          {activeFormation.positions.find(p => p.id === selectedSpotId)?.role} ({activeFormation.positions.find(p => p.id === selectedSpotId)?.shortRole})
                        </h4>
                      </div>
                      <button 
                        onClick={() => setSelectedSpotId(null)}
                        className="text-slate-400 hover:text-slate-805 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5 my-3 pr-1" id="assign-players-list">
                      {players.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">Nenhum jogador cadastrado no clube.</p>
                      ) : (
                        players.map((p) => {
                          const placement = getPlayerPlacement(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleManualAssign(p.id)}
                              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2 rounded-lg flex justify-between items-center text-left transition-colors text-xs shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-red-600 text-white rounded font-mono font-bold flex items-center justify-center text-[10px]">
                                  {p.number}
                                </span>
                                <div>
                                  <p className="font-extrabold text-slate-900">{p.name}</p>
                                  <p className="text-[9px] text-slate-400 uppercase tracking-widest leading-none mt-0.5 font-bold">
                                    {p.positionGroup === 'GK' ? 'Guarda-Redes' : p.positionGroup === 'DEF' ? 'Defesa' : p.positionGroup === 'MID' ? 'Médio' : 'Avançado'}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                {placement ? (
                                  <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded uppercase font-bold">
                                    No Campo ({placement.role})
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">
                                    Disponível
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">
                      💡 Selecionar um atleta já em campo irá deslocá-lo para esta posição.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>

          </div>

          {/* SCENARIO ANNOTATIONS CARD */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <h3 className="text-sm font-black tracking-wide text-slate-800 flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-red-600" />
              Anotações sobre este Cenário Tático
            </h3>
            <textarea
              id="scenario-notes-textarea"
              value={currentTeam.notes}
              onChange={(e) => handleSaveTeamNotes(e.target.value)}
              className="bg-slate-50 text-slate-800 text-xs leading-relaxed p-3.5 rounded-lg border border-slate-200 hover:border-slate-350 focus:border-red-600 focus:outline-none w-full min-h-[90px] resize-y shadow-inner font-sans"
              placeholder="Descreva a estratégia para esta equipa sombra... (ex: movimentos ofensivos, vulnerabilidades na transição defensiva, rotinas de bola parada)"
            />
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              {isSupabaseConfigured ? (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  Geração guardada em automático na base de dados (Supabase).
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"></span>
                  *Anotações armazenadas automaticamente na memória local do seu navegador.
                </>
              )}
            </p>
          </div>

        </div>

        {/* RIGHT PANEL: SQUADPOOL & ANALYTICS (4 COLS ON DESKTOP) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6" id="right-sidebar-panel">
          
          {/* SQUAD MEMBER POOL SECTION */}
          <div className="bg-white rounded-xl border border-slate-202 flex flex-col shadow-sm overflow-hidden" id="athletes-pool">
            
            {/* Header decorated with red-white bar */}
            <div className="h-2 bg-striped-vertical-small w-full"></div>

            {/* Control pool stats header */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50" id="athletes-pool-header">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-805 tracking-wider flex items-center flex-wrap gap-1.5">
                  <span>Plantel Geral do Clube</span>
                  <span className="text-[11px] font-mono font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                    {players.length} Atletas
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {squadBackup && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlayers(squadBackup.players);
                      setShadowTeams(squadBackup.shadowTeams);
                      if (isSupabaseConfigured) {
                        squadBackup.players.forEach(p => {
                          dbService.upsertPlayer(p).catch(err => console.error("Error restoring player to Supabase:", err));
                        });
                        squadBackup.shadowTeams.forEach(t => {
                          dbService.upsertShadowTeam(t).catch(err => console.error("Error restoring scenario to Supabase:", err));
                        });
                      }
                      setSquadBackup(null);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                    title="Desfazer e recuperar o plantel anterior completinho"
                  >
                    <Undo className="h-3.5 w-3.5" />
                    <span>Desfazer</span>
                  </button>
                )}
                {players.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearSquad(true)}
                    className="bg-slate-200 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 font-extrabold text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-95"
                    title="Remover todo o plantel de uma vez"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remover todo o Plantel</span>
                  </button>
                )}
                <button
                  id="add-athlete-btn"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 ml-auto md:ml-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Criar Atleta</span>
                </button>
              </div>
            </div>

            {/* EXPANDABLE INLINE ATHLETE CREATOR FORM */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  id="add-athlete-form"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddPlayer}
                  className="bg-slate-50 border-b border-slate-200 p-4 space-y-3.5 overflow-hidden text-xs text-slate-700"
                >
                  <h4 className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-3 bg-red-600 rounded"></span>
                    Novo Atleta no Gabinete
                  </h4>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 rounded p-1.5 w-full focus:outline-none focus:border-red-600"
                        placeholder="Ex: João Moutinho"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dorsal / Nº</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        required
                        value={formNumber}
                        onChange={(e) => setFormNumber(parseInt(e.target.value) || 10)}
                        className="bg-white border border-slate-200 text-slate-800 rounded p-1.5 w-full focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Posição</label>
                      <select
                        value={formPosition}
                        onChange={(e) => setFormPosition(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 rounded p-1.5 w-full focus:outline-none focus:border-red-600 cursor-pointer"
                      >
                        {FOOTBALL_POSITIONS.map(pos => (
                          <option key={pos.code} value={pos.code}>{pos.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pé Preferido</label>
                      <select
                        value={formFoot}
                        onChange={(e) => setFormFoot(e.target.value as any)}
                        className="bg-white border border-slate-200 text-slate-800 rounded p-1.5 w-full focus:outline-none focus:border-red-600 cursor-pointer"
                      >
                        <option value="Direito">Direito (Destro)</option>
                        <option value="Esquerdo">Esquerdo (Canhoto)</option>
                        <option value="Ambos">Ambos os Pés</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={formBirthDate}
                          onChange={(e) => setFormBirthDate(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 rounded p-1.5 w-full focus:outline-none focus:border-red-600 cursor-pointer text-xs font-sans"
                        />
                        {formBirthDate && (() => {
                          const year = formBirthDate.substring(0, 4);
                          if (year === '2009') return <span className="absolute right-2 top-2 text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">1º ano</span>;
                          if (year === '2008') return <span className="absolute right-2 top-2 text-[9px] font-bold text-teal-700 bg-teal-50 px-1 rounded border border-teal-200">2º ano</span>;
                          return null;
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classificação (Estrelas)</label>
                      <div className="flex gap-1 items-center mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                           <button
                            key={star}
                            type="button"
                            onClick={() => setFormRating(star)}
                            className="bg-transparent border-0 cursor-pointer"
                          >
                            <Star
                              className={`h-4.5 w-4.5 ${
                                star <= formRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dossiê / Características do Atleta</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="bg-white border border-slate-200 text-slate-800 rounded p-2 w-full h-14 resize-none focus:outline-none focus:border-red-600"
                      placeholder="Ex: Forte no jogo aéreo, rápido no desarme..."
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 px-3 rounded cursor-pointer font-bold transition-all text-[11px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-4 rounded shadow-sm cursor-pointer transition-all text-[11px]"
                    >
                      Inserir Atleta
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* POOL SEARCH & SECTOR FILTERS */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex gap-1.5">
                <div className="relative flex-grow">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    id="player-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar..."
                    className="bg-white placeholder:text-slate-400 text-slate-800 rounded-lg pl-9 pr-2 py-1.5 text-xs w-full border border-slate-200 focus:outline-none focus:border-red-600"
                  />
                </div>
                
                {/* Year of birth filter drop down */}
                <select
                  value={selectedYearFilter}
                  onChange={(e) => setSelectedYearFilter(e.target.value)}
                  className="bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none cursor-pointer font-bold shrink-0 shadow-xs"
                  title="Filtrar por ano de nascimento"
                >
                  <option value="ALL">Ano (Todos)</option>
                  <option value="2009">2009 (1º ano)</option>
                  <option value="2008">2008 (2º ano)</option>
                  {/* Dynamic remaining years in the squad */}
                  {availableYears
                    .filter(year => year !== '2008' && year !== '2009')
                    .map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))
                  }
                </select>
              </div>

              {/* Sector Tabs selectors */}
              <div className="grid grid-cols-5 gap-1 text-[10px]" id="sector-filters">
                {[
                  { key: 'ALL', label: 'Tudo' },
                  { key: 'GK', label: 'GR' },
                  { key: 'DEF', label: 'DEF' },
                  { key: 'MID', label: 'MID' },
                  { key: 'ATT', label: 'ATT' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedGroupFilter(tab.key as any)}
                    className={`py-1 rounded font-bold uppercase cursor-pointer text-center transition-all ${
                      selectedGroupFilter === tab.key
                        ? 'bg-red-600 text-white border border-red-500 shadow-sm shadow-red-200'
                        : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 shadow-sm shadow-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PLAYERS LIST (SCROLLABLE CARD LIST) */}
            <div className="p-3 divide-y divide-slate-100 max-h-[380px] overflow-y-auto space-y-1.5 bg-white" id="roster-pool-list">
              
              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide px-1">
                Arraste os jogadores para o campo ou clique em qualquer posição para posicionar.
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-400">Nenhum jogador encontrado com os filtros atuais.</p>
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const placement = getPlayerPlacement(player.id);
                  const isPlaced = placement !== null;
                  
                  return (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={() => handleDragStart(player.id)}
                      className={`group p-2.5 flex items-center justify-between transition-all cursor-grab active:cursor-grabbing border ${
                        isPlaced 
                        ? 'bg-red-50/70 border-l-4 border-red-600 border-y border-r border-red-100 rounded-r-md text-red-950 shadow-sm' 
                        : 'bg-white border-slate-200/90 rounded-md text-slate-800 hover:border-slate-300'
                      }`}
                      id={`pool-player-${player.id}`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Jersey small badge icon */}
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-striped-vertical-small border border-slate-200 flex items-center justify-center font-mono font-bold text-slate-900 text-xs shadow-sm">
                            <span className="bg-white px-0.5 rounded-sm text-[10px] leading-tight border border-slate-200">
                              {player.number}
                            </span>
                          </div>
                          
                          {/* Foot helper dot */}
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white text-[6px] font-black text-center flex items-center justify-center ${
                            player.preferredFoot === 'Esquerdo' ? 'bg-amber-600 text-white' : player.preferredFoot === 'Ambos' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                          }`} title={`Pé Preferido: ${player.preferredFoot}`}>
                            {player.preferredFoot === 'Esquerdo' ? 'E' : player.preferredFoot === 'Ambos' ? 'A' : 'D'}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-xs text-slate-800">{player.name}</p>
                            <span className="text-[10px] text-amber-500 font-bold flex items-center shrink-0">
                              ★{player.rating}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {/* Sector label badge */}
                            <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-wider font-mono ${
                              player.positionGroup === 'GK' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              player.positionGroup === 'DEF' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              player.positionGroup === 'MID' ? 'bg-amber-50 text-amber-600 border border-amber-150' :
                              'bg-rose-50 text-rose-705 border border-rose-150'
                            }`}>
                              {player.positionGroup}
                            </span>

                            {/* Football state label */}
                            <span className={`text-[8px] font-bold px-1 rounded ${
                              player.status === 'Titular' ? 'bg-emerald-50 text-emerald-700' :
                              player.status === 'Suplente' ? 'bg-slate-100 text-slate-600' :
                              player.status === 'Lesionado' ? 'bg-rose-50 text-rose-600' :
                              player.status === 'Negociação' ? 'bg-purple-50 text-purple-650' :
                              'bg-slate-105 text-slate-500'
                            }`}>
                              {player.status}
                            </span>

                            {/* Birth year custom label */}
                            {player.birthDate && (() => {
                              const year = player.birthDate.substring(0, 4);
                              if (year === '2009') return <span className="text-[8px] font-extrabold px-1 rounded bg-amber-50 text-amber-750 border border-amber-200">1º ano</span>;
                              if (year === '2008') return <span className="text-[8px] font-extrabold px-1 rounded bg-teal-50 text-teal-750 border border-teal-200">2º ano</span>;
                              return <span className="text-[8px] font-bold px-1 rounded bg-slate-50 text-slate-500 border border-slate-150" title={`Ano: ${year}`}>{year}</span>;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Options and quick info */}
                      <div className="flex items-center gap-1 z-10">
                        {isPlaced && (
                          <span 
                            onClick={() => handleRemoveFromPosition(placement.id)}
                            className="text-[9px] font-mono hover:bg-rose-600 hover:text-white hover:border-red-600 border border-red-200 rounded px-1.5 py-0.5 font-bold uppercase text-red-600 cursor-pointer transition-colors"
                            title="Desescalar do campo"
                          >
                            {placement.role} ✕
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setActivePlayer(player);
                            setIsEditingPlayer(false);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver Ficha / Observações do Atleta"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Retirar do Clube"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })
              )}

            </div>

            {/* Quick Helper Device Instructions warning */}
            <div className="bg-slate-55 border-t border-slate-150 p-3 text-[10px] text-slate-500 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none" />
              <span>
                <strong>Aviso de Toque:</strong> No telemóvel? Basta clicar em qualquer posição vazia do relvado para abrir o menu rápido de seleção!
              </span>
            </div>

          </div>

          {/* DYNAMIC SQUAD SYSTEM BALANCE GRAPHICS */}
          <SquadDepthChart
            players={players}
            activeFormation={activeFormation}
            placements={currentTeam.placements}
          />

        </div>

      </main>

      {/* 🧾 ATHLETE DETAILS AND NOTES DIALOG SLIDE-OVER */}
      <AnimatePresence>
        {activePlayer && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 flex items-center justify-center p-4"
            onClick={() => {
              setActivePlayer(null);
              setIsEditingPlayer(false);
            }}
            id="dossier-slide-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Header stripes */}
              <div className="h-3 bg-striped-vertical w-full"></div>

              {isEditingPlayer ? (
                /* EDITING DETAILS MODE */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdatePlayer(activePlayer);
                  }}
                  className="p-6 space-y-4 text-xs text-slate-705"
                >
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider pb-1.5 border-b border-slate-200 flex items-center gap-1">
                    <Edit2 className="h-4 w-4 text-red-500" />
                    Editar Ficha de Atleta: {activePlayer.name}
                  </h3>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome</label>
                      <input
                        type="text"
                        required
                        value={activePlayer.name}
                        onChange={(e) => setActivePlayer({ ...activePlayer, name: e.target.value })}
                        className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dorsal Nº</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={activePlayer.number}
                        onChange={(e) => setActivePlayer({ ...activePlayer, number: parseInt(e.target.value) || 1 })}
                        className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-645"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Posição</label>
                      <select
                        value={activePlayer.position || 'MC'}
                        onChange={(e) => {
                          const code = e.target.value;
                          const mappedGroup = FOOTBALL_POSITIONS.find(p => p.code === code)?.group || 'MID';
                          setActivePlayer({ ...activePlayer, position: code, positionGroup: mappedGroup as any });
                        }}
                        className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-600 cursor-pointer text-xs"
                      >
                        {FOOTBALL_POSITIONS.map(pos => (
                          <option key={pos.code} value={pos.code}>{pos.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Pé Preferido</label>
                      <select
                        value={activePlayer.preferredFoot}
                        onChange={(e) => setActivePlayer({ ...activePlayer, preferredFoot: e.target.value as any })}
                        className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-500 cursor-pointer text-xs"
                      >
                        <option value="Direito">Direito (Destro)</option>
                        <option value="Esquerdo">Esquerdo (Canhoto)</option>
                        <option value="Ambos">Ambos os Pés</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Disponibilidade</label>
                      <select
                        value={activePlayer.status || 'Suplente'}
                        onChange={(e) => setActivePlayer({ ...activePlayer, status: e.target.value as any })}
                        className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-600 cursor-pointer text-xs"
                      >
                        <option value="Titular">Disponível</option>
                        <option value="Suplente">Alternativa</option>
                        <option value="Lesionado">Lesionado 🚑</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Classificação Técnica</label>
                      <div className="flex gap-1 items-center mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setActivePlayer({ ...activePlayer, rating: star })}
                            className="bg-transparent border-0 cursor-pointer"
                          >
                            <Star
                              className={`h-4.5 w-4.5 ${
                                star <= activePlayer.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Data de Nascimento</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={activePlayer.birthDate || ''}
                          onChange={(e) => {
                            const dateVal = e.target.value;
                            setActivePlayer({ ...activePlayer, birthDate: dateVal || undefined });
                          }}
                          className="bg-slate-50 text-slate-900 rounded p-1.5 w-full border border-slate-200 focus:outline-none focus:border-red-610 cursor-pointer text-xs font-sans text-left"
                        />
                        {activePlayer.birthDate && (() => {
                          const year = activePlayer.birthDate.substring(0, 4);
                          if (year === '2009') return <span className="absolute right-2 top-2 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded border border-amber-250">1º ano</span>;
                          if (year === '2008') return <span className="absolute right-2 top-2 text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 rounded border border-teal-250">2º ano</span>;
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Anotações do Treinador sobre o Atleta (Dossiê)</label>
                    <textarea
                      value={activePlayer.notes || ''}
                      onChange={(e) => setActivePlayer({ ...activePlayer, notes: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded p-2.5 w-full h-24 resize-none focus:outline-none focus:border-red-600 font-sans text-xs"
                      placeholder="Anote características, teto competitivo, prazos de contrato ou notas clínicas..."
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPlayer(false)}
                      className="bg-slate-200 hover:bg-slate-305 text-slate-700 py-1.5 px-4 rounded font-bold cursor-pointer transition-all text-[11px]"
                    >
                      Voltar ao Dossier
                    </button>
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded flex items-center gap-1 transition-all cursor-pointer text-[11px]"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar Alterações
                    </button>
                  </div>
                </form>
              ) : (
                /* READ-ONLY CARD DETAILED VIEW */
                <div className="p-6">
                  {/* Close button */}
                  <button 
                    onClick={() => setActivePlayer(null)}
                    className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="flex items-start gap-4 pb-4 border-b border-slate-200 mb-4">
                    {/* Retro striped jersey motif circle */}
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-2 border-red-600 text-2xl font-black text-red-600 shadow-inner shrink-0 shadow-black/5">
                      {activePlayer.number}
                    </div>

                    <div>
                      <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded uppercase font-black tracking-widest inline-block">
                        {activePlayer.positionGroup === 'GK' ? 'Guarda-Redes (GR)' :
                         activePlayer.positionGroup === 'DEF' ? 'Setor Defensivo (DEF)' :
                         activePlayer.positionGroup === 'MID' ? 'Meio-Campo (MID)' :
                         'Linha Atacante (ATT)'}
                      </span>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 mt-1 uppercase leading-tight">
                        {activePlayer.name}
                      </h3>
                      
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Footprints className="h-3.5 w-3.5 text-slate-400" />
                            Pé Preferido: <strong className="text-slate-700">{activePlayer.preferredFoot}</strong>
                          </span>
                          <span className="w-1 h-3 bg-slate-200 rounded"></span>
                          <span className="flex items-center gap-1">
                            <Award className="h-3.5 w-3.5 text-slate-400" />
                            Estatuto: <strong className="text-slate-700">{activePlayer.status}</strong>
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-150 rounded-md px-2 py-1 w-fit mt-0.5">
                          <Calendar className="h-3.5 w-3.5 text-red-650 mr-0.5" />
                          <span>Nascimento: </span>
                          <strong className="text-slate-800 ml-1">
                            {getBirthDateDisplay(activePlayer.birthDate)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    
                    {/* Athlete Stars rating stats */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Nível Desportivo / Avaliação Técnica:</span>
                      <div className="flex gap-0.5 text-amber-500 font-bold items-center">
                        {Array.from({ length: activePlayer.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                        ))}
                        {Array.from({ length: 5 - activePlayer.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 text-slate-300" />
                        ))}
                      </div>
                    </div>

                    {/* Active tactical field placement summary */}
                    {(() => {
                      const placement = getPlayerPlacement(activePlayer.id);
                      return placement ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-650 animate-pulse-subtle"></span>
                          <span>
                            Ativo no cenário em campo na posição: <strong className="font-extrabold">{placement.role} ({activeFormation.positions.find(p=>p.id === placement.id)?.role})</strong>
                          </span>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-lg text-slate-505 text-xs border border-slate-200">
                          ℹ️ Este atleta está atualmente no banco de suplentes (não escalado em campo para este cenário).
                        </div>
                      );
                    })()}

                    {/* Coaching observations report folder content */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-red-600" />
                        Dossiê Profissional (Observações do Mister)
                      </h4>
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 min-h-[80px]">
                        {activePlayer.notes ? (
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                            {activePlayer.notes}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Sem observações recolhidas para este atleta. Carregue no botão "Editar" à direita para iniciar o registo de anotações técnicas sobre este jogador.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom controls */}
                    <div className="flex gap-2 justify-between pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleDeletePlayer(activePlayer.id)}
                        className="bg-slate-100 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 py-1.5 px-4 rounded-lg flex items-center gap-1 text-xs cursor-pointer transition-all font-bold"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Atleta
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setActivePlayer(null);
                          }}
                          className="bg-slate-200 hover:bg-slate-300 border border-slate-200 text-slate-700 py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all"
                        >
                          Fechar Ficha
                        </button>
                        <button
                          onClick={() => setIsEditingPlayer(true)}
                          className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded-lg flex items-center gap-1 text-xs cursor-pointer transition-all"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar Dossier
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Mini-Control */}
      <footer className="h-11 bg-slate-900 flex items-center px-6 justify-between select-none shrink-0" id="app-footer-stats">
        <div className="flex gap-4 items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Temporada {new Date().getFullYear()}</span>
          <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            Em Edição
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <div className="text-[10px] text-slate-400 font-medium hidden sm:block">Arraste atletas para reposicionar</div>
          <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
          <div className="text-[10px] text-white font-bold">
            {Math.round(100 - (players.length > 0 ? (activeFormation.positions.filter(pos => !currentTeam.placements[pos.id]).length / 11) * 100 : 0))}% Equilíbrio de Plantel
          </div>
        </div>
      </footer>

      {/* -------------------- CUSTOM CONFIRMATION DIALOG MODALS -------------------- */}

      {/* 1. Custom Confirmation Dialog for Deleting Player */}
      {playerToDeleteId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="delete-player-modal">
          <div className="bg-white border-2 border-red-600 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-slate-850">
            <button 
              type="button" 
              onClick={() => setPlayerToDeleteId(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              <h3 className="text-base font-black uppercase tracking-tight">Excluir Atleta do Plantel</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-5">
              Tem a certeza de que deseja excluir o atleta <strong className="text-slate-950">"{players.find(p => p.id === playerToDeleteId)?.name}"</strong> do plantel? Esta ação irá retirá-lo de todas as táticas e planos de equipa e é irreversível.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPlayerToDeleteId(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 py-1.5 px-4 rounded-lg font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = playerToDeleteId;
                  if (id) {
                    setPlayers(prev => prev.filter(p => p.id !== id));
                    
                    const updatedTeams = shadowTeams.map(t => {
                      const updatedPlacements = { ...t.placements };
                      let modified = false;
                      Object.keys(updatedPlacements).forEach(key => {
                        if (updatedPlacements[key] === id) {
                          delete updatedPlacements[key];
                          modified = true;
                        }
                      });
                      return { team: { ...t, placements: updatedPlacements }, modified };
                    });

                    setShadowTeams(updatedTeams.map(item => item.team));

                    if (isSupabaseConfigured) {
                      dbService.deletePlayer(id).catch(err => console.error("Error deleting player from Supabase:", err));
                      updatedTeams.forEach(item => {
                        if (item.modified) {
                          dbService.upsertShadowTeam(item.team).catch(err => console.error("Error updating placements after player delete:", err));
                        }
                      });
                    }
                  }
                  if (activePlayer?.id === id) {
                    setActivePlayer(null);
                    setIsEditingPlayer(false);
                  }
                  setPlayerToDeleteId(null);
                }}
                className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-all shadow-sm"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Deleting All Squad Members */}
      {confirmClearSquad && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="clear-squad-modal">
          <div className="bg-white border-2 border-red-600 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-slate-850">
            <button 
              type="button" 
              onClick={() => setConfirmClearSquad(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              <h3 className="text-base font-black uppercase tracking-tight">Dispensar Todo o Plantel</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-5">
              Tem a certeza de que deseja <strong className="text-red-600">remover todos os {players.length} atletas</strong> do plantel de uma só vez?
              Isso também irá limpar todas as escalações nos cenários táticos atuais. 
              <br/><br/>
              <span className="text-amber-600 font-bold">💡 Nota: Poderá desfazer esta ação imediatamente através do botão "Desfazer" na barra lateral.</span>
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearSquad(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 py-1.5 px-4 rounded-lg font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  // Back up current players & shadowTeams
                  setSquadBackup({
                    players: [...players],
                    shadowTeams: JSON.parse(JSON.stringify(shadowTeams))
                  });

                  // Clear current state
                  setPlayers([]);
                  const cleanedTeams = shadowTeams.map(t => ({ ...t, placements: {} }));
                  setShadowTeams(cleanedTeams);
                  
                  if (isSupabaseConfigured) {
                    dbService.clearAllPlayers().catch(err => console.error("Error clearing all players on Supabase:", err));
                    cleanedTeams.forEach(t => {
                      dbService.upsertShadowTeam(t).catch(err => console.error("Error resetting placements on Supabase:", err));
                    });
                  }
                  
                  // Hide editing modals if active
                  setActivePlayer(null);
                  setIsEditingPlayer(false);
                  
                  // Close modal
                  setConfirmClearSquad(false);
                }}
                className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-all shadow-sm"
              >
                Confirmar Dispensa Geral
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Custom Confirmation Dialog for Clearing Pitch */}
      {confirmClearPitch && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="clear-pitch-modal">
          <div className="bg-white border-2 border-red-600 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-slate-850">
            <button 
              type="button" 
              onClick={() => setConfirmClearPitch(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <RotateCcw className="h-6 w-6 stroke-[2.5]" />
              <h3 className="text-base font-black uppercase tracking-tight">Retirar Jogadores do Campo</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-5">
              Deseja retirar todos os jogadores do campo de futebol neste plano tático ativo? Esta ação vai limpar as escalações atuais, mas não excluirá os atletas do plantel.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearPitch(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 py-1.5 px-4 rounded-lg font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const updatedTeam = { ...currentTeam, placements: {} };
                  setShadowTeams(prev => prev.map(t => (t.id === currentTeam.id ? updatedTeam : t)));
                  
                  if (isSupabaseConfigured) {
                    dbService.upsertShadowTeam(updatedTeam).catch(err => {
                      console.error("Error clearing pitch in Supabase:", err);
                      setAlertMessage(`Falha ao retirar os jogadores do campo no Supabase. Detalhes: ${err?.message || JSON.stringify(err)}`);
                    });
                  }
                  setConfirmClearPitch(false);
                }}
                className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-all shadow-sm"
              >
                Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Custom Confirmation Dialog for Deleting Scenarios */}
      {teamScenarioToDeleteId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="delete-scenario-modal">
          <div className="bg-white border-2 border-red-600 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-slate-850">
            <button 
              type="button" 
              onClick={() => setTeamScenarioToDeleteId(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              <h3 className="text-base font-black uppercase tracking-tight">Apagar Cenário Tático</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-5">
              Tem a certeza absoluta que deseja apagar permanentemente o cenário tático <strong className="text-slate-950">"{shadowTeams.find(t => t.id === teamScenarioToDeleteId)?.name}"</strong>? Esta ação é irreversível.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTeamScenarioToDeleteId(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 py-1.5 px-4 rounded-lg font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = teamScenarioToDeleteId;
                  if (id) {
                    const remaining = shadowTeams.filter(t => t.id !== id);
                    setShadowTeams(remaining);
                    setActiveTeamId(remaining[0]?.id || 't1');
                    if (isSupabaseConfigured) {
                      dbService.deleteShadowTeam(id).catch(err => console.error("Error deleting scenario from Supabase:", err));
                    }
                  }
                  setTeamScenarioToDeleteId(null);
                }}
                className="bg-red-600 hover:bg-red-750 text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-all shadow-sm"
              >
                Confirmar Eliminação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Alert/Message Modal Drawer */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="alert-message-modal">
          <div className="bg-white border-2 border-red-600 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-slate-850">
            <button 
              type="button" 
              onClick={() => setAlertMessage(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <Info className="h-6 w-6 stroke-[2.5]" />
              <h3 className="text-base font-black uppercase tracking-tight">Aviso do Sistema</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-5">
              {alertMessage}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAlertMessage(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-5 rounded-lg text-xs cursor-pointer transition-all shadow-sm font-semibold"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
