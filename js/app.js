// ==========================================================================
// 🚀 ACCESSIBLE ROAD SAFETY COMPLIANCE PLATFORM - CENTRAL HUB CONTROLLER
// ==========================================================================

let masterDataset = [];
let chartInstances = {};

const appState = {
    currentCategory: "mobile_phone_use",
    selectedJurisdiction: "All",
    selectedYear: "All"
};

// Data pipeline reads cleanly relative to index.html position layout
d3.csv("data/police_enforcement_2024_fines.csv").then(data => {
    masterDataset = data;
    initializeDashboardHub();
}).catch(err => console.error("❌ CRITICAL: CSV resource ingestion failure:", err));

function initializeDashboardHub() {
    chartInstances.timeline = new TimelineChart("#timeline-chart");
    chartInstances.donut = new DetectionDonutChart("#detection-donut-chart");
    chartInstances.jurisdictions = new JurisdictionBarChart("#jurisdiction-bar-chart");
    chartInstances.demographics = new DemographicBarChart("#demographic-bar-chart");
    chartInstances.locationChart = new LocationGroupedChart("#spatial-grouped-chart"); 

    // Sidebar Tabs Event Handler
    d3.selectAll(".sidebar-nav .nav-tab").on("click", function() {
        d3.selectAll(".sidebar-nav .nav-tab").classed("active", false);
        d3.select(this).classed("active", true);

        const targetPage = d3.select(this).attr("data-target");
        const category = d3.select(this).attr("data-category");

        d3.selectAll(".page-view").classed("active", false);
        d3.select(`#${targetPage}`).classed("active", true);

        if (targetPage === "page-dashboard") {
            appState.currentCategory = category;
            dispatchDataUpdate();
        }
    });

    d3.select("#filter-state").on("change", function() {
        appState.selectedJurisdiction = d3.select(this).property("value");
        dispatchDataUpdate();
    });

    d3.select("#filter-year").on("change", function() {
        appState.selectedYear = d3.select(this).property("value");
        dispatchDataUpdate();
    });

    dispatchDataUpdate();
}

function dispatchDataUpdate() {
    const timelineData = masterDataset.filter(d => {
        const matchCategory = d.METRIC === appState.currentCategory;
        const matchState    = appState.selectedJurisdiction === "All" || d.JURISDICTION === appState.selectedJurisdiction;
        return matchCategory && matchState;
    });

    const filteredSlice = masterDataset.filter(d => {
        const matchCategory = d.METRIC === appState.currentCategory;
        const matchState    = appState.selectedJurisdiction === "All" || d.JURISDICTION === appState.selectedJurisdiction;
        const matchYear     = appState.selectedYear === "All" || d.YEAR === appState.selectedYear;
        return matchCategory && matchState && matchYear;
    });

    const metricLabels = { 
        mobile_phone_use: "Mobile Phone Distractions", 
        speed_fines: "Speeding Infringements", 
        non_wearing_seatbelts: "Seatbelt Violations", 
        unlicensed_driving: "Unlicensed Driving" 
    };
    
    if (appState.currentCategory === "unlicensed_driving") {
        d3.select("#dynamic-trend-title").text(`${metricLabels[appState.currentCategory]} - Historical Distribution Comparison`);
    } else {
        d3.select("#dynamic-trend-title").text(`${metricLabels[appState.currentCategory]} - Camera vs. Police Trends`);
    }

    chartInstances.timeline.update(timelineData, appState.selectedYear, appState.currentCategory);

    // 🚀 FIXED GRID REARRANGEMENT LOGIC: Smoothly resizes columns and scales components with no empty holes!
    if (appState.selectedJurisdiction !== "All") {
        d3.select("#jurisdiction-grid-item").style("display", "none");
        d3.select("#donut-grid-item").attr("class", "full-width-box"); // Expand to take 100% width
    } else {
        d3.select("#jurisdiction-grid-item").style("display", "block");
        d3.select("#donut-grid-item").attr("class", "half-width-box"); // Revert back to 50% split width
        chartInstances.jurisdictions.update(filteredSlice);
    }

    // Force internal dimensions recalculation and centering loops instantly
    chartInstances.donut.recalculateWidthAndRender(filteredSlice);

    const isHistorical = appState.selectedYear !== "All" && parseInt(appState.selectedYear) < 2023;
    const isUnlicensedHistorical = appState.currentCategory === "unlicensed_driving" && isHistorical;

    if (isUnlicensedHistorical) {
        d3.select("#unlicensed-warning-banner").style("display", "block");
        d3.select("#timeline-chart").style("display", "none");
    } else {
        d3.select("#unlicensed-warning-banner").style("display", "none");
        d3.select("#timeline-chart").style("display", "block");
    }

    if (isHistorical) {
        d3.select("#advanced-metrics-grid").style("display", "none");
    } else {
        d3.select("#advanced-metrics-grid").style("display", "block");
        
        chartInstances.demographics.update(filteredSlice);
        updateSeverityTable(filteredSlice); 
        chartInstances.locationChart.update(filteredSlice, appState.selectedJurisdiction); 
    }

    const totalVolume = d3.sum(filteredSlice, d => +d.FINES || 0);
    d3.select("#kpi-total-volume")
      .transition().duration(1000)
      .tween("text", function() {
          const i = d3.interpolate(parseInt(this.textContent.replace(/,/g, '')) || 0, totalVolume);
          return function(t) { this.textContent = Math.round(i(t)).toLocaleString() + " Fines Issued"; };
      });
}

