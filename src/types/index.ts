export type StrategyType = 'RENDA' | 'DIRECAO' | 'ROLAGEM' | 'VOLATILIDADE' | 'LATERAL';
export type StrategyStructure = 'THL' | 'IRON CONDOR' | 'COVERED CALL' | 'CASH SECURED PUT' | 'PUT BULL CREDIT' | 'PUT SPREAD' | 'CALL SPREAD' | 'SEAGULL';
export type OperationType = 'COMPRA' | 'VENDA';
export type OptionType = 'CALL' | 'PUT';

export interface Leg {
    optionTicker: string;
    type: OptionType;
    operation: OperationType;
    strike: number;
    dte?: number;
    quantity: number;
    entryPremium: number;
    exitPremium?: number;
    currentQuote?: number;
    // Enhanced Fields
    strategyType?: StrategyType;
    structure?: StrategyStructure;
    expiration?: string; // Date string YYYY-MM-DD
    // Oplab V3 Data
    parentSymbol?: string;
    impliedVolatility?: number;
    greeks?: {
        delta: number;
        gamma: number;
        vega: number;
        theta: number;
        rho: number;
        volatility?: number;
    };
    // Underlying Data
    underlyingPrice?: number;
    underlyingIv?: number;
    underlyingIvRank?: number; // iv_1y_rank or percentile
    percentToStrike?: number;
}

export interface Strategy {
    id: string; // Amplify ID
    ticker: string;
    type: StrategyType;
    structure?: StrategyStructure;
    status: 'Em Andamento' | 'Encerrada';
    legs: Leg[];
    totalEntryPremium?: number;
    percentToStrike?: number;
    createdAt: string;
    updatedAt: string;
    userEmail?: string;
    startDate?: string; // YYYY-MM-DD
    initialSpotPrice?: number;
}

// Oplab API Types
export interface OplabQuote {
    symbol: string;
    category: string;
    expiration: string;
    strike: number;
    bid: number;
    ask: number;
    last: number;
    close: number;
    change: number;
    volume: number;
    financial_volume: number;
    timestamp: string;
}
