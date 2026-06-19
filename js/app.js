// Accessible Road Safety Compliance Platform - Central Hub Controller

let masterDataset = [];
let chartInstances = {};

const appState = {
    currentCategory: "mobile_phone_use",
    selectedJurisdiction: "All",
    selectedYear: "All",
    activeDashboardPage: 1
};

// Data pipeline reads cleanly relative to index.html position layout
d3.csv("data/police_enforcement_2024_fines.csv").then(data => {
    masterDataset = data;
    initializeDashboardHub();
}).catch(err => console.error("❌ CRITICAL: CSV resource ingestion failure:", err));

function initializeDashboardHub() {
    chartInstances.timeline = new TimelineChart("#timeline-chart");
    chartInstances.donut = new DetectionDonutChart("#detection-donut-chart");
    chartInstances.jurisdictions = new JurisdictionTrackingChart("#jurisdiction-bar-chart");
    chartInstances.demographics = new DemographicLollipopChart("#demographic-lollipop-chart");  
    chartInstances.locationChart = new LocationDotPlotChart("#spatial-grouped-chart");

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

    // Dashboard Page 1 & Page 2 Pager Ribbon Controller Navigation
    d3.selectAll(".dashboard-pager-ribbon .pager-btn").on("click", function() {
        d3.selectAll(".dashboard-pager-ribbon .pager-btn").classed("active", false);
        d3.select(this).classed("active", true);

        appState.activeDashboardPage = parseInt(d3.select(this).attr("data-page"));
        
        // Toggle the sub-page block visibility wrappers instantly
        d3.selectAll(".dashboard-subpage").classed("active-subpage", false);
        d3.select(`#dashboard-subpage-${appState.activeDashboardPage}`).classed("active-subpage", true);
        
        // Force dimensions recalculation and component rendering routines instantly
        dispatchDataUpdate();
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

    animateHomeGrandTotal();

    window.addEventListener("resize", () => dispatchDataUpdate());
}

function animateHomeGrandTotal() {
    const grandTotal = d3.sum(masterDataset, d => +d.FINES || 0);
    
    d3.select("#home-grand-total")
      .transition()
      .duration(2500) // 2.5 second smooth ease-out count
      .ease(d3.easeCubicOut)
      .tween("text", function() {
          const i = d3.interpolate(0, grandTotal);
          return function(t) { 
              this.textContent = Math.round(i(t)).toLocaleString(); 
          };
      });
}

// core data filtering pipeline
// filters the dataset based on active dropdown values and pushes updates to the charts.
function dispatchDataUpdate() {
    // filter data for the timeline chart without applying specific year constraints
    const timelineData = masterDataset.filter(d => {
        const matchCategory = d.METRIC === appState.currentCategory;
        const matchState    = appState.selectedJurisdiction === "All" || d.JURISDICTION === appState.selectedJurisdiction;
        return matchCategory && matchState;
    });

    // filter data slice for the broken-down detail views
    const filteredSlice = masterDataset.filter(d => {
        const matchCategory = d.METRIC === appState.currentCategory;
        const matchState    = appState.selectedJurisdiction === "All" || d.JURISDICTION === appState.selectedJurisdiction;
        const matchYear     = appState.selectedYear === "All" || d.YEAR === appState.selectedYear;
        return matchCategory && matchState && matchYear;
    });

    // map internal keys to readable text titles
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

    const isAll = appState.selectedYear === "All";
    const yearInt = parseInt(appState.selectedYear);
    const state = appState.selectedJurisdiction;

    // safety checks to verify if data exists for the selected timeframe
    const isUnlicensedInvalid = !isAll && appState.currentCategory === "unlicensed_driving" && yearInt < 2023;

    let seatbeltStartYear = 2017; 
    if (["ACT", "NT", "QLD", "SA", "VIC"].includes(state)) seatbeltStartYear = 2018;
    if (state === "TAS") seatbeltStartYear = 2020;

    const isSeatbeltInvalid = !isAll && appState.currentCategory === "non_wearing_seatbelts" && yearInt < seatbeltStartYear;

    // check if the user selected queensland for the year 2023
    const isQld2023Invalid = (state === "QLD" && yearInt === 2023);

    // toggle banners based on the data checks
    d3.select("#unlicensed-warning-banner").style("display", isUnlicensedInvalid ? "block" : "none");
    d3.select("#seatbelt-warning-banner").style("display", isSeatbeltInvalid ? "block" : "none");
    d3.select("#qld-2023-warning-banner").style("display", isQld2023Invalid ? "block" : "none");
    
    if (isSeatbeltInvalid) {
        d3.select("#seatbelt-warning-banner p").text(`Seatbelt Violation metrics for ${state === 'All' ? 'Australia' : state} were not incorporated into the national matrix until ${seatbeltStartYear}. Please select a year from ${seatbeltStartYear} onwards.`);
    }

    const hideAllCharts = isUnlicensedInvalid || isSeatbeltInvalid;
    const isHistoricalEra = !isAll && yearInt < 2023; 

    // dashboard page 2 lock logic
    // forces user back to page 1 and disables the tab button if looking at older historical data or queensland 2023
    if (hideAllCharts || isHistoricalEra || isQld2023Invalid) {
        if (appState.activeDashboardPage === 2) {
            appState.activeDashboardPage = 1;
            d3.selectAll(".dashboard-pager-ribbon .pager-btn").classed("active", false);
            d3.selectAll(".dashboard-pager-ribbon .pager-btn[data-page='1']").classed("active", true);
        }
        d3.select("#pager-btn-page2").style("opacity", "0.4").style("cursor", "not-allowed").style("pointer-events", "none");
        
        // hide the small right-side notice if it's just a queensland data gap, otherwise show it for old years
        d3.select("#page2-lock-notice").style("display", isHistoricalEra && !isQld2023Invalid ? "block" : "none");
    } else {
        d3.select("#pager-btn-page2").style("opacity", "1").style("cursor", "pointer").style("pointer-events", "auto");
        d3.select("#page2-lock-notice").style("display", "none");
    }

    // handle content visibility and distribute data to active charts
    if (hideAllCharts) {
        d3.select("#dashboard-subpage-1").style("display", "none");
        d3.select("#dashboard-subpage-2").style("display", "none");
    } else {
        d3.select("#dashboard-subpage-1").style("display", appState.activeDashboardPage === 1 ? "flex" : "none");
        d3.select("#dashboard-subpage-2").style("display", appState.activeDashboardPage === 2 ? "flex" : "none");
        
        if (appState.activeDashboardPage === 1) {
            if (appState.selectedJurisdiction !== "All") {
                d3.select("#jurisdiction-grid-item").style("display", "none");
                d3.select("#donut-grid-item").attr("class", "full-width-box"); 
            } else {
                d3.select("#jurisdiction-grid-item").style("display", "block");
                d3.select("#donut-grid-item").attr("class", "half-width-box"); 
                chartInstances.jurisdictions.update(filteredSlice);
            }
            chartInstances.timeline.update(timelineData, appState.selectedYear, appState.currentCategory);
            chartInstances.donut.recalculateWidthAndRender(filteredSlice, appState.currentCategory, yearInt);
        }

        if (appState.activeDashboardPage === 2) {
            d3.select("#advanced-metrics-grid").style("display", "block");
            chartInstances.demographics.update(filteredSlice);
            updateSeverityTable(filteredSlice); 
            chartInstances.locationChart.update(filteredSlice, appState.selectedJurisdiction); 
        }
    }

    // rolling text transition loop for the subheader total volume display
    const totalVolume = d3.sum(filteredSlice, d => +d.FINES || 0);
    d3.select("#kpi-total-volume")
      .transition().duration(1000)
      .tween("text", function() {
          const i = d3.interpolate(parseInt(this.textContent.replace(/,/g, '')) || 0, totalVolume);
          return function(t) { this.textContent = Math.round(i(t)).toLocaleString() + " Fines Issued"; };
      });
}

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
        
        // Number Counter Animation
        const valueCell = row.append("td")
            .style("font-family", "monospace")
            .style("font-size", "1.1rem")
            .style("font-weight", "700")
            .text("0"); // Start at 0

        valueCell.transition()
            .duration(1500) // 1.5 seconds rolling counter
            .ease(d3.easeCubicOut)
            .tween("text", function() {
                const i = d3.interpolateRound(0, r.val);
                return function(t) {
                    this.textContent = i(t).toLocaleString();
                };
            });
    });
}

