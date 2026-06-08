import React from 'react';
import { Player, Formation } from '../types';
import { AlertCircle, CheckCircle2, TrendingUp, Info } from 'lucide-react';

interface SquadDepthChartProps {
  players: Player[];
  activeFormation: Formation;
  placements: Record<string, string>; // PositionId -> PlayerId
}

export default function SquadDepthChart({
  players,
  activeFormation,
  placements,
}: SquadDepthChartProps) {
  // Count player groups in the roster
  const squadCounts = {
    GK: players.filter((p) => p.positionGroup === 'GK').length,
    DEF: players.filter((p) => p.positionGroup === 'DEF').length,
    MID: players.filter((p) => p.positionGroup === 'MID').length,
    ATT: players.filter((p) => p.positionGroup === 'ATT').length,
  };

  // Count required positions in active formation
  const requiredCounts = {
    GK: 0,
    DEF: 0,
    MID: 0,
    ATT: 0,
  };

  activeFormation.positions.forEach((pos) => {
    if (pos.id === 'GR') requiredCounts.GK++;
    else if (['DE', 'DD', 'CE', 'CD', 'CC', 'ALA_E', 'ALA_D'].includes(pos.id)) requiredCounts.DEF++;
    else if (['MDF', 'MDF_E', 'MDF_D', 'MCE', 'MCD', 'MC_E', 'MC_D', 'MC', 'MO', 'MCO_C', 'MCO_E', 'MCO_D'].includes(pos.id)) requiredCounts.MID++;
    else requiredCounts.ATT++; // EE, ED, PL, PL_E, PL_D etc.
  });

  // Calculate vacant positions on active pitch
  const activePositionIds = activeFormation.positions.map((p) => p.id);
  const vacantPositions = activeFormation.positions.filter(
    (pos) => !placements[pos.id]
  );

  // Generate dynamic smart recommendations
  const recommendations: string[] = [];
  
  // Rule 1: Bench Depth (we want at least 2 players for each required spot for healthy squad rotation)
  if (squadCounts.GK < requiredCounts.GK * 2) {
    recommendations.push(`Necessita de mais (um) Guarda-Redes para rotação de plantel (Ideal: ${requiredCounts.GK * 2}, tem ${squadCounts.GK}).`);
  }
  if (squadCounts.DEF < requiredCounts.DEF * 2) {
    recommendations.push(`Setor defensivo curto para garantir rotação (Ideal: ${requiredCounts.DEF * 2}, tem ${squadCounts.DEF}). Considere recrutar defesas centrais/laterais.`);
  }
  if (squadCounts.MID < requiredCounts.MID * 2) {
    recommendations.push(`Meio-campo precisa de mais opções de profundidade (Ideal: ${requiredCounts.MID * 2}, tem ${squadCounts.MID}).`);
  }
  if (squadCounts.ATT < requiredCounts.ATT * 2) {
    recommendations.push(`Linha de ataque estreita (Ideal: ${requiredCounts.ATT * 2}, tem ${squadCounts.ATT}). Procure extremos rápidos ou um ponta de lança suplente.`);
  }

  // Rule 2: Left-foot defensives (coaches love left-footed defenders)
  const leftFootedDefs = players.filter((p) => p.positionGroup === 'DEF' && p.preferredFoot === 'Esquerdo');
  if (leftFootedDefs.length === 0 && requiredCounts.DEF > 0) {
    recommendations.push('Alerta de Equilíbrio: Não dispõe de nenhum Defesa Canhoto (pé esquerdo)! Recomendável contratar para facilitar a saída de bola à esquerda.');
  }

  // Rule 3: High ratings balance
  const highQualityPlayers = players.filter((p) => p.rating === 5).length;
  if (highQualityPlayers < 4) {
    recommendations.push('Atenção: O plantel tem poucos atletas de nível de referência (5 estrelas). Tente atrair reforços de categoria internacional.');
  }

  // Count injury list
  const injuredCount = players.filter((p) => p.status === 'Lesionado').length;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden" id="depth-chart-panel">
      {/* Header decorated with subtle red-white bar */}
      <div className="h-2 bg-striped-vertical-small w-full"></div>
      
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <TrendingUp className="text-red-600 h-5 w-5" />
          Análise de Equilíbrio do Plantel
        </h3>

        {/* Vacancy Alerts */}
        {vacantPositions.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-5 flex items-start gap-2.5">
            <AlertCircle className="text-amber-600 h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-800">Posições Vacantes no Quadro</h4>
              <p className="text-xs text-amber-700 mt-1">
                Falta preencher {vacantPositions.length} posições no sistema <strong className="font-semibold">{activeFormation.id}</strong>:{' '}
                {vacantPositions.map((pos) => `${pos.shortRole} (${pos.role})`).join(', ')}.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-150 rounded-lg p-3.5 mb-5 flex items-start gap-2.5">
            <CheckCircle2 className="text-emerald-600 h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-emerald-800">Equipa Fantasma Completa!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                Todas as 11 posições do sistema tático ativo estão preenchidas para este cenário.
              </p>
            </div>
          </div>
        )}

        {/* Sectors Comparison */}
        <div className="space-y-4 mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Cobertura por Setor (Disponível vs Requisitado)
          </h4>

          {/* GK */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-800 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Guarda-Redes (GR)
              </span>
              <span>
                {squadCounts.GK} no plantel <span className="text-gray-400">/</span> {requiredCounts.GK} no campo
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  squadCounts.GK >= requiredCounts.GK * 2
                    ? 'bg-emerald-500'
                    : squadCounts.GK >= requiredCounts.GK
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (squadCounts.GK / (requiredCounts.GK || 1)) * 50)}%` }}
              ></div>
            </div>
          </div>

          {/* DEF */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-800 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                Defesas (DEF)
              </span>
              <span>
                {squadCounts.DEF} no plantel <span className="text-gray-400">/</span> {requiredCounts.DEF} no campo
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  squadCounts.DEF >= requiredCounts.DEF * 2
                    ? 'bg-emerald-500'
                    : squadCounts.DEF >= requiredCounts.DEF
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (squadCounts.DEF / (requiredCounts.DEF || 1)) * 50)}%` }}
              ></div>
            </div>
          </div>

          {/* MID */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-800 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                Médios (MID)
              </span>
              <span>
                {squadCounts.MID} no plantel <span className="text-gray-400">/</span> {requiredCounts.MID} no campo
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  squadCounts.MID >= requiredCounts.MID * 2
                    ? 'bg-emerald-500'
                    : squadCounts.MID >= requiredCounts.MID
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (squadCounts.MID / (requiredCounts.MID || 1)) * 50)}%` }}
              ></div>
            </div>
          </div>

          {/* ATT */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-800 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                Avançados (ATT)
              </span>
              <span>
                {squadCounts.ATT} no plantel <span className="text-gray-400">/</span> {requiredCounts.ATT} no campo
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  squadCounts.ATT >= requiredCounts.ATT * 2
                    ? 'bg-emerald-500'
                    : squadCounts.ATT >= requiredCounts.ATT
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (squadCounts.ATT / (requiredCounts.ATT || 1)) * 50)}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
