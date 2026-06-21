export class DemographicLollipopChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 35, right: 30, bottom: 85, left: 65 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data) {
        const node = d3.select(this.containerId).node();
        
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 800;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;

        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", totalWidth)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("display", "block")  
            .style("margin", "0 auto") 
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().range([0, this.width]).paddingInner(1).paddingOuter(0.5); 
        this.yScale = d3.scaleLinear().range([this.height, 0]); 
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");

        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -50).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Enforcement Volume (Fines)");
        
        this.svg.append("text").attr("x", this.width / 2).attr("y", this.height + 40).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Age Groups");

        const footnoteText = this.svg.append("text")
            .attr("class", "donut-footnote")
            .attr("x", centerX)
            .attr("y", this.height + 65) 
            .attr("text-anchor", "middle")
            .attr("fill", "#64748B")
            .style("font-size", "9.5px")
            .style("font-style", "italic");

        const lines = [
            "* Note: Detailed age profiling matrices were not tracked nationally",
            "prior to the 2023 collection era; data represents modern parameters only."
        ];

        lines.forEach((lineText, index) => {
            footnoteText.append("tspan")
                .attr("x", centerX)
                .attr("dy", index === 0 ? "0" : "13px")
                .text(lineText);
        });

        // because age brackets are ordinal (they must be in a specific order),
        // we map the data explicitly to this array rather than letting it sort alphabetically.
        const structuralAgeBands = ["0-16", "17-25", "26-39", "40-59", "60-64", "65 and over"];
        const profileMap = d3.rollup(data, v => d3.sum(v, d => +d.FINES || 0), d => d.AGE_GROUP);
        let profiles = structuralAgeBands.map(bracket => ({ bracket, val: profileMap.get(bracket) || 0 }));

        profiles.sort((a, b) => d3.descending(a.val, b.val));
        this.xScale.domain(profiles.map(d => d.bracket));

        if (d3.sum(profiles, d => d.val) === 0) { 
            this.xAxisG.style("opacity",0); 
            this.yAxisG.style("opacity",0); 
            return; 
        }

        this.xAxisG.style("opacity",1); this.yAxisG.style("opacity",1);
        
        const peakValue = d3.max(profiles, d => d.val) || 10;
        this.yScale.domain([0, peakValue * 1.15]); 

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakValue/2, peakValue]).tickFormat(d3.format(".2s")));

        // A Lollipop chart reduces "ink" compared to thick bar charts.
        // It uses an SVG <line> as the stem, and an SVG <circle> as the top cap.
        const linesSelection = this.svg.selectAll(".lollipop-line").data(profiles, d => d.bracket);
        linesSelection.enter().append("line").attr("class", "lollipop-line")
            .attr("stroke", "#CBD5E1").attr("stroke-width", 2)
            .attr("x1", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("x2", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("y1", this.height).attr("y2", this.height) // Start at the bottom for animation 
            .merge(linesSelection).transition().duration(750)
            .attr("x1", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("x2", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("y1", this.height).attr("y2", d => this.yScale(d.val)); // Animate height up

        const circles = this.svg.selectAll(".lollipop-circle").data(profiles, d => d.bracket);
        circles.enter().append("circle").attr("class", "lollipop-circle")
            .attr("fill", "#6366F1")
            .attr("stroke", "#FFFFFF").attr("stroke-width", 2) // White stroke separates it from the line
            .attr("r", 7)
            .attr("cx", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("cy", this.height) 
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Age Cluster: ${d.bracket}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Fines Total: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
                // Hover effect: Increase radius and add a CSS drop-shadow filter
                d3.select(e.currentTarget).attr("r", 9).attr("fill", "#4F46E5").style("filter", "drop-shadow(0 0 4px rgba(99, 102, 241, 0.6))");
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", (e) => { 
                this.tooltip.style("opacity", 0);
                d3.select(e.currentTarget).attr("r", 7).attr("fill", "#6366F1").style("filter", "none");
            })
            .merge(circles).transition().duration(750).ease(d3.easeCubicOut)
            .attr("cx", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("cy", d => this.yScale(d.val));

        // Direct numeric labeling above the circle
        this.svg.selectAll(".bar-direct-label").data(profiles, d => d.bracket).enter()
            .append("text").attr("class", "bar-direct-label")
            .attr("x", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("y", d => this.yScale(d.val) - 12)
            .attr("text-anchor", "middle") 
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d3.format(".2s")(d.val) : "0");
    }
}