// 🚀 FIXED SEVERITY TABLE: Status column completely deleted from data parser logic
function updateSeverityTable(data) {
    const arrests = d3.sum(data, d => +d.ARRESTS || 0);
    const charges = d3.sum(data, d => +d.CHARGES || 0);

    const tbody = d3.select("#severity-table-body").html("");

    const rowData = [
        { cat: "Judicial Court Charges Filed", val: charges },
        { cat: "Physical Custody Arrests Executed", val: arrests }
    ];

    rowData.forEach(r => {
        const row = tbody.append("tr");
        row.append("td").html(`<strong>${r.cat}</strong>`);
        row.append("td").style("font-family", "monospace").style("font-size", "1.1rem").style("font-weight", "700").text(r.val.toLocaleString());
    });
}

// ==========================================================================
// 📊 GRAPH RE-RENDERING ENGINE CLASSES (D3 CANVAS)
// ==========================================================================

class TimelineChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 35, right: 30, bottom: 55, left: 85 };
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 950) - this.margin.left - this.margin.right;
        this.height = 280 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId).html("").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleTime().range([0, this.width]);
        this.xScaleBand = d3.scaleBand().range([0, this.width]).padding(0.3);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.colorScale = d3.scaleOrdinal().domain(["Camera Issued", "Police issued", "Other / Unspecified", "Unspecified"]).range(["#3B82F6", "#EF4444", "#94A3B8", "#94A3B8"]);
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.tooltip = d3.select("#d3-tooltip");
        this.legendG = this.svg.append("g").attr("transform", `translate(${this.width - 280}, -20)`);
        
        this.xTitle = this.svg.append("text").attr("x", this.width / 2).attr("y", this.height + 42).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700");
        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -60).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Total Volume (Fines Logged)");
    }

    update(data, selectedYear, activeMetric) {
        this.svg.selectAll(".trend-path, .trend-dot, .timeline-bar, .bar-direct-label").remove();
        this.legendG.html("");

        const nested = d3.group(data, d => d.DETECTION_METHOD);
        const allYears = Array.from(new Set(data.map(d => d.YEAR))).sort(d3.ascending);

        const legendData = ["Camera Issued", "Police Issued"];
        const legendColors = ["#3B82F6", "#EF4444"];
        legendData.forEach((label, i) => {
            const block = this.legendG.append("g").attr("transform", `translate(${i * 140}, 0)`);
            block.append("circle").attr("r", 5).attr("fill", legendColors[i]);
            block.append("text").attr("x", 12).attr("y", 4).text(label).attr("fill", "#475569").style("font-size", "11px").style("font-weight", "600");
        });

        if (activeMetric === "unlicensed_driving") {
            this.xTitle.text("Temporal Distribution Summary");
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
                .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>Year Frame: ${d.year}</strong><br/>Fines Issued: ${d.val.toLocaleString()}`); })
                .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
                .merge(bars).transition().duration(750)
                .attr("x", d => this.xScaleBand(d.year)).attr("width", this.xScaleBand.bandwidth())
                .attr("y", d => this.yScale(d.val)).attr("height", d => this.height - this.yScale(d.val))
                .attr("fill", d => d.year === selectedYear ? "#0F172A" : "#EF4444");

            this.svg.append("g").selectAll(".bar-direct-label").data(barTotals, d => d.year).enter()
                .append("text").attr("class", "bar-direct-label").attr("text-anchor", "middle")
                .attr("x", d => this.xScaleBand(d.year) + this.xScaleBand.bandwidth()/2).attr("y", d => this.yScale(d.val) - 6)
                .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
                .text(d => d.val > 0 ? d.val.toLocaleString() : "");
            return;
        }

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

        const lineGen = d3.line().x(d => this.xScale(d.date)).y(d => this.yScale(d.val)).curve(d3.curveMonotoneX);

        const paths = this.svg.selectAll(".trend-path").data(linesData, d => d.method);
        paths.enter().append("path").attr("class", "trend-path trend-line").attr("fill", "none")
            .attr("stroke", d => this.colorScale(d.method)).attr("d", d => lineGen(d.trend))
            .merge(paths).transition().duration(750).attr("d", d => lineGen(d.trend))
            .attr("stroke", d => selectedYear === "All" ? this.colorScale(d.method) : "#CBD5E1")
            .style("opacity", d => selectedYear === "All" ? 1 : 0.4);
        paths.exit().remove();

        const dots = this.svg.selectAll(".trend-dot").data(linesData.flatMap(d => d.trend), d => d.method + d.yrStr);
        dots.enter().append("circle").attr("class", "trend-dot")
            .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>Method: ${d.method}</strong><br/>Year Frame: ${d.yrStr}<br/>Fines: ${d.val.toLocaleString()}`); })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(dots).transition().duration(750)
            .attr("cx", d => this.xScale(d.date)).attr("cy", d => this.yScale(d.val))
            .attr("fill", d => d.yrStr === selectedYear ? this.colorScale(d.method) : (selectedYear === "All" ? this.colorScale(d.method) : "#E2E8F0"))
            .attr("r", d => d.yrStr === selectedYear ? 8.5 : (selectedYear === "All" ? 4 : 2));
        dots.exit().remove();
    }
}

class DetectionDonutChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.colorScale = d3.scaleOrdinal().domain(["Camera Issued", "Police issued", "Other / Unspecified", "Unspecified"]).range(["#3B82F6", "#EF4444", "#94A3B8", "#94A3B8"]);
        this.tooltip = d3.select("#d3-tooltip");
    }

    recalculateWidthAndRender(data) {
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450);
        this.height = 240;
        this.radius = Math.min(this.width, this.height) / 2 - 35;

        this.svg = d3.select(this.containerId).html("").append("svg")
            .attr("width", this.width).attr("height", this.height)
            .append("g").attr("transform", `translate(${this.width / 2},${this.height / 2 - 20})`);

        this.legendG = this.svg.append("g");
        this.update(data);
    }

    update(data) {
        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.DETECTION_METHOD)
            .map(([method, val]) => ({ method, val })).filter(d => d.val > 0);

        this.svg.selectAll(".donut-label").remove();
        this.legendG.html("");

        if (rollup.length === 0) { this.svg.selectAll("path").remove(); return; }

        const pie = d3.pie().value(d => d.val).sort(null);
        const arc = d3.arc().innerRadius(this.radius * 0.55).outerRadius(this.radius);
        
        // 🚀 FIXED: Exact mathematical midpoint between 0.55 and 1.0 is 0.775
        const labelArc = d3.arc().innerRadius(this.radius * 0.775).outerRadius(this.radius * 0.775);
        
        const pieData = pie(rollup);
        const total = d3.sum(rollup, d => d.val);

        const itemWidth = 130;
        const totalLegendWidth = rollup.length * itemWidth;
        const startX = -totalLegendWidth / 2 + 10;

        rollup.forEach((d, i) => {
            const item = this.legendG.append("g").attr("transform", `translate(${startX + (i * itemWidth)}, ${this.height / 2 - 5})`);
            item.append("rect").attr("width", 10).attr("height", 10).attr("fill", this.colorScale(d.method)).attr("rx", 2);
            item.append("text").attr("x", 15).attr("y", 9).text(d.method.split(" ")[0] + " Issued").style("font-size", "10px").style("font-weight", "600").attr("fill", "#64748B");
        });

        const paths = this.svg.selectAll(".donut-slice").data(pieData, d => d.data.method);
        paths.enter().append("path").attr("class", "donut-slice donut-arc").attr("fill", d => this.colorScale(d.data.method) || "#CBD5E1")
            .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>Method: ${d.data.method}</strong><br/>Fines Segment Sum: ${d.data.val.toLocaleString()}`); })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(paths).transition().duration(500).attrTween("d", function(d) {
                const i = d3.interpolate(this._current || d, d); this._current = i(0); return t => arc(i(t));
            });
        paths.exit().remove();

        this.svg.selectAll(".donut-label").data(pieData, d => d.data.method).enter()
            .append("text").attr("class", "donut-label").attr("transform", d => `translate(${labelArc.centroid(d)})`)
            // 🚀 FIXED: Added dy="0.35em" to pull the baseline down and perfectly center the text vertically!
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle").attr("fill", "#FFFFFF").style("font-size", "10px").style("font-weight", "700")
            .text(d => {
                const pct = ((d.data.val / total) * 100).toFixed(0);
                return pct > 5 ? `${pct}%` : "";
            });
    }
}

class JurisdictionBarChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 15, right: 30, bottom: 45, left: 55 };
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450) - this.margin.left - this.margin.right;
        this.height = 240 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId).html("").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().range([0, this.width]).padding(0.3);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.tooltip = d3.select("#d3-tooltip");

        this.svg.append("text").attr("x", this.width / 2).attr("y", this.height + 35).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("State Code Jurisdiction");
    }

    update(data) {
        const states = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.JURISDICTION)
            .map(([state, val]) => ({ state, val }))
            .sort((a,b) => d3.descending(a.val, b.val));

        this.svg.selectAll(".state-direct-label").remove();

        if (states.length === 0) { this.svg.selectAll(".chart-bar").remove(); return; }

        this.xScale.domain(states.map(d => d.state));
        const peakValue = d3.max(states, d => d.val) || 10;
        this.yScale.domain([0, peakValue * 1.15]);

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakValue]).tickFormat(d3.format(".1s")));

        const bars = this.svg.selectAll(".chart-bar").data(states, d => d.state);
        bars.enter().append("rect").attr("class", "chart-bar").attr("fill", "#3B82F6")
            .attr("x", d => this.xScale(d.state)).attr("y", this.height).attr("width", this.xScale.bandwidth()).attr("height", 0)
            .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>State: ${d.state}</strong><br/>Total Fines: ${d.val.toLocaleString()}`); })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(bars).transition().duration(750).attr("x", d => this.xScale(d.state)).attr("width", this.xScale.bandwidth())
            .attr("y", d => this.yScale(d.val)).attr("height", d => this.height - this.yScale(d.val));
        bars.exit().remove();

        this.svg.selectAll(".state-direct-label").data(states, d => d.state).enter()
            .append("text").attr("class", "state-direct-label").attr("x", d => this.xScale(d.state) + this.xScale.bandwidth()/2).attr("y", d => this.yScale(d.val) - 6)
            .attr("text-anchor", "middle").attr("fill", "#0F172A").style("font-size", "9px").style("font-weight", "700")
            .text(d => d.val > 0 ? d3.format(".2s")(d.val) : "");
    }
}

