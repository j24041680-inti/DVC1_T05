export class JurisdictionTrackingChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 25, right: 30, bottom: 65, left: 55 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data) {
        const node = d3.select(this.containerId).node();

        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 285 - this.margin.top - this.margin.bottom;

        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", totalWidth)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("display", "block")
            .style("margin", "0 auto")
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().range([0, this.width]).padding(0.6); 
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");

        this.svg.append("text").attr("x", centerX).attr("y", this.height + 45).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("State Code Jurisdiction");
        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -42).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Total Volume (Fines Logged)");
        
        // Setup Linear Gradient to give bars a premium, modern look
        const defs = this.svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("x1", "0%").attr("y1", "100%")
            .attr("x2", "0%").attr("y2", "0%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3B82F6"); 
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#60A5FA"); 

        // Group data by State
        const states = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.JURISDICTION)
            .map(([state, val]) => ({ state, val }))
            .sort((a,b) => d3.descending(a.val, b.val));

        if (states.length === 0) { 
            this.xAxisG.style("opacity",0); 
            this.yAxisG.style("opacity",0); 
            return; 
        }
        
        this.xAxisG.style("opacity",1); 
        this.yAxisG.style("opacity",1);

        this.xScale.domain(states.map(d => d.state));
        const peakValue = d3.max(states, d => d.val) || 10;
        this.yScale.domain([0, peakValue * 1.15]); // Add 15% headroom at the top of the chart so labels don't get cut off

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale));
        // Use d3.format(".1s") to format numbers cleanly (e.g. 1,500,000 -> 1.5M)
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakValue / 2, peakValue]).tickFormat(d3.format(".1s")));

        // Draw the gradient bars
        const bars = this.svg.selectAll(".chart-stem").data(states, d => d.state);
        bars.enter().append("rect").attr("class", "chart-stem").attr("fill", "url(#bar-gradient)")
            .attr("x", d => this.xScale(d.state)).attr("y", this.height).attr("width", this.xScale.bandwidth()).attr("height", 0)
            .attr("rx", 4) // Rounded Corners
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1).html(`<strong>State: ${d.state}</strong>
                       <span style="color: #94A3B8; font-size: 0.78rem;">Total Fines: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
                d3.select(e.currentTarget).style("filter", "brightness(1.15)");
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", (e) => {
                this.tooltip.style("opacity", 0);
                d3.select(e.currentTarget).style("filter", "none");
            })
            .merge(bars).transition().duration(750) // Smooth update transitions
            .attr("x", d => this.xScale(d.state)).attr("width", this.xScale.bandwidth())
            .attr("y", d => this.yScale(d.val)).attr("height", d => this.height - this.yScale(d.val));
        bars.exit().remove();

        // Draw a dark blue "cap" at the top of each bar for styling depth
        const caps = this.svg.selectAll(".chart-cap").data(states, d => d.state);
        caps.enter().append("rect").attr("class", "chart-cap").attr("fill", "#1E3A8A") 
            .attr("x", d => this.xScale(d.state) - 2).attr("y", this.height).attr("width", this.xScale.bandwidth() + 4).attr("height", 4)
            .attr("rx", 2)
            .style("pointer-events", "none") 
            .merge(caps).transition().duration(750)
            .attr("x", d => this.xScale(d.state) - 2).attr("width", this.xScale.bandwidth() + 4)
            .attr("y", d => this.yScale(d.val));
        caps.exit().remove();

        // Append explicit labels to eliminate need for background grid lines
        this.svg.selectAll(".state-direct-label").data(states, d => d.state).enter()
            .append("text").attr("class", "state-direct-label")
            .attr("x", d => this.xScale(d.state) + this.xScale.bandwidth()/2).attr("y", d => this.yScale(d.val) - 8)
            .attr("text-anchor", "middle").attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d3.format(".2s")(d.val) : "");
    }
}