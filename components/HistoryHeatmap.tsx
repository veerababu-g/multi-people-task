
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DailyStats } from '../types';

interface HistoryHeatmapProps {
  stats: DailyStats[];
}

const HistoryHeatmap: React.FC<HistoryHeatmapProps> = ({ stats }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || stats.length === 0) return;

    const margin = { top: 20, right: 10, bottom: 20, left: 30 };
    const width = 600 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const cellSize = 14;
    const colorScale = d3.scaleSequential(d3.interpolateGreens)
      .domain([0, 100]);

    // Simple implementation: show last 30 days
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dateStr = d.toISOString().split('T')[0];
      const stat = stats.find(s => s.date === dateStr);
      return {
        date: dateStr,
        value: stat ? stat.completionRate : 0,
        day: d.getDay(),
        week: Math.floor(i / 7)
      };
    });

    svg.selectAll("rect")
      .data(last30Days)
      .enter()
      .append("rect")
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("x", (d, i) => Math.floor(i / 7) * (cellSize + 4))
      .attr("y", (d) => d.day * (cellSize + 4))
      .attr("fill", (d) => d.value === 0 ? "#f1f5f9" : colorScale(d.value))
      .attr("rx", 2)
      .append("title")
      .text(d => `${d.date}: ${Math.round(d.value)}%`);

    // Add labels
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.selectAll(".dayLabel")
      .data(days)
      .enter()
      .append("text")
      .text(d => d)
      .attr("x", -20)
      .attr("y", (d, i) => i * (cellSize + 4) + 11)
      .attr("font-size", "10px")
      .attr("fill", "#64748b");

  }, [stats]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-600 mb-4 uppercase tracking-wider">30-Day Activity</h3>
      <svg ref={svgRef} className="w-full h-auto max-w-[600px]"></svg>
    </div>
  );
};

export default HistoryHeatmap;