// Graph rendering engine classes (D3 Canvas)

class TimelineChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 35, right: 30, bottom: 55, left: 85 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data, selectedYear, activeMetric) {
        const node = d3.select(this.containerId).node();
        
        // Recalculates based on the monitor size
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 950;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 280 - this.margin.top - this.margin.bottom;

        // Clear existing SVG
        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        // display block & margin 0 auto
        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", totalWidth)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("display", "block")
            .style("margin", "0 auto")
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleTime().range([0, this.width]);
        this.xScaleBand = d3.scaleBand().range([0, this.width]).padding(0.3);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        this.colorScale = d3.scaleOrdinal().domain(["Camera Issued", "Police issued", "Other / Unspecified", "Unspecified"]).range(["#3B82F6", "#EF4444", "#94A3B8", "#94A3B8"]);
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis");
        this.legendG = this.svg.append("g").attr("transform", `translate(${this.width - 280}, -20)`);
        
        // 🚀 CENTERED TITLES
        this.xTitle = this.svg.append("text").attr("x", centerX).attr("y", this.height + 42).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700");
        this.svg.append("text").attr("x", centerX).attr("y", this.height + 45).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Year");
        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -60).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Total Volume (Fines Logged)");

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
        
        const pathEnter = paths.enter().append("path")
            .attr("class", "trend-path trend-line")
            .attr("fill", "none")
            .attr("stroke", d => this.colorScale(d.method))
            .attr("d", d => lineGen(d.trend));
            
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

