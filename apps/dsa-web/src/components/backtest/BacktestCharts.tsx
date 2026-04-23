import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '../common';
import type { PerformanceMetrics, BacktestResultItem, TimelinePoint } from '../../types/backtest';

// ============ Types ============

interface BacktestChartsProps {
  overallPerf: PerformanceMetrics | null;
  results: BacktestResultItem[];
  timeline: TimelinePoint[];
}

// ============ Helpers ============

function fmt(v: number | null | undefined, decimals = 1): string {
  return v == null ? '--' : `${v.toFixed(decimals)}%`;
}

// ============ Chart 1: Outcome Distribution Pie ============

const OUTCOME_COLORS = { win: '#22c55e', loss: '#ef4444', neutral: '#94a3b8' };

const OutcomeChart: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  const total = metrics.winCount + metrics.lossCount + metrics.neutralCount;
  if (total === 0) {
    return (
      <EmptyState title="No outcome data" className="h-40 border-dashed bg-transparent shadow-none" />
    );
  }

  const data = [
    { name: 'Win', value: metrics.winCount, color: OUTCOME_COLORS.win },
    { name: 'Loss', value: metrics.lossCount, color: OUTCOME_COLORS.loss },
    { name: 'Neutral', value: metrics.neutralCount, color: OUTCOME_COLORS.neutral },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={48}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value} (${((value / total) * 100).toFixed(1)}%)`,
            name,
          ]}
          contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '0.75rem' }}
        />
        <Legend
          formatter={(value) => <span className="text-xs text-secondary-text">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ============ Chart 2: Return Distribution Histogram ============

const BINS = [
  { label: '< -5%', min: -Infinity, max: -5 },
  { label: '-5~-2%', min: -5, max: -2 },
  { label: '-2~0%', min: -2, max: 0 },
  { label: '0~2%', min: 0, max: 2 },
  { label: '2~5%', min: 2, max: 5 },
  { label: '> 5%', min: 5, max: Infinity },
];

function binReturns(items: BacktestResultItem[]) {
  const counts = BINS.map((b) => ({ label: b.label, count: 0, positive: b.min >= 0 }));
  for (const item of items) {
    const v = item.simulatedReturnPct;
    if (v == null) continue;
    const idx = BINS.findIndex((b) => v >= b.min && v < b.max);
    if (idx >= 0) counts[idx].count++;
  }
  return counts;
}

const ReturnDistributionChart: React.FC<{ results: BacktestResultItem[] }> = ({ results }) => {
  const data = binReturns(results.filter((r) => r.evalStatus === 'completed'));
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <EmptyState title="No return data" className="h-40 border-dashed bg-transparent shadow-none" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: -10, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} allowDecimals={false} />
        <Tooltip
          formatter={(v: number) => [v, 'Count']}
          contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '0.75rem' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.positive ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ============ Chart 3: Monthly Win Rate Timeline ============

const TimelineChart: React.FC<{ timeline: TimelinePoint[] }> = ({ timeline }) => {
  if (timeline.length === 0) {
    return (
      <EmptyState title="No timeline data" description="Run backtests across multiple months to see trends." className="h-40 border-dashed bg-transparent shadow-none" />
    );
  }

  const data = timeline.map((p) => ({
    month: p.month,
    winRate: p.winRatePct,
    dirAcc: p.directionAccuracyPct,
    count: p.totalCompleted,
    avgReturn: p.avgSimulatedReturnPct,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ left: -10, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} />
        <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} unit="%" />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} allowDecimals={false} />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'Evaluations') return [value, name];
            return [`${value?.toFixed(1)}%`, name];
          }}
          contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '0.75rem' }}
        />
        <Legend formatter={(v) => <span className="text-xs text-secondary-text">{v}</span>} />
        <ReferenceLine yAxisId="pct" y={50} stroke="var(--color-border)" strokeDasharray="4 4" />
        <Bar yAxisId="count" dataKey="count" name="Evaluations" fill="var(--color-border)" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
        <Line yAxisId="pct" type="monotone" dataKey="winRate" name="Win Rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line yAxisId="pct" type="monotone" dataKey="dirAcc" name="Dir. Accuracy" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} connectNulls strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ============ Chart 4: Accuracy vs Win Rate Bar ============

const AccuracyVsWinChart: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  const data = [
    {
      name: 'Overall',
      dirAccuracy: metrics.directionAccuracyPct ?? null,
      winRate: metrics.winRatePct ?? null,
    },
  ];

  const hasData = data[0].dirAccuracy != null || data[0].winRate != null;
  if (!hasData) {
    return (
      <EmptyState title="No accuracy data" className="h-40 border-dashed bg-transparent shadow-none" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: -10, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-muted-text)' }} unit="%" />
        <Tooltip
          formatter={(v: number, name: string) => [`${v?.toFixed(1)}%`, name]}
          contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '0.75rem' }}
        />
        <Legend formatter={(v) => <span className="text-xs text-secondary-text">{v}</span>} />
        <ReferenceLine y={50} stroke="var(--color-border)" strokeDasharray="4 4" />
        <Bar dataKey="dirAccuracy" name="Dir. Accuracy" fill="#38bdf8" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
        <Bar dataKey="winRate" name="Win Rate" fill="#22c55e" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ============ Section Header ============

const ChartSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-xl border border-white/5 bg-card/40 p-4">
    <div className="mb-3">
      <span className="label-uppercase">{title}</span>
      {subtitle && <p className="mt-0.5 text-xs text-muted-text">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ============ Main Component ============

const BacktestCharts: React.FC<BacktestChartsProps> = ({ overallPerf, results, timeline }) => {
  if (!overallPerf && results.length === 0 && timeline.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-in space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {overallPerf && (
          <ChartSection title="Outcome Distribution" subtitle={`W ${overallPerf.winCount} / L ${overallPerf.lossCount} / N ${overallPerf.neutralCount}`}>
            <OutcomeChart metrics={overallPerf} />
          </ChartSection>
        )}
        {results.length > 0 && (
          <ChartSection title="Return Distribution" subtitle={`Simulated return spread across ${results.filter(r => r.evalStatus === 'completed').length} completed evaluations`}>
            <ReturnDistributionChart results={results} />
          </ChartSection>
        )}
      </div>

      <ChartSection title="Monthly Win Rate Trend" subtitle="Win rate % and evaluation count per calendar month">
        <TimelineChart timeline={timeline} />
      </ChartSection>

      {overallPerf && (
        <ChartSection
          title="Direction Accuracy vs Win Rate"
          subtitle={`Dir. Accuracy ${fmt(overallPerf.directionAccuracyPct)} · Win Rate ${fmt(overallPerf.winRatePct)} · Avg Sim. Return ${fmt(overallPerf.avgSimulatedReturnPct)}`}
        >
          <AccuracyVsWinChart metrics={overallPerf} />
        </ChartSection>
      )}
    </div>
  );
};

export default BacktestCharts;
