'use server';

import {
    fetchOptionDetails,
    fetchStockDetails,
    fetchBlackScholes,
    fetchInterestRate
} from "@/app/actions/oplab";
import { OplabQuote } from "@/types";

// Helper to calculate mid price or use last
function getMarkPrice(quote: OplabQuote): number {
    if (quote.last && quote.last > 0) return quote.last;
    if (quote.bid > 0 && quote.ask > 0) return (quote.bid + quote.ask) / 2;
    // Fallback? Close?
    return quote.close || 0;
}

export async function fetchStrategyMarketData(tickers: string[]) {
    // Unique tickers
    const uniqueTickers = Array.from(new Set(tickers));

    // We can use fetchOptionDetails for each. 
    // Ideally Oplab has a bulk endpoint, but we'll loop parallel for now.
    // If we have many strategies, this might be slow/rate-limited.

    const results: Record<string, number> = {};
    const stockResults: Record<string, number> = {}; // Parent prices

    // Batch fetch options
    await Promise.all(uniqueTickers.map(async (ticker) => {
        // Optimization: Try to distinguish option vs stock?
        // Usually assume inputs are options unless specified.
        // Or just try fetchOptionDetails.

        try {
            const data = await fetchOptionDetails(ticker);
            if (data && !data.error) {
                results[ticker] = getMarkPrice(data as OplabQuote);

                // Also capture parent price if needed?
                // StrategyList already fetches parents separately.
                // But we could optimize.
            }
        } catch (e) {
            console.error(`Failed to fetch premium for ${ticker}`, e);
            results[ticker] = 0;
        }
    }));

    return results;
}
