'use client';

import { useState, useEffect } from 'react';
import { saveStrategy, deleteStrategy } from '@/app/actions/strategy';
import { StrategyInputGrid } from '@/components/StrategyInputGrid';
import { StrategyList } from '@/components/StrategyList';
import { Header } from '@/components/Header';
import { LoginForm } from '@/components/LoginForm';
import { Leg, Strategy, StrategyType, StrategyStructure } from '@/types';

// Default empty leg template
const EMPTY_LEG: Leg = {
  optionTicker: '',
  type: 'CALL',
  operation: 'COMPRA',
  strike: 0,
  quantity: 100,
  entryPremium: 0,
  currentQuote: 0,
  expiration: ''
};

type ViewMode = 'LIST' | 'CREATE' | 'EDIT';

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('LIST');

  // Method State
  const [legs, setLegs] = useState<Leg[]>(Array(6).fill(null).map(() => ({ ...EMPTY_LEG })));
  const [globalType, setGlobalType] = useState<StrategyType>('DIRECAO');
  const [globalStructure, setGlobalStructure] = useState<StrategyStructure>('CALL SPREAD');
  const [globalStatus, setGlobalStatus] = useState<'Em Andamento' | 'Encerrada'>('Em Andamento');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to Today
  const [initialSpotPrice, setInitialSpotPrice] = useState<number | undefined>(undefined);
  const [stopLoss, setStopLoss] = useState<number>(50);
  const [maxGain, setMaxGain] = useState<number>(70);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  // Restore session
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user_email');
    if (savedUser) setUserEmail(savedUser);
  }, []);

  const handleLogin = (email: string) => {
    setUserEmail(email);
    sessionStorage.setItem('user_email', email);
  };

  const handleLogout = () => {
    setUserEmail(null);
    sessionStorage.removeItem('user_email');
  };

  // Navigation Handlers
  const handleNew = () => {
    setLegs(Array(6).fill(null).map(() => ({ ...EMPTY_LEG })));
    setGlobalType('DIRECAO');
    setGlobalStructure('CALL SPREAD');
    setGlobalStatus('Em Andamento');
    setStartDate(new Date().toISOString().split('T')[0]);
    setInitialSpotPrice(undefined);
    setStopLoss(50);
    setMaxGain(70);
    setEditingStrategy(null);
    setMode('CREATE');
  };

  const handleEdit = (strategy: Strategy) => {
    // In a real app we'd load this fully. For now we assume the strategy object has full leg data?
    // Our listStrategies currently fetches everything, so yes.
    // But we need to ensure the legs array is padded to 6 if needed for the grid?
    const loadedLegs = [...strategy.legs];
    while (loadedLegs.length < 6) {
      loadedLegs.push({ ...EMPTY_LEG });
    }

    setLegs(loadedLegs);
    setGlobalType(strategy.type);
    setGlobalStructure(strategy.structure || 'CALL SPREAD');
    setGlobalStatus(strategy.status || 'Em Andamento');
    setStartDate(strategy.startDate || new Date().toISOString().split('T')[0]);
    setInitialSpotPrice(strategy.initialSpotPrice);
    setStopLoss(strategy.stopLossPercent ?? 50);
    setMaxGain(strategy.maxGainPercent ?? 70);
    setEditingStrategy(strategy);
    setMode('EDIT');
  };

  const handleDelete = async (id: string) => {
    if (!userEmail) return;
    const res = await deleteStrategy(id, userEmail);
    if (!res.success) {
      alert("Error deleting: " + res.error);
    }
  };



  const handleSaveStrategy = async () => {
    if (!userEmail) return;
    const validLegs = legs.filter(l => l.optionTicker.trim().length > 0);

    if (validLegs.length === 0) {
      alert('Please enter at least one position.');
      return;
    }

    // Status Validation: Enforce Exit Premium if Closing
    if (globalStatus === 'Encerrada') {
      // Check if any leg has missing exit premium
      // Note: exitPremium can be 0, but must be defined (not null/undefined)
      // StrategyInputRow initializes undefined, onChange sets it.
      // If user creates leg and saves immediately without touching exit premium, it's undefined.
      // If user edits and adds exit premium, it's number.
      const missingExit = validLegs.some(l => l.exitPremium === undefined || l.exitPremium === null);

      if (missingExit) {
        alert('Para encerrar a estratégia, informe o Prêmio de Saída de todas as pernas.');
        return;
      }
    }

    const totalPremium = validLegs.reduce((sum, leg) => {
      // If Exit Premium is available (Realized), use it? 
      // Or purely Entry Premium?
      // Usually "Total Entry Premium" is strictly entry cost.
      return sum + (leg.entryPremium * leg.quantity * (leg.operation === 'COMPRA' ? 1 : -1));
    }, 0);

    const refTicker = validLegs[0].optionTicker;

    const legsWithGlobal = validLegs.map(l => ({
      ...l,
      strategyType: globalType,
      structure: globalStructure
    }));

    // Prepare payload. Include ID/CreatedAt if editing.
    const strategyData: any = {
      ticker: refTicker,
      type: globalType,
      structure: globalStructure,
      status: mode === 'CREATE' ? 'Em Andamento' : globalStatus,
      legs: legsWithGlobal,
      totalEntryPremium: totalPremium,
      userEmail: userEmail, // Bind to current user
      startDate: startDate,
      initialSpotPrice: initialSpotPrice ? Number(initialSpotPrice) : undefined,
      stopLossPercent: Number(stopLoss),
      maxGainPercent: Number(maxGain)
    };

    if (mode === 'EDIT' && editingStrategy) {
      strategyData.id = editingStrategy.id;
      strategyData.createdAt = editingStrategy.createdAt;
    }

    try {
      const result = await saveStrategy(strategyData);

      if (result.success) {
        alert('Strategy Saved!');
        setMode('LIST');
      } else {
        console.error(result.error);
        alert('Error saving strategy.');
      }
    } catch (e) {
      console.error(e);
      alert('Exception saving strategy');
    }
  };

  if (!userEmail) {
    return <LoginForm onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Header userEmail={userEmail} onLogout={handleLogout} />

      <main className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">

        {/* Context Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setMode('LIST')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'LIST' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            CONSULTA
          </button>
          <button
            onClick={handleNew}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'CREATE' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-100'}`}
          >
            NOVA ESTRATÉGIA
          </button>
        </div>

        {/* Main Content Area */}
        <div className="w-full">
          {mode === 'LIST' && (
            <StrategyList
              userEmail={userEmail}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          {(mode === 'CREATE' || mode === 'EDIT') && (
            <div className="space-y-4">
              {/* Global Strategy Context Header */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-12 gap-4 items-end">
                {/* Global Objective */}
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Objetivo Global</label>
                  <select
                    value={globalType}
                    onChange={(e) => setGlobalType(e.target.value as StrategyType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="DIRECAO">DIRECAO</option>
                    <option value="LATERAL">LATERAL</option>
                    <option value="RENDA">RENDA</option>
                    <option value="ROLAGEM">ROLAGEM</option>
                    <option value="VOLATILIDADE">VOLATILIDADE</option>
                  </select>
                </div>

                {/* Global Structure */}
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Estratégia</label>
                  <select
                    value={globalStructure}
                    onChange={(e) => setGlobalStructure(e.target.value as StrategyStructure)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="CALL SPREAD">CALL SPREAD</option>
                    <option value="CASH SECURED PUT">CASH SECURED PUT</option>
                    <option value="COVERED CALL">COVERED CALL</option>
                    <option value="IRON CONDOR">IRON CONDOR</option>
                    <option value="PUT BULL CREDIT">PUT BULL CREDIT</option>
                    <option value="PUT SPREAD">PUT SPREAD</option>
                    <option value="SEAGULL">SEAGULL</option>
                    <option value="THL">THL</option>
                  </select>
                </div>

                {/* Status - Only visible in EDIT mode (or Disabled in Create) */}
                {/* User said "A inclusão sempre deve colocar como Em Andamento" */}
                {/* User said "Na tela de Alteração o Status deve ficar ao lado" */}
                {/* I'll render it in both but disabled in CREATE map to requirement? No, "Inclusão sempre deve colocar" implies it's fixed. I'll show it disabled or logic handle it. Showing prevents confusion. */}
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Status</label>
                  <select
                    value={globalStatus}
                    onChange={(e) => setGlobalStatus(e.target.value as any)}
                    disabled={mode === 'CREATE'}
                    className={`w-full border border-slate-300 rounded px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 ${mode === 'CREATE' ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
                  >
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Encerrada">Encerrada</option>
                  </select>
                </div>

                {/* Date & Spot Price Row */}
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Data Op.</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Valor Dia (Spot)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={initialSpotPrice || ''}
                      onChange={(e) => setInitialSpotPrice(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="col-span-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Stop Loss (-%)</label>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(Number(e.target.value))}
                      className="w-full bg-red-50 border border-red-200 rounded px-2 py-2 text-sm font-bold text-red-700 outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Max Gain (+%)</label>
                    <input
                      type="number"
                      value={maxGain}
                      onChange={(e) => setMaxGain(Number(e.target.value))}
                      className="w-full bg-green-50 border border-green-200 rounded px-2 py-2 text-sm font-bold text-green-700 outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={handleSaveStrategy}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {mode === 'CREATE' ? 'CRIAR' : 'SALVAR'}
                  </button>
                </div>
              </div>

              {/* Input Grid */}
              <StrategyInputGrid
                legs={legs}
                onChange={setLegs}
                viewMode={mode === 'CREATE' ? 'CREATE' : 'EDIT'}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
