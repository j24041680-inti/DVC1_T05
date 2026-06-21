export class LocationDotPlotChart {
    constructor(containerId) {
        this.containerId = containerId;
        // Notice the large left margin (140) to accommodate long Y-axis text labels
        this.margin = { top: 25, right: 40, bottom: 65, left: 140 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data, currentJurisdiction) {
        const node = d3.select(this.containerId).node();
        
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 500;

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

        // This is a horizontal chart, so the X-axis handles numbers (Linear) 
        // and the Y-axis handles the categories (Band)    
        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([0, this.height]).padding(1); 
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis dot-y-axis"); 

        this.svg.append("text").attr("x", centerX).attr("y", -10).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Regional Volume Density (Fines Logged)");

        const footnoteText = this.svg.append("text")
            .attr("class", "donut-footnote")
            .attr("x", centerX)
            .attr("y", this.height + 45) 
            .attr("text-anchor", "middle")
            .attr("fill", "#64748B")
            .style("font-size", "9.5px")
            .style("font-style", "italic");

        const lines = [
            "* Note: ASGS spatial remoteness area classifications are exclusive parameters introduced in the 2023 restructuring.",
            "Historical reporting indices mapped between 2008 and 2022 do not contain localized regional breakdowns."
        ];

        lines.forEach((lineText, index) => {
            footnoteText.append("tspan")
                .attr("x", centerX)
                .attr("dy", index === 0 ? "0" : "14px")
                .text(lineText);
        });

        // Strip out the redundant "All regions" data point
        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.LOCATION)
            .map(([zone, val]) => ({ zone, val }))
            .filter(d => d.zone !== "All regions" && d.val > 0)
            .sort((a,b) => d3.descending(a.val, b.val)); 

        // If a state doesn't have remoteness data, we display a human-readable 
        // error message directly inside the SVG canvas instead of throwing an error.
        if (rollup.length === 0) { 
            this.xAxisG.style("opacity",0); 
            this.yAxisG.style("opacity",0); 
            this.svg.selectAll(".placeholder-msg-node").data([null]).join("text")
                .attr("class", "placeholder-msg-node")
                .attr("x", centerX).attr("y", this.height / 2)
                .attr("text-anchor", "middle").attr("fill", "#94A3B8")
                .style("font-size", "13px").style("font-weight", "600")
                .text(`🗺️ Remoteness breakdown is not explicitly tracked for jurisdiction: (${currentJurisdiction})`);
            return; 
        }

        this.xAxisG.style("opacity",1); 
        this.yAxisG.style("opacity",1);

        const peakWidth = d3.max(rollup, d => d.val) || 10;
        this.xScale.domain([0, peakWidth * 1.15]); 
        // Clean strings: Remove the redundant word "Australia" from the labels so they fit nicely
        this.yScale.domain(rollup.map(d => d.zone.replace(" Australia", ""))); 

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale).tickValues([0, peakWidth / 2, peakWidth]).tickFormat(d3.format(".2s")));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale));

        // Hide the thick black domain line on the Y axis for a cleaner look
        this.svg.selectAll(".dot-y-axis path").style("display", "none"); 
        this.svg.selectAll(".dot-y-axis line").style("display", "none"); 

        // A dot plot uses a horizontal line (stem) and a circle (dot) to mark the value
        const linesSelection = this.svg.selectAll(".dot-line").data(rollup, d => d.zone);
        linesSelection.enter().append("line").attr("class", "dot-line")
            .attr("stroke", "#E2E8F0").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4") // Dashed Line styling
            .attr("x1", 0).attr("x2", this.width).attr("y1", d => this.yScale(d.zone.replace(" Australia", ""))).attr("y2", d => this.yScale(d.zone.replace(" Australia", "")))
            .merge(linesSelection).transition().duration(750)
            .attr("y1", d => this.yScale(d.zone.replace(" Australia", ""))).attr("y2", d => this.yScale(d.zone.replace(" Australia", "")));

        const dots = this.svg.selectAll(".dot-circle").data(rollup, d => d.zone);
        dots.enter().append("circle").attr("class", "dot-circle")
            .attr("fill", "#059669") 
            .attr("stroke", "#FFFFFF").attr("stroke-width", 2)
            .attr("r", 8)
            .attr("cx", 0).attr("cy", d => this.yScale(d.zone.replace(" Australia", "")))
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Remoteness Area: ${d.zone}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Fines Total: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
                d3.select(e.currentTarget).attr("r", 11).attr("fill", "#10B981").style("filter", "drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))");
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", (e) => { 
                this.tooltip.style("opacity", 0);
                d3.select(e.currentTarget).attr("r", 8).attr("fill", "#059669").style("filter", "none");
            })
            .merge(dots).transition().duration(750).ease(d3.easeCubicOut)
            .attr("cy", d => this.yScale(d.zone.replace(" Australia", ""))).attr("cx", d => this.xScale(d.val));

        // Exact labels above the dots
        this.svg.selectAll(".dot-direct-label").data(rollup, d => d.zone).enter()
            .append("text").attr("class", "dot-direct-label")
            .attr("x", d => this.xScale(d.val)).attr("y", d => this.yScale(d.zone.replace(" Australia", "")) - 12)
            .attr("text-anchor", "middle")
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d.val.toLocaleString() : "0");
    }
}