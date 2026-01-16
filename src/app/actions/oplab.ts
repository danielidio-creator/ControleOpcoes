'use server'

import { OplabQuote } from "@/types";

const OPLAB_API_KEY = process.env.OPLAB_API_KEY;
const API_BASE_V3 = "https://api.oplab.com.br/v3";
const API_BASE_V1 = "https://api.oplab.com.br/v1";

if (!OPLAB_API_KEY) {
    console.warn("OPLAB_API_KEY is not defined in environment variables.");
}

// Helper for V3 fetch
async function fetchV3(endpoint: string, cacheSeconds = 60) {
    try {
        const response = await fetch(`${API_BASE_V3}${endpoint}`, {
            headers: { "Access-Token": OPLAB_API_KEY || "" },
            next: { revalidate: cacheSeconds },
        });
        if (!response.ok) {
            console.error(`Oplab V3 Error: ${response.status} for ${endpoint}`);
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error(`Fetch error for ${endpoint}:`, e);
        return null;
    }
}

// 1. Validate Asset / Get Details
export async function fetchOptionDetails(symbol: string) {
    if (!symbol) return null;
    if (!OPLAB_API_KEY) return mockDetails(symbol);

    const data = await fetchV3(`/market/options/details/${symbol}`, 300);
    return data;
}

// 4. Validate Stock / Get Underlying Details
export async function fetchStockDetails(symbol: string) {
    if (!symbol) return null;
    if (!OPLAB_API_KEY) return mockStockDetails(symbol);

    const data = await fetchV3(`/market/stocks/${symbol}?with_financials=true`, 300);
    return data;
}

// 2. Interest Rates (SELIC)
export async function fetchInterestRate() {
    if (!OPLAB_API_KEY) return 0.12;

    const data = await fetchV3('/market/interest_rates', 3600);
    if (Array.isArray(data)) {
        const selic = data.find((r: any) => r.uid === 'SELIC');
        return selic ? selic.value : 0.10;
    }
    return 0.10;
}

// 3. Black-Scholes
export async function fetchBlackScholes(params: {
    symbol: string;
    spotPrice: number;
    strike: number;
    daysToMaturity: number;
    type: string;
    premium?: number;
}) {
    if (!OPLAB_API_KEY) return mockGreeks();

    const rate = await fetchInterestRate();

    // Convert rate to what Oplab expects if needed (usually % in docs examples)
    const qs = new URLSearchParams({
        symbol: params.symbol,
        irate: rate.toString(),
        type: params.type,
        spotprice: params.spotPrice.toString(),
        strike: params.strike.toString(),
        dtm: params.daysToMaturity.toString(),
    });

    if (params.premium) {
        qs.append('premium', params.premium.toString());
    }

    const data = await fetchV3(`/market/options/bs?${qs.toString()}`, 10);
    return data;
}


// --- Legacy V1 / Mocks ---

export async function fetchMarketData(ticker: string): Promise<OplabQuote | null> {
    if (!ticker) return null;
    try {
        const response = await fetch(`${API_BASE_V1}/market/stock/${ticker}`, {
            headers: { "Access-Token": OPLAB_API_KEY || "" },
            next: { revalidate: 60 },
        });
        if (!response.ok) return null;
        return await response.json() as OplabQuote;
    } catch (error) {
        return null;
    }
}

// Mocks
function mockDetails(symbol: string) {
    return {
        symbol: symbol,
        parent_symbol: symbol.substring(0, 4),
        category: symbol.includes('A') || symbol.includes('B') || symbol.includes('C') ? 'CALL' : 'PUT',
        strike: 30.00,
        spot_price: 29.50,
        days_to_maturity: 20,
        due_date: '2026-02-20',
        variation: 0.5,
        last: 0.75
    };
}

function mockStockDetails(symbol: string) {
    return {
        symbol: symbol,
        close: 29.50,
        previous_close: 29.00,
        iv_current: 25.5,
        iv_1y_rank: 45.0,
        iv_1y_percentile: 50.0
    };
}

function mockGreeks() {
    return {
        delta: 0.5,
        gamma: 0.1,
        theta: -0.05,
        vega: 0.02,
        rho: 0.01,
        volatility: 25.5
    };
}
