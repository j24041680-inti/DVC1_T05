export class DetectionDonutChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.colorScale = d3.scaleOrdinal()
            .domain(["Camera Issued", "Police issued", "Other / Unspecified", "Unspecified"])
            .range(["#3B82F6", "#EF4444", "#94A3B8", "#94A3B8"]);
        this.tooltip = d3.select("#d3-tooltip");
    }

    recalculateWidthAndRender(data, metric, year) {
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450);
        this.height = 285; 
        this.radius = Math.min(this.width, 240) / 2 - 35;

        // We had issues with attrTween animations crashing on the server.
        // We replaced it by aggressively wiping the container clean and using a CSS fade-in instead.
        d3.select(this.containerId).html("");

        this.svgWrapper = d3.select(this.containerId).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("display", "block")
            .style("margin", "0 auto");

        this.mainGroup = this.svgWrapper.append("g")
            .attr("transform", `translate(${this.width / 2},${this.height / 2 - 40})`)
            .style("opacity", 0); // Start invisible for the fade effect

        this.legendG = this.mainGroup.append("g");

        this.update(data, metric, year);

        // Execute the master fade-in smoothly over 400ms
        this.mainGroup.transition()
            .duration(400)
            .style("opacity", 1);
    }

    update(data, metric, year) {
        // Calculate the sum of fines grouped by detection method
        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.DETECTION_METHOD)
            .map(([method, val]) => ({ method, val })).filter(d => d.val > 0);

        if (rollup.length === 0) return;

        // d3.pie() calculates the start and end angles for the pie slices
        const pie = d3.pie().value(d => d.val).sort(null);
        // d3.arc() actually draws the physical shapes based on those angles
        const arc = d3.arc().innerRadius(this.radius * 0.55).outerRadius(this.radius);
        // labelArc pushes the text out slightly further than the inner radius
        const labelArc = d3.arc().innerRadius(this.radius * 0.775).outerRadius(this.radius * 0.775);
        
        const pieData = pie(rollup);
        const total = d3.sum(rollup, d => d.val);

        const itemWidth = 130;
        const totalLegendWidth = rollup.length * itemWidth;

        // Smart dynamic legend generation
        rollup.forEach((d, i) => {
            const item = this.legendG.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${i * 135}, 0)`);
                
            item.append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", this.colorScale(d.method))
                .attr("rx", 2);
                
            item.append("text")
                .attr("x", 15)
                .attr("y", 9)
                .text(d.method.split(" ")[0] + " Issued")
                .style("font-size", "10px")
                .style("font-weight", "600")
                .attr("fill", "#64748B");
        });

        // Use getBBox() to find the exact width of the legend after it draws, so we can perfectly center it.
        const legendBBox = this.legendG.node().getBBox();
        this.legendG.attr("transform", `translate(${-legendBBox.width / 2}, ${240 / 2 - 5})`);

        // Draw the arcs instantly
        this.mainGroup.selectAll(".donut-slice")
            .data(pieData)
            .enter().append("path")
            .attr("class", "donut-slice donut-arc")
            .attr("fill", d => this.colorScale(d.data.method) || "#CBD5E1")
            .attr("d", arc)
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Method: ${d.data.method}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Segment Fines: <span style="color: #FFF; font-weight: 600;">${d.data.val.toLocaleString()}</span></span>`); 
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", () => this.tooltip.style("opacity", 0));

        // Plonk percentage labels directly into place
        this.mainGroup.selectAll(".donut-label")
            .data(pieData)
            .enter().append("text")
            .attr("class", "donut-label")
            .attr("transform", d => `translate(${labelArc.centroid(d)})`)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", "#FFFFFF")
            .style("font-size", "10px")
            .style("font-weight", "700")
            .text(d => {
                const pct = ((d.data.val / total) * 100).toFixed(0);
                return pct > 5 ? `${pct}%` : ""; // Only show label if it's big enough to fit text
            });

        // Dynamic Footnotes Setup based on the specific metric/year selected
        const policeData = rollup.find(d => d.method === "Police issued");
        const isFullPolice = policeData && (policeData.val / total) >= 0.99;
        
        let lines = [];
        if (isFullPolice) {
            lines = [
                "* Note: 100% Police issuance reflects the historical absence",
                "of recorded automated camera enforcement for this selection."
            ];
        } else if (metric === "speed_fines" && year < 2017) {
            lines = [
                "* Note: National automated camera enforcement data for Speeding",
                "was not systematically aggregated until the 2017 collection cycle."
            ];
        } else if (metric === "mobile_phone_use" && year < 2020) {
            lines = [
                "* Note: Automated phone camera detection technology was not",
                "nationally recorded in the underlying matrix until 2020."
            ];
        } else if (metric === "unlicensed_driving" && year === 2024) {
            lines = [
                "* Note: 2024 method logging parameters are currently undergoing",
                "administrative re-categorization to separate missing entries."
            ];
        }

        if (lines.length > 0) {
            const footnoteText = this.mainGroup.append("text")
                .attr("class", "donut-footnote")
                .attr("x", 0)
                .attr("y", this.radius + 68) 
                .attr("text-anchor", "middle")
                .attr("fill", "#64748B")
                .style("font-size", "9.5px")
                .style("font-style", "italic");

            lines.forEach((lineText, index) => {
                footnoteText.append("tspan")
                    .attr("x", 0)
                    .attr("dy", index === 0 ? "0" : "14px") 
                    .text(lineText);
            });
        }
    }
}