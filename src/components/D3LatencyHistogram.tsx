import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Sliders,
  RefreshCw,
  Flame,
  HelpCircle,
  Maximize2,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Latency24hPoint } from '../types/prodx';

interface D3LatencyHistogramProps {
  samples?: Latency24hPoint[];
  slaThresholdMs?: number;
  onRefresh?: () => Promise<void>;
  isChaosElevated?: boolean;
}

export const D3LatencyHistogram: React.FC<D3LatencyHistogramProps> = ({
  samples: propSamples,
  slaThresholdMs = 60,
  onRefresh,
  isChaosElevated = false,
}) => {
  const [internalSamples, setInternalSamples] = useState<Latency24hPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PEAK_ONLY' | 'OFF_PEAK'>('ALL');
  const [binResolution, setBinResolution] = useState<number>(20);
  const [showCdfCurve, setShowCdfCurve] = useState<boolean>(true);
  const [activeSlaTarget, setActiveSlaTarget] = useState<number>(slaThresholdMs);
  const [hoveredBin, setHoveredBin] = useState<{
    x0: number;
    x1: number;
    count: number;
    percentage: number;
    avgRps: number;
    sampleCount: number;
    items: Latency24hPoint[];
    xPos: number;
    yPos: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);

  // Fetch from /api/telemetry/latency-24h if propSamples is empty or needs refresh
  const fetch24hData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/telemetry/latency-24h');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.samples)) {
          setInternalSamples(data.samples);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch 24h latency telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (propSamples && propSamples.length > 0) {
      setInternalSamples(propSamples);
    } else {
      fetch24hData();
    }
  }, [propSamples]);

  // Keep responsive width in sync
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filtered dataset
  const activeDataset = useMemo(() => {
    if (internalSamples.length === 0) return [];
    if (selectedFilter === 'PEAK_ONLY') {
      return internalSamples.filter((s) => s.isPeakHour);
    }
    if (selectedFilter === 'OFF_PEAK') {
      return internalSamples.filter((s) => !s.isPeakHour);
    }
    return internalSamples;
  }, [internalSamples, selectedFilter]);

  // Statistical calculations
  const stats = useMemo(() => {
    if (activeDataset.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        slaCompliancePct: 100,
        breachCount: 0,
      };
    }

    const values = activeDataset.map((s) => s.p95LatencyMs).sort((a, b) => a - b);
    const count = values.length;
    const mean = d3.mean(values) ?? 0;
    const median = d3.median(values) ?? 0;
    const p95 = d3.quantile(values, 0.95) ?? 0;
    const p99 = d3.quantile(values, 0.99) ?? 0;
    const min = d3.min(values) ?? 0;
    const max = d3.max(values) ?? 0;
    const stdDev = d3.deviation(values) ?? 0;

    const breachCount = values.filter((v) => v > activeSlaTarget).length;
    const slaCompliancePct = Number((((count - breachCount) / count) * 100).toFixed(1));

    return {
      count,
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      p95: Math.round(p95 * 10) / 10,
      p99: Math.round(p99 * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      slaCompliancePct,
      breachCount,
    };
  }, [activeDataset, activeSlaTarget]);

  // Render D3 Histogram using SVG
  useEffect(() => {
    if (!svgRef.current || activeDataset.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 35, right: 55, bottom: 45, left: 55 };
    const width = Math.max(320, containerWidth) - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const values = activeDataset.map((d) => d.p95LatencyMs);
    const minVal = Math.max(0, Math.floor((d3.min(values) ?? 0) * 0.8));
    const maxVal = Math.ceil(Math.max((d3.max(values) ?? 80), activeSlaTarget * 1.25) * 1.05);

    // X Scale: Latency (ms)
    const xScale = d3.scaleLinear().domain([minVal, maxVal]).range([0, width]).nice();

    // D3 Bin Generator
    const histogram = d3
      .bin<Latency24hPoint, number>()
      .value((d) => d.p95LatencyMs)
      .domain(xScale.domain() as [number, number])
      .thresholds(xScale.ticks(binResolution));

    const bins = histogram(activeDataset);

    // Y Scale (Left): Frequency count
    const maxFreq = d3.max(bins, (d) => d.length) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxFreq * 1.15])
      .range([height, 0])
      .nice();

    // Secondary Y Scale (Right): Cumulative Percent (0 - 100%)
    const yCdfScale = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Color mapper based on SLA thresholds
    const getBarColor = (val: number) => {
      if (val < 25) return '#10b981'; // Emerald (ultra fast)
      if (val < activeSlaTarget * 0.75) return '#06b6d4'; // Cyan (healthy)
      if (val <= activeSlaTarget) return '#f59e0b'; // Amber (approaching SLA)
      return '#f43f5e'; // Rose/Red (SLA breach)
    };

    // Background horizontal gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '3 3')
      .attr('opacity', 0.8);

    g.select('.grid .domain').remove();

    // Bars
    const barGroups = g
      .selectAll('.bar')
      .data(bins)
      .enter()
      .append('g')
      .attr('class', 'bar')
      .attr('cursor', 'pointer');

    barGroups
      .append('rect')
      .attr('x', (d) => xScale(d.x0 ?? 0) + 1)
      .attr('width', (d) => Math.max(1, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 2))
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', (d) => {
        const midVal = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        return getBarColor(midVal);
      })
      .attr('opacity', 0.85)
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => yScale(d.length))
      .attr('height', (d) => height - yScale(d.length));

    // Interaction triggers on bars
    barGroups
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .select('rect')
          .attr('opacity', 1)
          .attr('stroke', '#0f172a')
          .attr('stroke-width', 1.5);

        const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
        const avgRps =
          d.length > 0
            ? Math.round((d.reduce((sum, item) => sum + item.rps, 0) / d.length) * 10) / 10
            : 0;

        setHoveredBin({
          x0: Math.round((d.x0 ?? 0) * 10) / 10,
          x1: Math.round((d.x1 ?? 0) * 10) / 10,
          count: d.length,
          percentage: Number(((d.length / activeDataset.length) * 100).toFixed(1)),
          avgRps,
          sampleCount: d.length,
          items: d.slice(0, 5),
          xPos: mouseX,
          yPos: mouseY,
        });
      })
      .on('mouseleave', function () {
        d3.select(this)
          .select('rect')
          .attr('opacity', 0.85)
          .attr('stroke', 'none');
        setHoveredBin(null);
      });

    // Top counts on bars if count > 0 and width is wide enough
    barGroups
      .filter((d) => d.length > 0 && xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) > 14)
      .append('text')
      .attr('x', (d) => (xScale(d.x0 ?? 0) + xScale(d.x1 ?? 0)) / 2)
      .attr('y', (d) => yScale(d.length) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', '#64748b')
      .text((d) => d.length);

    // Optional CDF Cumulative S-Curve Overlay
    if (showCdfCurve) {
      let cumulative = 0;
      const cdfData: Array<{ latency: number; cumulativePct: number }> = [
        { latency: minVal, cumulativePct: 0 },
      ];

      for (const b of bins) {
        cumulative += b.length;
        cdfData.push({
          latency: b.x1 ?? 0,
          cumulativePct: (cumulative / activeDataset.length) * 100,
        });
      }

      const lineGen = d3
        .line<{ latency: number; cumulativePct: number }>()
        .x((d) => xScale(d.latency))
        .y((d) => yCdfScale(d.cumulativePct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(cdfData)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', lineGen);

      // Points along CDF
      g.selectAll('.cdf-dot')
        .data(cdfData.filter((_, idx) => idx % 2 === 0))
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.latency))
        .attr('cy', (d) => yCdfScale(d.cumulativePct))
        .attr('r', 2.5)
        .attr('fill', '#6366f1')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
    }

    // Reference Line: Mean p95
    if (stats.mean > 0 && stats.mean <= maxVal) {
      const meanX = xScale(stats.mean);
      const meanLine = g.append('g').attr('class', 'ref-mean');

      meanLine
        .append('line')
        .attr('x1', meanX)
        .attr('x2', meanX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#0284c7')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3');

      meanLine
        .append('rect')
        .attr('x', meanX - 28)
        .attr('y', -24)
        .attr('width', 56)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', '#0284c7');

      meanLine
        .append('text')
        .attr('x', meanX)
        .attr('y', -13)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .attr('font-family', 'monospace')
        .text(`μ ${stats.mean}ms`);
    }

    // Reference Line: Median (p50 of p95)
    if (stats.median > 0 && stats.median <= maxVal) {
      const medX = xScale(stats.median);
      const medLine = g.append('g').attr('class', 'ref-median');

      medLine
        .append('line')
        .attr('x1', medX)
        .attr('x2', medX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#059669')
        .attr('stroke-width', 1.5);

      medLine
        .append('rect')
        .attr('x', medX - 32)
        .attr('y', -24)
        .attr('width', 64)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', '#059669');

      medLine
        .append('text')
        .attr('x', medX)
        .attr('y', -13)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .attr('font-family', 'monospace')
        .text(`Med ${stats.median}ms`);
    }

    // Reference Line: SLA Breach Boundary
    if (activeSlaTarget <= maxVal) {
      const slaX = xScale(activeSlaTarget);
      const slaGroup = g.append('g').attr('class', 'ref-sla');

      slaGroup
        .append('line')
        .attr('x1', slaX)
        .attr('x2', slaX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#e11d48')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5 4');

      slaGroup
        .append('rect')
        .attr('x', slaX - 35)
        .attr('y', -24)
        .attr('width', 70)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', '#e11d48');

      slaGroup
        .append('text')
        .attr('x', slaX)
        .attr('y', -13)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .attr('font-family', 'monospace')
        .text(`SLA ${activeSlaTarget}ms`);
    }

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(10, Math.floor(width / 60)))
      .tickFormat((d) => `${d}ms`);

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', '#cbd5e1');
    xAxisGroup.selectAll('.tick line').attr('stroke', '#cbd5e1');
    xAxisGroup
      .selectAll('.tick text')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .attr('font-weight', '600');

    // X Axis Label
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 36)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#475569')
      .text('Observed p95 API Latency (Milliseconds, ms)');

    // Y Axis (Left: Intervals Count)
    const yAxis = d3.axisLeft(yScale).ticks(5);
    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup.selectAll('.tick line').remove();
    yAxisGroup
      .selectAll('.tick text')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .attr('font-weight', '600');

    // Y Axis Label (Left)
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -42)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#64748b')
      .text('5-Min Telemetry Intervals');

    // Y Axis (Right: CDF Cumulative %)
    if (showCdfCurve) {
      const yAxisCdf = d3
        .axisRight(yCdfScale)
        .ticks(5)
        .tickFormat((d) => `${d}%`);
      const yCdfGroup = g
        .append('g')
        .attr('transform', `translate(${width}, 0)`)
        .call(yAxisCdf);
      yCdfGroup.select('.domain').remove();
      yCdfGroup.selectAll('.tick line').remove();
      yCdfGroup
        .selectAll('.tick text')
        .attr('font-family', 'monospace')
        .attr('font-size', '10px')
        .attr('fill', '#6366f1')
        .attr('font-weight', '600');

      // Right Label
      g.append('text')
        .attr('transform', 'rotate(90)')
        .attr('y', -width - 45)
        .attr('x', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#6366f1')
        .text('Cumulative % (CDF)');
    }
  }, [activeDataset, containerWidth, binResolution, showCdfCurve, activeSlaTarget, stats]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm overflow-hidden">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  24-Hour p95 Latency Distribution Histogram
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  D3.js Binned Engine
                </span>
                {isChaosElevated && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3" />
                    Chaos Drift Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Parametric frequency distribution across 288 consecutive 5-minute telemetry intervals.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Histogram Filters & Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter: Peak vs Off-Peak */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              All 24h ({internalSamples.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('PEAK_ONLY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedFilter === 'PEAK_ONLY'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              Peak Hours
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('OFF_PEAK')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedFilter === 'OFF_PEAK'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              Off-Peak
            </button>
          </div>

          {/* CDF S-Curve Toggle */}
          <button
            type="button"
            onClick={() => setShowCdfCurve(!showCdfCurve)}
            title="Toggle Cumulative Distribution Function (CDF) percentile curve"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showCdfCurve
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>CDF Curve</span>
          </button>

          {/* Bin Resolution Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 uppercase font-bold">Bins:</span>
            <select
              value={binResolution}
              onChange={(e) => setBinResolution(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
            >
              <option value={12}>12 Buckets</option>
              <option value={20}>20 Buckets</option>
              <option value={30}>30 Buckets</option>
              <option value={45}>45 Fine</option>
            </select>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={async () => {
              await fetch24hData();
              if (onRefresh) await onRefresh();
            }}
            disabled={isLoading}
            title="Reload 24h telemetry samples"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Statistical Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Mean p95 (μ)
          </div>
          <div className="text-xl font-black font-mono text-sky-700 tabular-nums mt-0.5">
            {stats.mean}
            <span className="text-xs font-sans text-slate-400 font-medium ml-1">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Avg tail latency</div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Median (p50 of p95)
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 tabular-nums mt-0.5">
            {stats.median}
            <span className="text-xs font-sans text-slate-400 font-medium ml-1">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">50th percentile</div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            95th Percentile
          </div>
          <div className="text-xl font-black font-mono text-amber-700 tabular-nums mt-0.5">
            {stats.p95}
            <span className="text-xs font-sans text-slate-400 font-medium ml-1">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">p95 of p95</div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Worst Spike (Max)
          </div>
          <div
            className={`text-xl font-black font-mono tabular-nums mt-0.5 ${
              stats.max > activeSlaTarget ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {stats.max}
            <span className="text-xs font-sans text-slate-400 font-medium ml-1">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Peak outlier</div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Std Deviation (σ)
          </div>
          <div className="text-xl font-black font-mono text-slate-700 tabular-nums mt-0.5">
            ±{stats.stdDev}
            <span className="text-xs font-sans text-slate-400 font-medium ml-1">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Variance spread</div>
        </div>

        <div
          className={`p-3.5 border rounded-xl ${
            stats.slaCompliancePct >= 99
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
              : stats.slaCompliancePct >= 95
              ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
              : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
            SLA Compliance
          </div>
          <div className="text-xl font-black font-mono tabular-nums mt-0.5 flex items-baseline gap-1">
            <span>{stats.slaCompliancePct}%</span>
            <span className="text-[10px] font-sans font-bold opacity-80">
              (&lt;{activeSlaTarget}ms)
            </span>
          </div>
          <div className="text-[10px] opacity-80 font-medium">
            {stats.breachCount === 0
              ? 'Zero SLA breaches'
              : `${stats.breachCount} breach intervals`}
          </div>
        </div>
      </div>

      {/* Main D3 SVG Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          width={containerWidth}
          height={260}
          className="w-full overflow-visible"
        />

        {/* Hover Tooltip Float */}
        {hoveredBin && (
          <div
            className="absolute z-20 pointer-events-none p-3.5 bg-slate-900/95 text-white border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md font-mono text-xs max-w-xs transition-all duration-75"
            style={{
              left: `${Math.min(hoveredBin.xPos + 15, containerWidth - 230)}px`,
              top: `${Math.max(10, hoveredBin.yPos - 90)}px`,
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-800 text-[11px]">
              <span className="font-bold text-amber-400">
                {hoveredBin.x0}ms – {hoveredBin.x1}ms
              </span>
              <span className="text-[10px] text-slate-400 font-sans font-semibold">
                {hoveredBin.percentage}% of 24h
              </span>
            </div>

            <div className="pt-2 space-y-1 font-sans text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Sample Count:</span>
                <span className="font-mono font-bold text-white">
                  {hoveredBin.count} intervals ({(hoveredBin.count * 5)} mins)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg Concurrency:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {hoveredBin.avgRps} req/s
                </span>
              </div>
              {hoveredBin.x1 > activeSlaTarget && (
                <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-bold pt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Exceeds {activeSlaTarget}ms SLA Threshold</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend & SLA Configuration Slider */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
        {/* Tier Legend */}
        <div className="flex flex-wrap items-center gap-4 text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <span>&lt;25ms (Sub-Millisecond Speed)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500 shrink-0" />
            <span>25–{Math.round(activeSlaTarget * 0.75)}ms (Optimal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>{Math.round(activeSlaTarget * 0.75)}–{activeSlaTarget}ms (Nominal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
            <span>&gt;{activeSlaTarget}ms (SLA Breach)</span>
          </div>
        </div>

        {/* Dynamic SLA Target Setter */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">
            SLA Target:
          </span>
          <div className="flex items-center gap-1 font-mono">
            {[45, 60, 80, 100].map((threshold) => (
              <button
                key={threshold}
                type="button"
                onClick={() => setActiveSlaTarget(threshold)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeSlaTarget === threshold
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {threshold}ms
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
