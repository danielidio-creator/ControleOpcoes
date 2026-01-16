import React, { useState, useEffect } from 'react';
import { listStrategies } from '@/app/actions/strategy';
import { fetchStockDetails, fetchBlackScholes } from '@/app/actions/oplab';
import { fetchStrategyMarketData } from '@/app/actions/marketData';
import { Strategy } from '@/types';
import { PayoffChart } from '@/components/PayoffChart';

interface StrategyListProps {
    userEmail: string;
    onEdit: (strategy: Strategy) => void;
    onDelete: (id: string) => void;
}

export function StrategyList({ userEmail, onEdit, onDelete }: StrategyListProps) {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Live Market Data Maps
    const [marketData, setMarketData] = useState<Record<string, { price: number, ivRank?: number, ivPercentile?: number }>>({}); // Parent Stock Prices
    const [optionPremiums, setOptionPremiums] = useState<Record<string, number>>({});   // Option Premiums
    const [greeksData, setGreeksData] = useState<Record<string, any>>({}); // Live Greeks { [optionTicker]: Greeks }

    // Filters & Sorting
    const [filters, setFilters] = useState({
        parent: '',
        structure: '',
        type: '',
        status: 'Em Andamento'
    });
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'parent', direction: 'asc' });

    useEffect(() => {
        if (userEmail) {
            loadData();
        }
    }, [userEmail]);

    const loadData = async () => {
        setLoading(true);
        const data = await listStrategies(userEmail);
        setStrategies(data);
        setLoading(false);

        // 1. Identify all unique Parent Symbols & Option Tickers
        const parentSymbols = new Set<string>();
        const optionTickers = new Set<string>();

        data.forEach(s => {
            s.legs.forEach(l => {
                if (l.parentSymbol) parentSymbols.add(l.parentSymbol);
                if (l.optionTicker) optionTickers.add(l.optionTicker);
            });
        });

        // 2. Fetch Parent Stock Data
        const newMarketData: Record<string, { price: number, ivRank?: number, ivPercentile?: number }> = {};
        await Promise.all(Array.from(parentSymbols).map(async (sym) => {
            const details = await fetchStockDetails(sym);
            if (details) {
                newMarketData[sym] = {
                    price: details.close || details.last || 0,
                    ivRank: details.iv_1y_rank,
                    ivPercentile: details.iv_1y_percentile
                };
            }
        }));
        setMarketData(newMarketData);

        // 3. Fetch Option Premiums
        const premiums = await fetchStrategyMarketData(Array.from(optionTickers));
        setOptionPremiums(premiums);
    };

    const fetchGreeksForStrategy = async (s: Strategy) => {
        const newGreeks: Record<string, any> = {};

        await Promise.all(s.legs.map(async (leg) => {
            if (!leg.optionTicker) return;

            const parent = leg.parentSymbol;
            const spotPrice = parent ? marketData[parent]?.price : 0;
            const currentPremium = optionPremiums[leg.optionTicker];

            if (!spotPrice || !leg.expiration) return;

            // Calculate DTM
            const today = new Date();
            const expiry = new Date(leg.expiration + 'T18:00:00'); // Assume end of day
            const diffTime = expiry.getTime() - today.getTime();
            const dtm = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            const bsData = await fetchBlackScholes({
                symbol: leg.optionTicker,
                spotPrice,
                strike: leg.strike,
                daysToMaturity: dtm,
                type: leg.type,
                premium: currentPremium
            });

            if (bsData) {
                newGreeks[leg.optionTicker] = bsData;
            }
        }));

        setGreeksData(prev => ({ ...prev, ...newGreeks }));
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
            // Fetch Greeks when expanding
            const s = strategies.find(x => x.id === id);
            if (s) fetchGreeksForStrategy(s);
        }
        setExpandedIds(newExpanded);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta estratégia?')) {
            await onDelete(id);
            loadData();
        }
    };

    const calculateStrategyCurrentValue = (s: Strategy) => {
        let value = 0;
        let missingData = false;

        s.legs.forEach(leg => {
            const premium = optionPremiums[leg.optionTicker];
            if (premium === undefined) {
                missingData = true;
                return;
            }
            const direction = leg.operation === 'COMPRA' ? 1 : -1;
            value += (premium * leg.quantity * direction);
        });

        return { value, missingData };
    };

    // --- Derived Data Logic ---

    // 1. Get Unique Filter Options
    const uniqueParents = Array.from(new Set(strategies.map(s => s.legs[0]?.parentSymbol).filter(Boolean)));
    const uniqueStructures = Array.from(new Set(strategies.map(s => s.structure).filter(Boolean)));
    const uniqueTypes = Array.from(new Set(strategies.map(s => s.type).filter(Boolean)));

    // 2. Filter Strategies
    const filteredStrategies = strategies.filter(s => {
        const matchParent = filters.parent ? s.legs[0]?.parentSymbol === filters.parent : true;
        const matchStructure = filters.structure ? s.structure === filters.structure : true;
        const matchType = filters.type ? s.type === filters.type : true;
        // Status Filter Logic. If filter is empty, show all.
        const matchStatus = filters.status ? s.status === filters.status : true;

        return matchParent && matchStructure && matchType && matchStatus;
    });

    // 3. Sort Strategies
    const sortedStrategies = [...filteredStrategies].sort((a, b) => {
        if (!sortConfig) return 0;

        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
            case 'ticker':
                valA = a.ticker;
                valB = b.ticker;
                break;
            case 'parent':
                valA = a.legs[0]?.parentSymbol || '';
                valB = b.legs[0]?.parentSymbol || '';
                break;
            case 'structure':
                valA = a.structure || '';
                valB = b.structure || '';
                break;
            case 'type':
                valA = a.type || '';
                valB = b.type || '';
                break;
            case 'pnl':
                const valCurrA = calculateStrategyCurrentValue(a).value - (a.totalEntryPremium || 0);
                const valCurrB = calculateStrategyCurrentValue(b).value - (b.totalEntryPremium || 0);
                valA = valCurrA;
                valB = valCurrB;
                break;
            default: return 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <svg className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
        return sortConfig.direction === 'asc'
            ? <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
            : <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
    };

    if (loading) return <div className="p-4 text-center text-slate-500 text-xs font-bold animate-pulse">CARREGANDO...</div>;

    return (
        <div className="space-y-4">
            {/* Filter Header */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center text-sm">
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    <span className="font-bold text-slate-700">Filtros:</span>
                </div>

                <select
                    className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Encerrada">Encerrada</option>
                    <option value="">Todas</option>
                </select>

                <select
                    className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.parent}
                    onChange={(e) => setFilters({ ...filters, parent: e.target.value })}
                >
                    <option value="">Todos Ativos</option>
                    {uniqueParents.sort().map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <select
                    className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.structure}
                    onChange={(e) => setFilters({ ...filters, structure: e.target.value })}
                >
                    <option value="">Todas Estruturas</option>
                    {uniqueStructures.sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                    className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                    <option value="">Todos Tipos</option>
                    {uniqueTypes.sort().map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {(filters.parent || filters.structure || filters.type) && (
                    <button
                        onClick={() => setFilters({ parent: '', structure: '', type: '', status: 'Em Andamento' })}
                        className="text-red-500 hover:text-red-700 text-xs font-bold underline ml-auto"
                    >
                        Limpar Filtros
                    </button>
                )}

                <div className="ml-auto pl-2 border-l border-slate-200">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
                        title="Atualizar Cotações"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18" height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`${loading ? 'animate-spin text-blue-500' : ''}`}
                        >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wide border-b border-slate-200">
                        <tr>
                            <th className="w-8 px-4 py-3"></th>

                            <th
                                className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('parent')}
                            >
                                <div className="flex items-center gap-1">Ativo Base <SortIcon column="parent" /></div>
                            </th>
                            <th
                                className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('structure')}
                            >
                                <div className="flex items-center gap-1">Estrutura <SortIcon column="structure" /></div>
                            </th>
                            <th className="px-4 py-3 text-right">Custo Inic.</th>
                            <th className="px-4 py-3 text-right">Valor Atual</th>
                            <th
                                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleSort('pnl')}
                            >
                                <div className="flex items-center justify-end gap-1">Resultado <SortIcon column="pnl" /></div>
                            </th>
                            <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedStrategies.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic text-xs">
                                    Nenhuma estratégia encontrada.
                                </td>
                            </tr>
                        ) : sortedStrategies.map(s => {
                            const parent = s.legs[0]?.parentSymbol;
                            const currentPrice = parent ? marketData[parent]?.price : undefined;
                            const { value: currentValue, missingData } = calculateStrategyCurrentValue(s);
                            const initialCost = s.totalEntryPremium || 0;
                            const pnl = currentValue - initialCost;
                            const pnlPercent = initialCost !== 0 ? (pnl / Math.abs(initialCost)) * 100 : 0;

                            return (
                                <React.Fragment key={s.id}>
                                    {/* Main Row */}
                                    <tr className={`transition-colors group ${expandedIds.has(s.id) ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleExpand(s.id)}
                                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="16" height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className={`transform transition-transform ${expandedIds.has(s.id) ? 'rotate-90' : ''}`}
                                                >
                                                    <path d="m9 18 6-6-6-6" />
                                                </svg>
                                            </button>
                                        </td>

                                        <td className="px-4 py-3">
                                            {parent ? (
                                                <div className="flex items-center gap-2 relative group/parent-tooltip">
                                                    <span className="font-bold text-slate-700 text-xs cursor-help border-b border-dotted border-slate-300">{parent}</span>
                                                    {currentPrice != null && (
                                                        <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[10px] font-mono">
                                                            {currentPrice.toFixed(2)}
                                                        </span>
                                                    )}

                                                    {/* IV Rank Tooltip (Parent) */}
                                                    <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-lg p-3 z-50 opacity-0 invisible group-hover/parent-tooltip:opacity-100 group-hover/parent-tooltip:visible transition-all duration-200 pointer-events-none">
                                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">IV Rank (1 Ano)</h4>
                                                        <div className="flex justify-between text-[10px] mb-1">
                                                            <span className="text-slate-400">Inicial (DB):</span>
                                                            <span className="font-mono text-slate-600 font-bold">
                                                                {s.legs[0]?.underlyingIvRank != null ? s.legs[0].underlyingIvRank.toFixed(1) : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-slate-400">Atual (Live):</span>
                                                            <span className="font-mono text-blue-600 font-bold">
                                                                {marketData[parent]?.ivRank != null ? marketData[parent].ivRank.toFixed(1) : '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                <div className="flex gap-1">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${s.type === 'RENDA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {s.type}
                                                    </span>
                                                    {s.status === 'Encerrada' && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500">
                                                            ENCERRADA
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-slate-500 text-[10px] font-bold uppercase">{s.structure || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                                            {initialCost.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700">
                                            {missingData ? '...' : currentValue.toFixed(2)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {missingData ? '-' : (
                                                <>
                                                    <span>{(pnl > 0 ? '+' : '') + pnl.toFixed(2)}</span>
                                                    <span className="ml-1.5 text-[10px] opacity-80">
                                                        ({pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                                                    </span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right flex justify-end items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <div title={s.status} className={`w-2.5 h-2.5 rounded-full ${s.status === 'Encerrada' ? 'bg-slate-400' : 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]'}`}></div>
                                            <button onClick={() => onEdit(s)} className="text-blue-500 hover:text-blue-700 p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded Details Row */}
                                    {expandedIds.has(s.id) && (
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <td colSpan={7} className="px-4 py-3 pl-12">
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    {/* Left: Leg Table */}
                                                    <div className="flex-grow bg-white border border-slate-200 rounded-lg">
                                                        {/* Strategy Ticker Header in Details */}
                                                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">Ticker:</span>
                                                            <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-1.5 rounded">{s.ticker}</span>
                                                        </div>
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-100 text-slate-500 font-bold text-[9px] uppercase">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left">Ativo</th>
                                                                    <th className="px-3 py-2 text-center">Operação</th>
                                                                    <th className="px-3 py-2 text-center">Tipo</th>
                                                                    <th className="px-3 py-2 text-center">Strike (% Spot)</th>
                                                                    <th className="px-3 py-2 text-center">Qtd</th>
                                                                    <th className="px-3 py-2 text-right">Prêmio Contratado</th>
                                                                    <th className="px-3 py-2 text-right">Prêmio Atual</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {s.legs.map((leg, idx) => {
                                                                    const premium = optionPremiums[leg.optionTicker];
                                                                    const parent = leg.parentSymbol;
                                                                    const currentPrice = parent ? marketData[parent]?.price : undefined;
                                                                    const percentToStrike = leg.strike && currentPrice ? ((leg.strike / currentPrice) - 1) * 100 : 0;
                                                                    const currentGreeks = greeksData[leg.optionTicker];

                                                                    return (
                                                                        <tr key={`${s.id}-leg-${idx}`} className="text-slate-700">
                                                                            <td className="px-3 py-2 font-bold relative group/tooltip">
                                                                                <span className="cursor-help border-b border-dotted border-slate-400">{leg.optionTicker}</span>
                                                                                {/* Greeks Tooltip */}
                                                                                <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-slate-200 shadow-xl rounded-lg p-3 z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none">
                                                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">Comparativo de Gregas</h4>
                                                                                    <div className="grid grid-cols-3 gap-y-1.5 text-[10px]">
                                                                                        <div className="text-slate-400 font-medium">Grega</div>
                                                                                        <div className="text-right text-slate-400 font-medium">Inic.</div>
                                                                                        <div className="text-right text-slate-400 font-medium">Atual</div>

                                                                                        <div className="font-bold text-slate-600">IV</div>
                                                                                        <div className="text-right font-mono text-slate-500">{leg.greeks?.volatility != null ? leg.greeks.volatility.toFixed(1) + '%' : '-'}</div>
                                                                                        <div className="text-right font-mono text-blue-600 font-bold">{currentGreeks?.volatility != null ? currentGreeks.volatility.toFixed(1) + '%' : '-'}</div>

                                                                                        <div className="font-bold text-slate-600">Delta</div>
                                                                                        <div className="text-right font-mono text-slate-500">{leg.greeks?.delta != null ? leg.greeks.delta.toFixed(2) : '-'}</div>
                                                                                        <div className="text-right font-mono text-blue-600 font-bold">{currentGreeks?.delta != null ? currentGreeks.delta.toFixed(2) : '-'}</div>

                                                                                        <div className="font-bold text-slate-600">Gamma</div>
                                                                                        <div className="text-right font-mono text-slate-500">{leg.greeks?.gamma != null ? leg.greeks.gamma.toFixed(3) : '-'}</div>
                                                                                        <div className="text-right font-mono text-blue-600 font-bold">{currentGreeks?.gamma != null ? currentGreeks.gamma.toFixed(3) : '-'}</div>

                                                                                        <div className="font-bold text-slate-600">Theta</div>
                                                                                        <div className="text-right font-mono text-slate-500">{leg.greeks?.theta != null ? leg.greeks.theta.toFixed(3) : '-'}</div>
                                                                                        <div className="text-right font-mono text-blue-600 font-bold">{currentGreeks?.theta != null ? currentGreeks.theta.toFixed(3) : '-'}</div>

                                                                                        <div className="font-bold text-slate-600">Vega</div>
                                                                                        <div className="text-right font-mono text-slate-500">{leg.greeks?.vega != null ? leg.greeks.vega.toFixed(3) : '-'}</div>
                                                                                        <div className="text-right font-mono text-blue-600 font-bold">{currentGreeks?.vega != null ? currentGreeks.vega.toFixed(3) : '-'}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${leg.operation === 'COMPRA' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                                                                    {leg.operation}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center">{leg.type}</td>
                                                                            <td className="px-3 py-2 text-center">
                                                                                {leg.strike}
                                                                                <span className={`ml-1 text-[9px] ${Math.abs(percentToStrike) < 1 ? 'text-orange-500 font-bold' : percentToStrike > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                                    ({percentToStrike > 0 ? '+' : ''}{percentToStrike.toFixed(1)}%)
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center">{leg.quantity}</td>
                                                                            <td className="px-3 py-2 text-right text-slate-500">{leg.entryPremium.toFixed(2)}</td>
                                                                            <td className="px-3 py-2 text-right font-bold text-slate-700">
                                                                                {premium != null ? premium.toFixed(2) : '-'}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Right: Payoff Chart or Summary */}
                                                    <div className="w-full md:w-1/3 min-h-[12rem] bg-white border border-slate-200 rounded-lg flex flex-col">
                                                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                                            Payoff Estimado (Vencimento)
                                                        </div>
                                                        <div className="flex-grow relative">
                                                            <PayoffChart strategy={s} currentPrice={currentPrice || 0} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
