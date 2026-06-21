import { TimelineChart } from './TimelineChart.js';
import { DetectionDonutChart } from './DetectionDonutChart.js';
import { JurisdictionTrackingChart } from './JurisdictionTrackingChart.js';
import { DemographicLollipopChart } from './DemographicLollipopChart.js';
import { LocationDotPlotChart } from './LocationDotPlotChart.js';

let masterDataset = [];
let chartInstances = {};

const appState = {
    currentCategory: "mobile_phone_use",
    selectedJurisdiction: "All",
    selectedYear: "All",
    activeDashboardPage: 1
};

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

    d3.selectAll(".dashboard-pager-ribbon .pager-btn").on("click", function() {
        d3.selectAll(".dashboard-pager-ribbon .pager-btn").classed("active", false);
        d3.select(this).classed("active", true);

        appState.activeDashboardPage = parseInt(d3.select(this).attr("data-page"));
        
        d3.selectAll(".dashboard-subpage").classed("active-subpage", false);
        d3.select(`#dashboard-subpage-${appState.activeDashboardPage}`).classed("active-subpage", true);
        
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
      .duration(2500)
      .ease(d3.easeCubicOut)
      .tween("text", function() {
          const i = d3.interpolate(0, grandTotal);
          return function(t) { 
              this.textContent = Math.round(i(t)).toLocaleString(); 
          };
      });
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

    const isAll = appState.selectedYear === "All";
    const yearInt = parseInt(appState.selectedYear);
    const state = appState.selectedJurisdiction;

    const isUnlicensedInvalid = !isAll && appState.currentCategory === "unlicensed_driving" && yearInt < 2023;

    let seatbeltStartYear = 2017; 
    if (["ACT", "NT", "QLD", "SA", "VIC"].includes(state)) seatbeltStartYear = 2018;
    if (state === "TAS") seatbeltStartYear = 2020;

    const isSeatbeltInvalid = !isAll && appState.currentCategory === "non_wearing_seatbelts" && yearInt < seatbeltStartYear;
    const isQld2023Invalid = (state === "QLD" && yearInt === 2023);

    d3.select("#unlicensed-warning-banner").style("display", isUnlicensedInvalid ? "block" : "none");
    d3.select("#seatbelt-warning-banner").style("display", isSeatbeltInvalid ? "block" : "none");
    d3.select("#qld-2023-warning-banner").style("display", isQld2023Invalid ? "block" : "none");
    
    if (isSeatbeltInvalid) {
        d3.select("#seatbelt-warning-banner p").text(`Seatbelt Violation metrics for ${state === 'All' ? 'Australia' : state} were not incorporated into the national matrix until ${seatbeltStartYear}. Please select a year from ${seatbeltStartYear} onwards.`);
    }

    const hideAllCharts = isUnlicensedInvalid || isSeatbeltInvalid;
    const isHistoricalEra = !isAll && yearInt < 2023; 

    if (hideAllCharts || isHistoricalEra || isQld2023Invalid) {
        if (appState.activeDashboardPage === 2) {
            appState.activeDashboardPage = 1;
            d3.selectAll(".dashboard-pager-ribbon .pager-btn").classed("active", false);
            d3.selectAll(".dashboard-pager-ribbon .pager-btn[data-page='1']").classed("active", true);
        }
        d3.select("#pager-btn-page2").style("opacity", "0.4").style("cursor", "not-allowed").style("pointer-events", "none");
        
        d3.select("#page2-lock-notice").style("display", isHistoricalEra && !isQld2023Invalid ? "block" : "none");
    } else {
        d3.select("#pager-btn-page2").style("opacity", "1").style("cursor", "pointer").style("pointer-events", "auto");
        d3.select("#page2-lock-notice").style("display", "none");
    }

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
        
        const valueCell = row.append("td")
            .style("font-family", "monospace")
            .style("font-size", "1.1rem")
            .style("font-weight", "700")
            .text("0"); 

        valueCell.transition()
            .duration(1500)
            .ease(d3.easeCubicOut)
            .tween("text", function() {
                const i = d3.interpolateRound(0, r.val);
                return function(t) {
                    this.textContent = i(t).toLocaleString();
                };
            });
    });
}