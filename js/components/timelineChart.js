// js/components/timelineChart.js
export class TimelineChart {
    constructor(containerId) {
        this.containerId = containerId;
        
        this.margin = { top: 20, right: 30, bottom: 40, left: 60 };
        this.width = d3.select(this.containerId).node().getBoundingClientRect().width - this.margin.left - this.margin.right || 700;
        this.height = 300 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleTime().range([0, this.width]);
        this.yScale = d3.scaleLinear().range([this.height, 0]);

        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        
        // Path container instantiation
        this.path = this.svg.append("path").attr("class", "trend-line");
    }

    update(data, activeStateFilter) {
        // Dynamic analytical map aggregation by Year
        const nestedData = d3.rollups(data, 
            v => d3.sum(v, d => +d.Infringement_Count || 0),
            d => d.Year
        ).map(([year, sum]) => ({ date: d3.timeParse("%Y")(year), count: sum }))
         .sort((a, b) => d3.ascending(a.date, b.date));

        if (nestedData.length === 0) return;

        this.xScale.domain(d3.extent(nestedData, d => d.date));
        this.yScale.domain([0, d3.max(nestedData, d => d.count) * 1.1 || 100]);

        this.xAxisG.transition().duration(400).call(d3.axisBottom(this.xScale).ticks(d3.timeYear.every(1)));
        this.yAxisG.transition().duration(400).call(d3.axisLeft(this.yScale).tickFormat(d3.format(",d")));

        const lineGenerator = d3.line()
            .x(d => this.xScale(d.date))
            .y(d => this.yScale(d.count))
            .curve(d3.curveMonotoneX); // Clean anti-aliased visual pathing

        // Render line graph seamlessly via enter-update-exit mechanics
        this.path.datum(nestedData)
            .transition().duration(500)
            .attr("d", lineGenerator)
            .attr("fill", "none")
            .attr("stroke", "#1D3557");

        // Interactive tooltips configuration
        const circles = this.svg.selectAll(".dot")
            .data(nestedData, d => d.date);

        circles.join("circle")
            .attr("class", "dot")
            .attr("fill", "#E63946")
            .attr("r", 5)
            .transition().duration(500)
            .attr("cx", d => this.xScale(d.date))
            .attr("cy", d => this.yScale(d.count));
    }
}