import { Leg } from '@/types';
import { StrategyInputRow } from './StrategyInputRow';

interface StrategyInputGridProps {
    legs: Leg[];
    onChange: (legs: Leg[]) => void;
    viewMode: 'CREATE' | 'EDIT';
}

export function StrategyInputGrid({ legs, onChange, viewMode }: StrategyInputGridProps) {

    const handleLegChange = (index: number, updates: Partial<Leg>) => {
        const newLegs = [...legs];
        newLegs[index] = { ...newLegs[index], ...updates };
        onChange(newLegs);
    };

    return (
        <div className="space-y-4">
            {legs.map((leg, index) => (
                <StrategyInputRow
                    key={index}
                    index={index}
                    leg={leg}
                    onChange={handleLegChange}
                    viewMode={viewMode}
                />
            ))}
        </div>
    );
}
