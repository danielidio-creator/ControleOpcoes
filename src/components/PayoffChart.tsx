import React, { useMemo } from 'react';
import { Strategy, Leg } from '@/types';

interface PayoffChartProps {
    strategy: Strategy;
    currentPrice: number;
    width?: number;
    height?: number;
}

export function PayoffChart({ strategy, currentPrice, width = 400, height = 200 }: PayoffChartProps) {
    const data = useMemo(() => {
        if (!currentPrice) return [];

        // Calculate range: +/- 20% of spot, extended to include min/max strikes
        const strikes = strategy.legs.map(l => l.strike);
        const minStrike = Math.min(...strikes);
        const maxStrike = Math.max(...strikes);

        const minPrice = Math.min(currentPrice * 0.8, minStrike * 0.9);
        const maxPrice = Math.max(currentPrice * 1.2, maxStrike * 1.1);

        const steps = 50;
        const stepSize = (maxPrice - minPrice) / steps;

        const points = [];

        for (let i = 0; i <= steps; i++) {
            const spot = minPrice + (i * stepSize);
            let value = 0; // Liquidation value at spot

            strategy.legs.forEach(leg => {
                let legValue = 0;
                if (leg.type === 'CALL') {
                    legValue = Math.max(0, spot - leg.strike);
                } else {
                    legValue = Math.max(0, leg.strike - spot);
                }

                // If we own (COMPRA), value is positive. If we owe (VENDA), value is negative cost.
                const direction = leg.operation === 'COMPRA' ? 1 : -1;
                value += (legValue * leg.quantity * direction);
            });

            const pnl = value - (strategy.totalEntryPremium || 0);
            points.push({ spot, pnl });
        }

        return points;
    }, [strategy, currentPrice]);

    if (!currentPrice || data.length === 0) return <div className="text-xs text-slate-400">Sem dados para gráfico</div>;

    // Scaling
    const allPnl = data.map(d => d.pnl);
    const minPnl = Math.min(...allPnl);
    const maxPnl = Math.max(...allPnl);

    // Add padded Y range to avoid clipping
    const range = maxPnl - minPnl;
    const yPadding = range * 0.2 || 20; // Increased padding to 20%
    const yMin = minPnl - yPadding;
    const yMax = maxPnl + yPadding;

    const scaleX = (spot: number) => {
        const strikes = strategy.legs.map(l => l.strike);
        const minStrike = Math.min(...strikes);
        const maxStrike = Math.max(...strikes);

        const minSpot = Math.min(currentPrice * 0.8, minStrike * 0.9);
        const maxSpot = Math.max(currentPrice * 1.2, maxStrike * 1.1);

        return ((spot - minSpot) / (maxSpot - minSpot)) * width;
    };

    const scaleY = (pnl: number) => {
        // SVG Y is inverted (0 is top)
        // Map yMin to height, yMax to 0
        return height - ((pnl - yMin) / (yMax - yMin)) * height;
    };

    // Construct Path
    const pathD = data.map((d, i) => {
        const x = scaleX(d.spot);
        const y = scaleY(d.pnl);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    const zeroY = scaleY(0);
    const currentX = scaleX(currentPrice);

    // Unique Strikes (Sorted)
    const strikes = Array.from(new Set(strategy.legs.map(l => l.strike))).sort((a, b) => a - b);

    // Recalculate range for display
    const strikesList = strategy.legs.map(l => l.strike);
    const minS = Math.min(...strikesList);
    const maxS = Math.max(...strikesList);
    const dispMin = Math.min(currentPrice * 0.8, minS * 0.9);
    const dispMax = Math.max(currentPrice * 1.2, maxS * 1.1);

    return (
        <div className="relative border border-slate-100 rounded-lg bg-white p-2 w-full">
            <h4 className="text-[10px] font-bold text-slate-500 mb-1">Payoff (No Vencimento)</h4>
            <div className="w-full h-auto">
                <svg viewBox={`0 0 ${width} ${height + 35}`} className="w-full h-auto overflow-visible" preserveAspectRatio="xMidYMid meet">
                    {/* Zero Line (Breakeven P&L) */}
                    <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />

                    {/* Strikes Lines */}
                    {strikes.map((strike, idx) => {
                        const sx = scaleX(strike);
                        // Only draw if within view
                        if (sx < 0 || sx > width) return null;

                        // Stagger labels to avoid overlap
                        const isStaggered = idx % 2 === 1;
                        const labelY = height + 12 + (isStaggered ? 12 : 0);

                        return (
                            <g key={idx}>
                                <line x1={sx} y1={0} x2={sx} y2={height} stroke="#e2e8f0" strokeWidth="1" />
                                {/* Optional: Extend line slightly for staggered labels */}
                                {isStaggered && <line x1={sx} y1={height} x2={sx} y2={height + 5} stroke="#e2e8f0" strokeWidth="1" />}

                                <text x={sx} y={labelY} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">
                                    {strike.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Current Price Line */}
                    <line x1={currentX} y1={0} x2={currentX} y2={height} stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />

                    {/* Payoff Curve */}
                    <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />

                    {/* Current Price Dot */}
                    <circle cx={currentX} cy={scaleY(data.find(d => Math.abs(d.spot - currentPrice) < 0.1)?.pnl || 0)} r="3" fill="#2563eb" />
                </svg>
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-0 border-t border-slate-100 pt-2">
                <span>{dispMin.toFixed(1)}</span>
                <span className="text-blue-500 font-bold">{currentPrice.toFixed(2)} (Spot)</span>
                <span>{dispMax.toFixed(1)}</span>
            </div>
        </div>
    );
}
