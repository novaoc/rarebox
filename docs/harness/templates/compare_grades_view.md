# Spec: Compare Grades View

## Goal
Display a multi‑series line chart that shows price trends for raw cards versus selected graded slabs (PSA, BGS, CGC) using ApexCharts.

## Requirements
* Use `vue3‑apexcharts` component.
* Accept props:
  * `rawData: Array<{ date:string, price:number }>`
  * `gradedData: Record<string, Array<{ date:string, price:number }>>` where keys are slab names.
* Chart options must use the tactile palette (cream background, ink axes, 2 px solid grid lines).
* Each series gets a distinct color, respecting accessibility contrast.
* Add a legend with touch‑friendly items (≥44 px).
* Component file: `src/components/CompareGradesChart.vue`.
* Write a unit test checking that the series count matches the number of slab keys.
* Run verification gates after implementation.
