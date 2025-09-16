<script setup>
import { ref, computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  chartType: {
    type: String,
    default: 'line',
  },
})

// Performance Trend Chart
const performanceChartData = computed(() => {
  if (!props.user.latestDailyAccuracy) {
    return {
      labels: [],
      datasets: [
        {
          label: 'Accuracy %',
          data: [],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3B82F6',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    }
  }

  const accuracies = Object.values(props.user.latestDailyAccuracy)
  const dates = Object.keys(props.user.latestDailyAccuracy)

  return {
    labels: dates.map(date =>
      new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    ),
    datasets: [
      {
        label: 'Accuracy %',
        data: accuracies,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }
})

const performanceChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        title: function (context) {
          const date = new Date(context[0].label)
          return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        },
        label: function (context) {
          return `Accuracy: ${context.parsed.y.toFixed(1)}%`
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
      ticks: {
        callback: function (value) {
          return value + '%'
        },
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
  interaction: {
    intersect: false,
    mode: 'index',
  },
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        📈 Performance Trend
      </h3>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Last {{ Object.keys(user.latestDailyAccuracy || {}).length }} days
      </div>
    </div>
    <div class="h-64">
      <Line
        :key="performanceChartData.labels.length"
        :data="performanceChartData"
        :options="performanceChartOptions"
      />
    </div>
  </div>
</template>