class DetectionDonutChart {
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

        // Wipe container clean on every update to completely avoid layout glitches
        d3.select(this.containerId).html(""); 

        this.svgWrapper = d3.select(this.containerId).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("display", "block")
            .style("margin", "0 auto");

        // Make the entire chart fade in cleanly using CSS opacity
        this.mainGroup = this.svgWrapper.append("g")
            .attr("transform", `translate(${this.width / 2},${this.height / 2 - 40})`)
            .style("opacity", 0);

        this.legendG = this.mainGroup.append("g");

        this.update(data, metric, year);

        // Execute the master fade-in smoothly over 400ms
        this.mainGroup.transition()
            .duration(400)
            .style("opacity", 1);
    }

    update(data, metric, year) {
        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.DETECTION_METHOD)
            .map(([method, val]) => ({ method, val })).filter(d => d.val > 0);

        if (rollup.length === 0) return;

        const pie = d3.pie().value(d => d.val).sort(null);
        const arc = d3.arc().innerRadius(this.radius * 0.55).outerRadius(this.radius);
        const labelArc = d3.arc().innerRadius(this.radius * 0.775).outerRadius(this.radius * 0.775);
        
        const pieData = pie(rollup);
        const total = d3.sum(rollup, d => d.val);

        const itemWidth = 130;
        const totalLegendWidth = rollup.length * itemWidth;
        const startX = -totalLegendWidth / 2 + 10;

        // Smart dynamic legend centering
        rollup.forEach((d, i) => {
            // Place items side-by-side temporarily starting from 0
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

        // Get the exact bounding box width of the legend group after items are built
        const legendBBox = this.legendG.node().getBBox();
        
        // Push the entire legend group into the dead-center vertically and horizontally
        this.legendG.attr("transform", `translate(${-legendBBox.width / 2}, ${240 / 2 - 5})`);

        // Draw the arcs instantly with no geometric morphing loops
        this.mainGroup.selectAll(".donut-slice")
            .data(pieData)
            .enter().append("path")
            .attr("class", "donut-slice donut-arc")
            .attr("fill", d => this.colorScale(d.data.method) || "#CBD5E1")
            .attr("d", arc) // Draws the final shapes immediately
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Method: ${d.data.method}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Segment Fines: <span style="color: #FFF; font-weight: 600;">${d.data.val.toLocaleString()}</span></span>`); 
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", () => this.tooltip.style("opacity", 0));

        // Plonk labels directly into place with high contrast
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
                return pct > 5 ? `${pct}%` : "";
            });

        // Footnotes setup block
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

class JurisdictionTrackingChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 25, right: 30, bottom: 65, left: 55 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data) {
        const node = d3.select(this.containerId).node();

        // Dynamic width calculation
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 450;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 285 - this.margin.top - this.margin.bottom;

        // Clear SVG
        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        // CSS Centering
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

        // Centered Titles
        this.svg.append("text").attr("x", centerX).attr("y", this.height + 45).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("State Code Jurisdiction");
        this.svg.append("text").attr("transform", "rotate(-90)").attr("x", -this.height / 2).attr("y", -42).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Total Volume (Fines Logged)");
        
        const defs = this.svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("x1", "0%").attr("y1", "100%")
            .attr("x2", "0%").attr("y2", "0%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3B82F6"); 
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#60A5FA"); 

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
        this.yScale.domain([0, peakValue * 1.15]);

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale).tickValues([0, peakValue / 2, peakValue]).tickFormat(d3.format(".1s")));

        const bars = this.svg.selectAll(".chart-stem").data(states, d => d.state);
        bars.enter().append("rect").attr("class", "chart-stem").attr("fill", "url(#bar-gradient)")
            .attr("x", d => this.xScale(d.state)).attr("y", this.height).attr("width", this.xScale.bandwidth()).attr("height", 0)
            .attr("rx", 4) 
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
            .merge(bars).transition().duration(750)
            .attr("x", d => this.xScale(d.state)).attr("width", this.xScale.bandwidth())
            .attr("y", d => this.yScale(d.val)).attr("height", d => this.height - this.yScale(d.val));
        bars.exit().remove();

        const caps = this.svg.selectAll(".chart-cap").data(states, d => d.state);
        caps.enter().append("rect").attr("class", "chart-cap").attr("fill", "#1E3A8A") 
            .attr("x", d => this.xScale(d.state) - 2).attr("y", this.height).attr("width", this.xScale.bandwidth() + 4).attr("height", 4)
            .attr("rx", 2)
            .style("pointer-events", "none") 
            .merge(caps).transition().duration(750)
            .attr("x", d => this.xScale(d.state) - 2).attr("width", this.xScale.bandwidth() + 4)
            .attr("y", d => this.yScale(d.val));
        caps.exit().remove();

        this.svg.selectAll(".state-direct-label").data(states, d => d.state).enter()
            .append("text").attr("class", "state-direct-label")
            .attr("x", d => this.xScale(d.state) + this.xScale.bandwidth()/2).attr("y", d => this.yScale(d.val) - 8)
            .attr("text-anchor", "middle").attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d3.format(".2s")(d.val) : "");
    }
}

class DemographicLollipopChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 35, right: 30, bottom: 85, left: 65 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data) {
        const node = d3.select(this.containerId).node();
        
        // Calculate width exactly when the chart is rendered (Page 2 is visible)
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 800;
        
        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;

        // Clear the old SVG before drawing to prevent duplicates and ensure fresh dynamic sizing
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

        const linesSelection = this.svg.selectAll(".lollipop-line").data(profiles, d => d.bracket);
        linesSelection.enter().append("line").attr("class", "lollipop-line")
            .attr("stroke", "#CBD5E1").attr("stroke-width", 2)
            .attr("x1", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("x2", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("y1", this.height).attr("y2", this.height) 
            .merge(linesSelection).transition().duration(750)
            .attr("x1", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("x2", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2)
            .attr("y1", this.height).attr("y2", d => this.yScale(d.val)); 

        const circles = this.svg.selectAll(".lollipop-circle").data(profiles, d => d.bracket);
        circles.enter().append("circle").attr("class", "lollipop-circle")
            .attr("fill", "#6366F1")
            .attr("stroke", "#FFFFFF").attr("stroke-width", 2)
            .attr("r", 7)
            .attr("cx", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("cy", this.height) 
            .on("mouseover", (e, d) => { 
                this.tooltip.style("opacity", 1)
                    .html(`<strong>Age Cluster: ${d.bracket}</strong>
                        <span style="color: #94A3B8; font-size: 0.78rem;">Fines Total: <span style="color: #FFF; font-weight: 600;">${d.val.toLocaleString()}</span></span>`); 
                d3.select(e.currentTarget).attr("r", 9).attr("fill", "#4F46E5").style("filter", "drop-shadow(0 0 4px rgba(99, 102, 241, 0.6))");
            })
            .on("mousemove", e => this.tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 25) + "px"))
            .on("mouseout", (e) => { 
                this.tooltip.style("opacity", 0);
                d3.select(e.currentTarget).attr("r", 7).attr("fill", "#6366F1").style("filter", "none");
            })
            .merge(circles).transition().duration(750).ease(d3.easeCubicOut)
            .attr("cx", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("cy", d => this.yScale(d.val));

        this.svg.selectAll(".bar-direct-label").data(profiles, d => d.bracket).enter()
            .append("text").attr("class", "bar-direct-label")
            .attr("x", d => this.xScale(d.bracket) + this.xScale.bandwidth() / 2).attr("y", d => this.yScale(d.val) - 12)
            .attr("text-anchor", "middle") 
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d3.format(".2s")(d.val) : "0");
    }
}

class LocationDotPlotChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.margin = { top: 25, right: 40, bottom: 65, left: 140 };
        this.tooltip = d3.select("#d3-tooltip");
    }

    update(data, currentJurisdiction) {
        const node = d3.select(this.containerId).node();
        
        // Calculate exactly when the sub-page renders
        let containerWidth = node && node.getBoundingClientRect().width > 0 ? node.getBoundingClientRect().width : 500;

        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;

        // Clear existing SVG
        d3.select(this.containerId).html("");

        const totalWidth = this.width + this.margin.left + this.margin.right;
        const centerX = (totalWidth / 2) - this.margin.left;

        this.svg = d3.select(this.containerId).append("svg")
            .attr("width", totalWidth)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("display", "block") 
            .style("margin", "0 auto")
            .append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().range([0, this.height]).padding(1); 
        
        this.xAxisG = this.svg.append("g").attr("class", "axis").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.svg.append("g").attr("class", "axis dot-y-axis"); 

        this.svg.append("text").attr("x", centerX).attr("y", -10).attr("text-anchor", "middle").attr("fill", "#64748B").style("font-size", "11px").style("font-weight", "700").text("Regional Volume Density (Fines Logged)");

        const footnoteText = this.svg.append("text")
            .attr("class", "donut-footnote")
            .attr("x", centerX) // Centered to the white box
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
                .attr("x", centerX) // Centered to the white box
                .attr("dy", index === 0 ? "0" : "14px")
                .text(lineText);
        });

        const rollup = d3.rollups(data, v => d3.sum(v, d => +d.FINES || 0), d => d.LOCATION)
            .map(([zone, val]) => ({ zone, val }))
            .filter(d => d.zone !== "All regions" && d.val > 0)
            .sort((a,b) => d3.descending(a.val, b.val)); 

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
        this.yScale.domain(rollup.map(d => d.zone.replace(" Australia", ""))); 

        this.xAxisG.transition().duration(750).call(d3.axisBottom(this.xScale).tickValues([0, peakWidth / 2, peakWidth]).tickFormat(d3.format(".2s")));
        this.yAxisG.transition().duration(750).call(d3.axisLeft(this.yScale));
        this.svg.selectAll(".dot-y-axis path").style("display", "none"); 
        this.svg.selectAll(".dot-y-axis line").style("display", "none"); 

        const linesSelection = this.svg.selectAll(".dot-line").data(rollup, d => d.zone);
        linesSelection.enter().append("line").attr("class", "dot-line")
            .attr("stroke", "#E2E8F0").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4") 
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

        this.svg.selectAll(".dot-direct-label").data(rollup, d => d.zone).enter()
            .append("text").attr("class", "dot-direct-label")
            .attr("x", d => this.xScale(d.val)).attr("y", d => this.yScale(d.zone.replace(" Australia", "")) - 12)
            .attr("text-anchor", "middle")
            .attr("fill", "#0F172A").style("font-size", "10px").style("font-weight", "700")
            .text(d => d.val > 0 ? d.val.toLocaleString() : "0");
    }
}