'use client';
import { OplabQuote, Leg } from '@/types';
import { useState } from 'react';

interface PositionGridProps {
    chain: OplabQuote[];
    selectedLegs: Leg[];
    onToggleLeg: (quote: OplabQuote, action: 'COMPRA' | 'VENDA', type: 'CALL' | 'PUT') => void;
    onUpdateLeg: (ticker: string, updates: Partial<Leg>) => void;
    spotPrice?: number;
}

export function PositionGrid({ chain, selectedLegs, onToggleLeg, onUpdateLeg, spotPrice }: PositionGridProps) {
    const getLeg = (symbol: string) => selectedLegs.find((l) => l.optionTicker === symbol);

    // Filter 10% from spot
    const filteredChain = spotPrice
        ? chain.filter((c) => Math.abs(c.strike - spotPrice) / spotPrice <= 0.1)
        : chain;

    // Group by Strike for better visualization (Call Left | Strike | Put Right) if possible
    // But given distinct tickers, a flat list sorted by strike is often easier for mobile
    // "Row 1: Call 30 | Strike 30 | Put 30"

    // Grouping logic
    const strikes = Array.from(new Set(filteredChain.map(c => c.strike))).sort((a, b) => a - b);

    return (
        <div className="w-full overflow-x-auto text-sm">
            <table className="w-full min-w-[600px] border-collapse">
                <thead>
                    <tr className="bg-slate-100 text-slate-600">
                        <th className="p-2 text-center w-24">Call</th>
                        <th className="p-2 text-center w-16">Strike</th>
                        <th className="p-2 text-center w-24">Put</th>
                    </tr>
                </thead>
                <tbody>
                    {strikes.map(strike => {
                        const call = filteredChain.find(c => c.strike === strike && c.symbol.includes('A') /* Rough heuristic, better use regex or type if avail */);
                        // Better heuristic: Oplab category is 'OPTION'. 
                        // Usually Ticker+Letter+Strike. 
                        // Let's iterate the filteredChain itself if we want robust 1-item-per-row or try to pair them.

                        // Let's stick to the list View for now as implemented previously which was robust.
                        // Actually, the previous implementation was 5 columns: Action, Type, Strike, Entry, Exit
                        // User asked for: "Ativo, Tipo operação, DTE, Operação, Tipo Opção, Cotação Dia, Cotação Atua, Strike, Quantidade, Prêmio Entrada, Prêmio Saída"
                        // And "% to Strike", "Prêmio Total".

                        // Let's build a simpler grid that lists Options and allows selection.
                        // The stored 'CRUD' is the Strategy, not the chain.
                        return null;
                    })}
                </tbody>
            </table>

            {/* Re-implementing the 5-column grid which was approved logically */}
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 uppercase px-2 sticky top-0 bg-white z-10 py-2 border-b">
                    <div className="col-span-3 text-center">Action</div>
                    <div className="col-span-2 text-center">Type</div>
                    <div className="col-span-2 text-center">Strike</div>
                    <div className="col-span-2 text-right">Entry</div>
                    <div className="col-span-3 text-right">Exit</div>
                </div>

                {filteredChain.sort((a, b) => a.strike - b.strike).map(opt => {
                    const leg = getLeg(opt.symbol);
                    const isSelected = !!leg;

                    // Deduce Type from Symbol (A-L = Call, M-X = Put)
                    // Or we need a helper. Oplab API usually provides 'type' field but our mock/interface missed it?
                    // The mock used 'symbol' char. 
                    // Let's add a helper function or assume 'type' exists in OplabQuote (API returns it usually).
                    // I'll update Interface OplabQuote to have 'type' or derive it.
                    // For now, derive from letter: A-L Call, M-X Put.
                    const letter = opt.symbol.replace(/[0-9]/g, '').slice(-1); // PETR4A20 -> A
                    const type = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].includes(letter) ? 'CALL' : 'PUT';

                    // Fallback Entry
                    const fallbackEntry = opt.last || (opt.bid + opt.ask) / 2;

                    return (
                        <div key={opt.symbol} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border text-xs sm:text-sm ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            {/* Action Buttons */}
                            <div className="col-span-3 flex gap-1">
                                <button
                                    onClick={() => onToggleLeg(opt, 'COMPRA', type)}
                                    className={`flex-1 rounded py-1 font-bold transition-colors ${isSelected && leg?.operation === 'COMPRA' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                                >B</button>
                                <button
                                    onClick={() => onToggleLeg(opt, 'VENDA', type)}
                                    className={`flex-1 rounded py-1 font-bold transition-colors ${isSelected && leg?.operation === 'VENDA' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                                >S</button>
                            </div>

                            <div className={`col-span-2 text-center font-bold ${type === 'CALL' ? 'text-green-600' : 'text-red-600'}`}>
                                {type}
                            </div>

                            <div className="col-span-2 text-center font-mono font-bold">
                                {opt.strike.toFixed(2)}
                                {spotPrice && <div className="text-[9px] text-gray-400 font-normal">{(Math.abs(spotPrice - opt.strike) / spotPrice * 100).toFixed(1)}%</div>}
                            </div>

                            <div className="col-span-2 text-right">
                                {isSelected ? (
                                    <input
                                        type="number"
                                        className="w-full text-right bg-white border rounded px-1 py-0.5"
                                        value={leg!.entryPremium}
                                        onChange={e => onUpdateLeg(opt.symbol, { entryPremium: Number(e.target.value) })}
                                    />
                                ) : (
                                    <span className="text-gray-400">{fallbackEntry.toFixed(2)}</span>
                                )}
                            </div>

                            <div className="col-span-3 text-right">
                                {isSelected ? (
                                    <input
                                        type="number"
                                        className="w-full text-right bg-white border rounded px-1 py-0.5"
                                        placeholder="Target"
                                        value={leg!.exitPremium || ''}
                                        onChange={e => onUpdateLeg(opt.symbol, { exitPremium: Number(e.target.value) })}
                                    />
                                ) : (
                                    <span className="text-gray-300">---</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
