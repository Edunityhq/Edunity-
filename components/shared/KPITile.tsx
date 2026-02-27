import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface KPITileProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function KPITile({
  label,
  value,
  unit,
  change,
  changeType = 'neutral',
  icon,
  onClick,
  className,
}: KPITileProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col p-4 rounded-lg border border-ink-200 bg-white hover:border-ink-300 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-ink-500">{label}</span>
        {icon && <div className="text-ink-400">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-ink-900">{value}</span>
        {unit && <span className="text-sm text-ink-500">{unit}</span>}
      </div>

      {change !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            changeType === 'positive' && 'text-green-600',
            changeType === 'negative' && 'text-red-600',
            changeType === 'neutral' && 'text-ink-500'
          )}
        >
          {changeType === 'positive' && <ArrowUp className="w-3 h-3" />}
          {changeType === 'negative' && <ArrowDown className="w-3 h-3" />}
          <span>{Math.abs(change)}% vs last month</span>
        </div>
      )}
    </div>
  );
}
