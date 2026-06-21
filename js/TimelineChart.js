export class TimelineChart {
    constructor(containerId) {
        this.containerId = containerId;
        // Margin convention used to ensure axes labels don't get cut off
        this.margin = { top: 35, right: 30, bottom: 55, left: 85 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data, selectedYear, activeMetric) {
        const node = d3.select(this.containerId).node();
        
        // This dynamically calculates the width exactly when the chart draws.
        // If the container is hidden (display: none), it defaults to 950px to prevent the 0px rendering bug.
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 950;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 280 - this.margin.top - this.margin.bottom;

        // Clear the old SVG completely before drawing the new one to prevent layering issues.
        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", totalWidth)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("display", "block")
            .style("margin", "0 auto")
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Create the scales for plotting data to pixels.
        this.xScale = d3.scaleTime().range([0, this.width]);
        this.xScaleBand = d3.scaleBand().range([0, this.width]).padding(0.3);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.colorScale = d3.scaleOrdinal().domain(["Camera Issued", "Police issued", "Other / Unspecified", "Unspecified"]).range(["#3B82F6", "#EF4444", "#94A3B8", "#94A3B8"]);
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.legendG = this.svg.append("g").attr("transform", `translate(${this.width - 280}, -20)`);
        
        //Append centered axis titles
        this.xTitle = this.svg.append("text").attr("x", centerX).attr("y", this.height + 42).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700");
        this.svg.append("text").attr("x", centerX).attr("y", this.height + 45).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Year");
        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -60).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Total Volume (Fines Logged)");

        // Group the raw data by Detection Method (Camera vs Police)
        const nested = d3.group(data, d => d.DETECTION_METHOD);
        const allYears = Array.from(new Set(data.map(d => d.YEAR))).sort(d3.ascending);

        // Build the Legend
        const legendData = ["Camera Issued", "Police Issued"];
        const legendColors = ["#3B82F6", "#EF4444"];
        legendData.forEach((label, i) => {
            const block = this.legendG.append("g").attr("transform", `translate(${i * 140}, 0)`);
            block.append("circle").attr("r", 5).attr("fill", legendColors[i]);
            block.append("text").attr("x", 12).attr("y", 4).text(label).attr("fill", "#475569").style("font-size", "11px").style("font-weight", "600");
        });

        // Because Unlicensed driving only has data for 2023/2024, a line chart looks broken.
        // We programmed an automatic switch to a Bar Chart if this metric is selected.
        if (activeMetric === "unlicensed_driving") {
            const barTotals = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.YEAR)
                .map(([year, val]) => ({ year: year.toString(), val }))
                .sort((a,b) => d3.ascending(a.year, b.year));

            if (barTotals.length === 0) return;

            this.xScaleBand.domain(barTotals.map(d => d.year));
            const peakBarVal = d3.max(barTotals, d => d.val) || 10;
            this.yScale.domain([0, peakBarVal * 1.15]);

            this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScaleBand));
            this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakBarVal]).tickFormat(d3.format(".2s")));

            const bars = this.svg.append("g").selectAll(".timeline-bar").data(barTotals, d => d.year);
            bars.enter().append("rect").attr("class", "timeline-bar chart-bar").attr("fill", "#EF4444")
                .attr("x", d => this.xScaleBand(d.year)).attr("y", this.height).attr("width", this.xScaleBand.bandwidth()).attr("height", 0)
                .on("mouseover", (e, d) => { 
                    this.tooltip.style("opacity", 1)
                        .html(`<strong>Year Frame: ${d.year}</strong>
                            <span style="color: #94A3B8; font-size: 0.78rem;">Fines Issued: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
                })
                .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
                .merge(bars).transition().duration(750)
                .attr("x", d => this.xScaleBand(d.year)).attr("width", this.xScaleBand.bandwidth())
                .attr("y", d => this.yScale(d.val)).attr("height", d => this.height - this.yScale(d.val))
                .attr("fill", d => d.year === selectedYear ? "#0F172A" : "#EF4444");

            // Append exact numbers above the bars (Data-to-ink ratio)
            this.svg.append("g").selectAll(".bar-direct-label").data(barTotals, d => d.year).enter()
                .append("text").attr("class", "bar-direct-label").attr("text-anchor", "middle")
                .attr("x", d => this.xScaleBand(d.year) + this.xScaleBand.bandwidth()/2).attr("y", d => this.yScale(d.val) - 6)
                .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
                .text(d => d.val > 0 ? d.val.toLocaleString() : "");
            return;
        }

        // Line Chart Path
        const allDates = allYears.map(yr => d3.timeParse("%Y")(yr));
        const linesData = Array.from(nested, ([method, values]) => {
            const trend = d3.rollups(values, v => d3.sum(v, d => +d.FINES || 0), d => d.YEAR)
                .map(([yr, sum]) => ({ date: d3.timeParse("%Y")(yr), yrStr: yr.toString(), val: sum, method }))
                .sort((a, b) => d3.ascending(a.date, b.date));
            return { method, trend };
        });

        if (allDates.length === 0) return;

        this.xScale.domain(d3.extent(allDates));
        const peakValue = d3.max(linesData, d => d3.max(d.trend, t => t.val)) || 10;
        this.yScale.domain([0, peakValue * 1.1]);

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale).ticks(8));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakValue / 2, peakValue]).tickFormat(d3.format(".2s")));

        // d3.curveMonotoneX makes the lines smooth instead of jagged straight angles
        const lineGen = d3.line().x(d => this.xScale(d.date)).y(d => this.yScale(d.val)).curve(d3.curveMonotoneX);

        const paths = this.svg.selectAll(".trend-path").data(linesData, d => d.method);
        
        const pathEnter = paths.enter().append("path")
            .attr("class", "trend-path trend-line")
            .attr("fill", "none")
            .attr("stroke", d => this.colorScale(d.method))
            .attr("d", d => lineGen(d.trend));
            
        // Stroke Dasharray animation to make the line "draw" itself on the screen
        pathEnter.each(function(d) {
            const length = this.getTotalLength();
            d3.select(this)
              .attr("stroke-dasharray", length + " " + length)
              .attr("stroke-dashoffset", length)
              .transition()
              .duration(1500) 
              .ease(d3.easeCubicOut)
              .attr("stroke-dashoffset", 0)
              .on("end", function() { d3.select(this).attr("stroke-dasharray", null); });
        });

        paths.transition().duration(750)
            .attr("d", d => lineGen(d.trend))
            .attr("stroke", d => selectedYear === "All" ? this.colorScale(d.method) : "#CBD5E1")
            .style("opacity", d => selectedYear === "All" ? 1 : 0.4);
            
        pathEnter
            .attr("stroke", d => selectedYear === "All" ? this.colorScale(d.method) : "#CBD5E1")
            .style("opacity", d => selectedYear === "All" ? 1 : 0.4);

        paths.exit().remove();

        const dots = this.svg.selectAll(".trend-dot").data(linesData.flatMap(d => d.trend), d => d.method + d.yrStr);
        dots.enter().append("circle").attr("class", "trend-dot")
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Method: ${d.method}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Year Frame: <span style="color: #FFF; font-weight: 500;">${d.yrStr}</span></span>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Fines Logged: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(dots).transition().duration(750)
            .attr("cx", d => this.xScale(d.date)).attr("cy", d => this.yScale(d.val))
            .attr("fill", d => d.yrStr === selectedYear ? this.colorScale(d.method) : (selectedYear === "All" ? this.colorScale(d.method) : "#E2E8F0"))
            .attr("r", d => d.yrStr === selectedYear ? 8.5 : (selectedYear === "All" ? 4 : 2));
        dots.exit().remove();
    }
}