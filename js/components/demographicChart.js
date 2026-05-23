// js/components/demographicChart.js
export class DemographicChart {
    constructor(containerId) {
        this.containerId = containerId;

        this.margin = { top: 10, right: 20, bottom: 40, left: 60 };
        this.width = d3.select(this.containerId).node().getBoundingClientRect().width - this.margin.left - this.margin.right || 400;
        this.height = 250 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().range([0, this.width]).padding(0.35);
        this.yScale = d3.scaleLinear().range([this.height, 0]);

        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
    }

    update(data) {
        // Group column records straight from your KNIME file outputs
        const demographicAnalysis = d3.rollups(data,
            v => d3.sum(v, d => +d.Infringement_Count || 0),
            d => d.Age_Group
        ).map(([key, value]) => ({ ageBracket: key, volume: value }))
         .filter(d => d.ageBracket && d.ageBracket !== "Unknown");

        this.xScale.domain(demographicAnalysis.map(d => d.ageBracket));
        this.yScale.domain([0, d3.max(demographicAnalysis, d => d.volume) * 1.1 || 10]);

        this.xAxisG.transition().duration(400).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(400).call(d3.axisLeft(this.yScale).tickFormat(d3.format(".2s")));

        this.svg.selectAll(".age-bar")
            .data(demographicAnalysis, d => d.ageBracket)
            .join("rect")
            .attr("class", "age-bar")
            .transition().duration(500)
            .attr("x", d => this.xScale(d.ageBracket))
            .attr("y", d => this.yScale(d.volume))
            .attr("width", this.xScale.bandwidth())
            .attr("height", d => this.height - this.yScale(d.volume))
            .attr("fill", "#1D3557");
    }
}