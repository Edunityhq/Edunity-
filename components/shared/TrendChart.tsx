import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  data: Array<Record<string, any>>;
  dataKey: string;
  xAxisKey: string;
  title?: string;
  height?: number;
}

export function TrendChart({
  data,
  dataKey,
  xAxisKey,
  title,
  height = 250,
}: TrendChartProps) {
  return (
    <div className="flex flex-col p-4 rounded-lg border border-ink-200 bg-white">
      {title && <h3 className="font-semibold text-sm text-ink-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey={xAxisKey}
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#dc2626"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
