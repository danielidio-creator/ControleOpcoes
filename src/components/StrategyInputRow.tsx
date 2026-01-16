import { useState, useEffect } from 'react';
import { Leg, OperationType, OptionType, StrategyType, StrategyStructure } from '@/types';
import { fetchOptionDetails, fetchStockDetails, fetchBlackScholes } from '@/app/actions/oplab';

interface StrategyInputRowProps {
    index: number;
    leg: Leg;
    onChange: (index: number, updates: Partial<Leg>) => void;
    viewMode: 'CREATE' | 'EDIT';
}

export function StrategyInputRow({ index, leg, onChange, viewMode }: StrategyInputRowProps) {
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'VALID' | 'ERROR'>('IDLE');

    // Fetch data logic
    useEffect(() => {
        let active = true;

        async function loadData() {
            // Basic validity check
            if (leg.optionTicker.length < 4) return;

            // If we already have deep data (e.g. greeks), maybe skip fetching unless ticker changed?
            // For now, let's allow re-fetching to ensure freshness, especially in CREATE mode.
            // In EDIT mode, we might want to preserve saved values initially? 
            // But Oplab data is market data, so refreshing is good.

            setStatus('LOADING');

            // 1. Get Option Details (V3)
            const details = await fetchOptionDetails(leg.optionTicker);

            if (!active) return;
            if (!details || details.error) {
                setStatus('ERROR');
                return;
            }

            setStatus('VALID');

            const updates: Partial<Leg> = {
                parentSymbol: details.parent_symbol,
                currentQuote: details.last || details.close || details.bid || 0,
                expiration: details.due_date ? details.due_date.split('T')[0] : undefined,
                strike: details.strike,
                type: details.category as OptionType,
            };

            // 2. Fetch Underlying Data (If parent exists)
            if (details.parent_symbol) {
                const stockData = await fetchStockDetails(details.parent_symbol);
                if (stockData && active) {
                    updates.underlyingPrice = stockData.close || stockData.last;
                    updates.underlyingIv = stockData.iv_current;
                    updates.underlyingIvRank = stockData.iv_1y_rank; // or percentile

                    // Calculate % to Strike
                    if (updates.strike && updates.underlyingPrice) {
                        // (Strike / Spot) - 1
                        updates.percentToStrike = ((updates.strike / updates.underlyingPrice) - 1) * 100;
                    }
                }
            }

            // 3. Fetch Greeks (Black Scholes)
            if (details.spot_price && details.strike && details.days_to_maturity) {
                // Use stored entry premium if available, else current quote for BS?
                // BS usually uses current market price (premium) to calc IV.
                // Or uses IV to calc Theoretical Price.
                // Oplab BS endpoint likely iterates to find IV from Premium.
                const bs = await fetchBlackScholes({
                    symbol: leg.optionTicker,
                    spotPrice: details.spot_price,
                    strike: details.strike,
                    daysToMaturity: details.days_to_maturity,
                    type: details.category,
                    premium: updates.currentQuote
                });

                if (bs && active) {
                    updates.impliedVolatility = bs.volatility;
                    updates.greeks = {
                        delta: bs.delta,
                        gamma: bs.gamma,
                        vega: bs.vega,
                        theta: bs.theta,
                        rho: bs.rho
                    };
                }
            }

            onChange(index, updates);
        }

        const timeout = setTimeout(loadData, 800);
        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [leg.optionTicker]);

    // Styles
    const labelStyle = "text-[9px] text-slate-500 font-bold uppercase block mb-1 tracking-wide";
    const inputStyle = "w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all";
    const readOnlyStyle = "w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-500 outline-none cursor-default";
    const selectStyle = "w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-500";

    // Helper to format % to strike color
    const getPercentColor = (val?: number) => {
        if (!val) return 'text-slate-500';
        if (Math.abs(val) < 1) return 'text-orange-600 font-bold'; // ATM
        return val > 0 ? 'text-green-600' : 'text-red-600';
    };

    return (
        <div className={`flex flex-col p-3 border-b transition-colors gap-2 ${status === 'ERROR' ? 'bg-red-50 border-red-200' : 'border-slate-200 hover:bg-slate-50'}`}>

            {/* --- LINE 1: USER INPUTS --- */}
            <div className="grid grid-cols-12 gap-3 items-end">
                {/* 1. Ativo */}
                <div className="col-span-2">
                    <label className={labelStyle}>Ativo</label>
                    <input
                        type="text"
                        value={leg.optionTicker}
                        onChange={(e) => onChange(index, { optionTicker: e.target.value.toUpperCase() })}
                        className={`${inputStyle} font-bold uppercase ${status === 'ERROR' ? 'border-red-500 text-red-600' : ''}`}
                        placeholder="PETR..."
                    />
                </div>

                {/* 2. Ação */}
                <div className="col-span-2">
                    <label className={labelStyle}>Ação</label>
                    <select
                        value={leg.operation}
                        onChange={(e) => onChange(index, { operation: e.target.value as OperationType })}
                        className={`${selectStyle} font-bold ${leg.operation === 'COMPRA' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-red-600 bg-red-50 border-red-200'}`}
                    >
                        <option value="COMPRA">COMPRA</option>
                        <option value="VENDA">VENDA</option>
                    </select>
                </div>

                {/* 3. Qtd */}
                <div className="col-span-2">
                    <label className={labelStyle}>Quantidade</label>
                    <input
                        type="number"
                        value={leg.quantity}
                        onChange={(e) => onChange(index, { quantity: parseInt(e.target.value) || 0 })}
                        className={`${inputStyle} text-right font-mono`}
                    />
                </div>

                {/* 4. Entry Premium (Show in Create & Edit) */}
                <div className="col-span-2">
                    <label className={labelStyle}>Prêmio</label>
                    <input
                        type="number"
                        value={leg.entryPremium || ''}
                        onChange={(e) => onChange(index, { entryPremium: parseFloat(e.target.value) || 0 })}
                        className={`${inputStyle} text-right font-mono ${viewMode === 'EDIT' ? 'bg-slate-50' : 'bg-white'}`}
                        placeholder="0.00"
                    />
                </div>

                {/* 5. Exit Premium (Show Only in Edit) */}
                {viewMode === 'EDIT' ? (
                    <div className="col-span-2">
                        <label className={labelStyle}>Prêmio Saída</label>
                        <input
                            type="number"
                            value={leg.exitPremium ?? ''}
                            onChange={(e) => onChange(index, { exitPremium: parseFloat(e.target.value) || 0 })}
                            className={`${inputStyle} text-right font-mono bg-white border-blue-300 focus:border-blue-500`}
                            placeholder="0.00"
                        />
                    </div>
                ) : (
                    // Spacer for Create Mode to align
                    <div className="col-span-2"></div>
                )}

                {/* 6. Spacer/Status */}
                <div className="col-span-2 flex items-center justify-end text-[10px] text-slate-300 italic pr-2 pb-2">
                    {/* Placeholder or small status text */}
                    {status === 'LOADING' && 'Fetching...'}
                </div>

            </div>

            {/* --- LINE 2: API AUTO DATA + STOCK INFO --- */}
            <div className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 p-2 rounded border border-slate-100/50">
                {/* 1. Tipo */}
                <div className="col-span-2">
                    <label className={labelStyle}>Tipo</label>
                    <div className={readOnlyStyle}>{leg.type || '-'}</div>
                </div>

                {/* 2. Strike */}
                <div className="col-span-2">
                    <label className={labelStyle}>Strike</label>
                    <div className={readOnlyStyle}>{leg.strike ? leg.strike.toFixed(2) : '-'}</div>
                </div>

                {/* 3. Vencimento */}
                <div className="col-span-3">
                    <label className={labelStyle}>Vencimento</label>
                    <div className={readOnlyStyle}>{leg.expiration || '-'}</div>
                </div>

                {/* 4. Underlying Info (Expanded) */}
                <div className="col-span-5 flex gap-2">
                    {/* Parent Symbol */}
                    <div className="flex-1">
                        <label className={labelStyle}>Parent</label>
                        <div className={`${readOnlyStyle} font-bold text-slate-700`}>{leg.parentSymbol || '-'}</div>
                    </div>

                    {/* Spot Price */}
                    <div className="flex-1">
                        <label className={labelStyle}>Preço</label>
                        <div className={readOnlyStyle}>{leg.underlyingPrice ? leg.underlyingPrice.toFixed(2) : '-'}</div>
                    </div>

                    {/* % Strike */}
                    <div className="flex-1">
                        <label className={labelStyle}>% Strike</label>
                        <div className={`${readOnlyStyle} ${getPercentColor(leg.percentToStrike)}`}>
                            {leg.percentToStrike ? leg.percentToStrike.toFixed(1) + '%' : '-'}
                        </div>
                    </div>

                    {/* IV / Rank */}
                    <div className="flex-1">
                        <label className={labelStyle}>IV Rank</label>
                        <div className={readOnlyStyle} title={`Current IV: ${leg.underlyingIv?.toFixed(1)}%`}>
                            {leg.underlyingIvRank ? leg.underlyingIvRank.toFixed(0) : '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- LINE 3: GREEKS --- */}
            {leg.greeks ? (
                <div className="flex items-center bg-white border border-slate-200 rounded px-3 py-2 shadow-sm">
                    <div className="flex gap-4 text-[10px] font-mono text-slate-600 w-full justify-between">
                        <span title="Delta" className="flex items-center gap-1"><span className="font-bold text-slate-400">Δ</span> <span className="text-slate-800">{leg.greeks.delta?.toFixed(3)}</span></span>
                        <span title="Gamma" className="flex items-center gap-1"><span className="font-bold text-slate-400">Γ</span> {leg.greeks.gamma?.toFixed(3)}</span>
                        <span title="Theta" className="flex items-center gap-1"><span className="font-bold text-slate-400">Θ</span> {leg.greeks.theta?.toFixed(3)}</span>
                        <span title="Vega" className="flex items-center gap-1"><span className="font-bold text-slate-400">ν</span> {leg.greeks.vega?.toFixed(3)}</span>
                        <span title="Rho" className="flex items-center gap-1"><span className="font-bold text-slate-400">ρ</span> {leg.greeks.rho?.toFixed(3)}</span>
                        <div className="border-l pl-4 border-slate-200">
                            <span title="Implied Volatility" className="font-bold text-purple-600">IV {leg.impliedVolatility?.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[34px] bg-slate-50 rounded border border-slate-100 flex items-center justify-center text-[10px] text-slate-300 italic">
                    {status === 'LOADING' ? 'Calculating Greeks...' : 'Greeks will appear here'}
                </div>
            )}
        </div>
    );
}
