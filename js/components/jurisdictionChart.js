// js/components/jurisdictionChart.js
export class JurisdictionChart {
    constructor(containerId, clickCallback) {
        this.containerId = containerId;
        this.onSelectionTrigger = clickCallback;

        this.margin = { top: 10, right: 30, bottom: 30, left: 60 };
        this.width = d3.select(this.containerId).node().getBoundingClientRect().width - this.margin.left - this.margin.right || 400;
        this.height = 250 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([0, this.height]).padding(0.25);

        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
    }

    update(data, activeState) {
        // Rollup calculation targeted to your derived normalization metrics
        const summaryData = d3.rollups(data,
            v => d3.mean(v, d => +d.Fines_Per_10000_Licences || 0),
            d => d.Jurisdiction
        ).map(([key, value]) => ({ state: key, rate: Math.round(value) }))
         .sort((a, b) => d3.descending(a.rate, b.rate));

        this.xScale.domain([0, d3.max(summaryData, d => d.rate) * 1.05 || 10]);
        this.yScale.domain(summaryData.map(d => d.state));

        this.xAxisG.transition().duration(400).call(d3.axisBottom(this.xScale).ticks(5));
        this.yAxisG.transition().duration(400).call(d3.axisLeft(this.yScale));

        // Geometric bar rendering with explicit active tracking palette logic
        this.svg.selectAll(".bar")
            .data(summaryData, d => d.state)
            .join("rect")
            .attr("class", "bar")
            .style("cursor", "pointer")
            .on("click", (event, d) => this.onSelectionTrigger(d.state))
            .transition().duration(500)
            .attr("x", 0)
            .attr("y", d => this.yScale(d.state))
            .attr("width", d => this.xScale(d.rate))
            .attr("height", this.yScale.bandwidth())
            .attr("fill", d => (activeState === "All" || d.state === activeState) ? "#17A2B8" : "#CED4DA");
    }
}// js/components/jurisdictionChart.js
export class JurisdictionChart {
    constructor(containerId, clickCallback) {
        this.containerId = containerId;
        this.onSelectionTrigger = clickCallback;

        this.margin = { top: 10, right: 30, bottom: 30, left: 60 };
        this.width = d3.select(this.containerId).node().getBoundingClientRect().width - this.margin.left - this.margin.right || 400;
        this.height = 250 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([0, this.height]).padding(0.25);

        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
    }

    update(data, activeState) {
        // Rollup calculation targeted to your derived normalization metrics
        const summaryData = d3.rollups(data,
            v => d3.mean(v, d => +d.Fines_Per_10000_Licences || 0),
            d => d.Jurisdiction
        ).map(([key, value]) => ({ state: key, rate: Math.round(value) }))
         .sort((a, b) => d3.descending(a.rate, b.rate));

        this.xScale.domain([0, d3.max(summaryData, d => d.rate) * 1.05 || 10]);
        this.yScale.domain(summaryData.map(d => d.state));

        this.xAxisG.transition().duration(400).call(d3.axisBottom(this.xScale).ticks(5));
        this.yAxisG.transition().duration(400).call(d3.axisLeft(this.yScale));

        // Geometric bar rendering with explicit active tracking palette logic
        this.svg.selectAll(".bar")
            .data(summaryData, d => d.state)
            .join("rect")
            .attr("class", "bar")
            .style("cursor", "pointer")
            .on("click", (event, d) => this.onSelectionTrigger(d.state))
            .transition().duration(500)
            .attr("x", 0)
            .attr("y", d => this.yScale(d.state))
            .attr("width", d => this.xScale(d.rate))
            .attr("height", this.yScale.bandwidth())
            .attr("fill", d => (activeState === "All" || d.state === activeState) ? "#17A2B8" : "#CED4DA");
    }
}