class DemographicBarChart {
    constructor(containerId) {
        this.containerId = containerId;
        // Adjusted left margin to 110px to prevent parameter text overflow errors
        this.margin = { top: 15, right: 80, bottom: 45, left: 110 };
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450) - this.margin.left - this.margin.right;
        this.height = 240 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId).html("").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([0, this.height]).padding(0.25);
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.tooltip = d3.select("#d3-tooltip");

        this.svg.append("text").attr("x", this.width / 2).attr("y", this.height + 35).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Enforcement Volume (Fines Issued)");
    }

    update(data) {
        const structuralAgeBands = ["0-16", "17-25", "26-39", "40-59", "60-64", "65 and over"];
        const profileMap = d3.rollup(data, v => d3.sum(v, d => +d.FINES || 0), d => d.AGE_GROUP);
        let profiles = structuralAgeBands.map(bracket => ({ bracket, val: profileMap.get(bracket) || 0 }));

        // 🚀 Requirement 2: Sorted high to low (Descending order)
        profiles.sort((a, b) => d3.descending(a.val, b.val));

        this.svg.selectAll(".bar-direct-label").remove();

        if (d3.sum(profiles, d => d.val) === 0) { this.svg.selectAll(".chart-bar").remove(); this.xAxisG.style("opacity",0); this.yAxisG.style("opacity",0); return; }

        this.xAxisG.style("opacity",1); this.yAxisG.style("opacity",1);
        const peakWidth = d3.max(profiles, d => d.val) || 10;
        this.xScale.domain([0, peakWidth * 1.15]);
        this.yScale.domain(profiles.map(d => d.bracket));

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale).tickValues([0, peakWidth]).tickFormat(d3.format(".2s")));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale));

        const bars = this.svg.selectAll(".chart-bar").data(profiles, d => d.bracket);
        bars.enter().append("rect").attr("class", "chart-bar").attr("fill", "#6366F1").attr("x", 0).attr("y", d => this.yScale(d.bracket)).attr("height", this.yScale.bandwidth()).attr("width", 0)
            .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>Age Cluster: ${d.bracket}</strong><br/>Fines Total: ${d.val.toLocaleString()}`); })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(bars).transition().duration(750).attr("y", d => this.yScale(d.bracket)).attr("height", this.yScale.bandwidth()).attr("width", d => this.xScale(d.val));
        bars.exit().remove();

        this.svg.selectAll(".bar-direct-label").data(profiles, d => d.bracket).enter()
            .append("text").attr("class", "bar-direct-label").attr("x", d => this.xScale(d.val) + 6).attr("y", d => this.yScale(d.bracket) + this.yScale.bandwidth()/2 + 4)
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700").text(d => d.val > 0 ? d.val.toLocaleString() : "0");
    }
}

class LocationGroupedChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 20, right: 75, bottom: 45, left: 165 };
        const node = d3.select(this.containerId).node();
        this.width = (node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 950) - this.margin.left - this.margin.right;
        this.height = 240 - this.margin.top - this.margin.bottom;

        this.svg = d3.select(this.containerId).html("").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([this.height, 0]).padding(0.3);
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.tooltip = d3.select("#d3-tooltip");

        this.svg.append("text").attr("x", this.width / 2).attr("y", this.height + 35).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Spatial Breakdown Density Load (Fines Issued)");
    }

    update(data, currentJurisdiction) {
        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.LOCATION)
            .map(([zone, val]) => ({ zone, val })).filter(d => d.zone !== "All regions" && d.val > 0)
            .sort((a,b) => d3.ascending(a.val, b.val));

        this.svg.selectAll(".location-direct-label, .placeholder-msg-node").remove();

        // 🚀 CONTEXTUAL PLACEHOLDER ENGINE: Handles unspecified datasets inside the viewbox cleanly
        if (rollup.length === 0) { 
            this.svg.selectAll(".chart-bar").remove(); 
            this.xAxisG.style("opacity", 0); 
            this.yAxisG.style("opacity", 0); 

            this.svg.selectAll(".placeholder-msg-node").data([null]).join("text")
                .attr("class", "placeholder-msg-node")
                .attr("x", this.width / 2).attr("y", this.height / 2)
                .attr("text-anchor", "middle").attr("fill", "#94A3B8")
                .style("font-size", "13px").style("font-weight", "600")
                .text(`🗺️ Remoteness breakdown is not explicitly tracked for jurisdiction: (${currentJurisdiction})`);
            return; 
        }

        this.xAxisG.style("opacity", 1); 
        this.yAxisG.style("opacity", 1);

        const peakWidth = d3.max(rollup, d => d.val) || 10;
        this.xScale.domain([0, peakWidth * 1.15]);
        this.yScale.domain(rollup.map(d => d.zone));

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale).tickValues([0, peakWidth]).tickFormat(d3.format(".2s")));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale));

        const bars = this.svg.selectAll(".chart-bar").data(rollup, d => d.zone);
        bars.enter().append("rect").attr("class", "chart-bar").attr("fill", "#10B981").attr("x", 0).attr("y", d => this.yScale(d.zone)).attr("height", this.yScale.bandwidth()).attr("width", 0)
            .on("mouseover", (e, d) => { this.tooltip.style("opacity", 1).html(`<strong>Region: ${d.zone}</strong><br/>Fines: ${d.val.toLocaleString()}`); })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px")).on("mouseout", () => this.tooltip.style("opacity", 0))
            .merge(bars).transition().duration(750).attr("y", d => this.yScale(d.zone)).attr("height", this.yScale.bandwidth()).attr("width", d => this.xScale(d.val));
        bars.exit().remove();

        this.svg.selectAll(".location-direct-label").data(rollup, d => d.zone).enter()
            .append("text").attr("class", "location-direct-label").attr("x", d => this.xScale(d.val) + 6).attr("y", d => this.yScale(d.zone) + this.yScale.bandwidth()/2 + 4)
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700").text(d => d.val.toLocaleString());
    }
}