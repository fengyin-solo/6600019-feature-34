<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-72 bg-gray-900 p-4 flex flex-col gap-3 border-r border-gray-800 overflow-y-auto">
      <h1 class="text-lg font-bold text-cyan-400">地震波形 P/S 波分析</h1>

      <div>
        <label class="block bg-cyan-500 text-black text-center py-2 rounded cursor-pointer hover:bg-cyan-400 text-sm font-medium">
          上传 SAC/miniSEED
          <input type="file" @change="onUpload" class="hidden" />
        </label>
      </div>
      <button @click="store.loadMockData()" class="bg-gray-800 py-2 rounded text-sm hover:bg-gray-700">
        加载模拟数据
      </button>

      <!-- STA/LTA Parameters -->
      <div class="bg-gray-800 rounded-xl p-3 space-y-2">
        <h3 class="text-cyan-300 font-bold text-sm">STA/LTA 参数</h3>
        <div>
          <label class="text-gray-400 text-xs">STA 窗口: {{ store.staWindow.toFixed(1) }}s</label>
          <input type="range" v-model.number="store.staWindow" min="0.5" max="5" step="0.1" class="w-full" />
        </div>
        <div>
          <label class="text-gray-400 text-xs">LTA 窗口: {{ store.ltaWindow.toFixed(1) }}s</label>
          <input type="range" v-model.number="store.ltaWindow" min="5" max="30" step="0.5" class="w-full" />
        </div>
        <div>
          <label class="text-gray-400 text-xs">触发阈值: {{ store.threshold.toFixed(1) }}</label>
          <input type="range" v-model.number="store.threshold" min="1" max="10" step="0.5" class="w-full" />
        </div>
        <button @click="runPick" class="w-full bg-cyan-600 py-2 rounded text-sm hover:bg-cyan-500">
          运行自动拾取
        </button>
      </div>

      <!-- Picks -->
      <div class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-cyan-300 font-bold text-sm mb-2">震相拾取结果</h3>
        <div v-for="p in store.picks" :key="p.id" class="flex justify-between bg-gray-700 rounded p-2 mb-1 text-sm">
          <span :class="p.type === 'P' ? 'text-red-400' : 'text-blue-400'">{{ p.type }} 波</span>
          <span>{{ p.time.toFixed(2) }}s</span>
          <span class="text-gray-400">{{ (p.confidence * 100).toFixed(0) }}%</span>
        </div>
        <div v-if="!store.picks.length" class="text-gray-600 text-xs">加载数据后运行拾取</div>
      </div>

      <!-- Stations -->
      <div class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-cyan-300 font-bold text-sm mb-2">台站分布</h3>
        <div v-for="s in store.stations" :key="s.id"
          @click="store.selectedStation = s"
          class="rounded p-2 mb-1 text-sm cursor-pointer transition-all duration-200"
          :class="store.selectedStation?.id === s.id
            ? 'bg-cyan-900/50 border border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
            : 'bg-gray-700 hover:bg-gray-600 border border-transparent'">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full"
              :class="store.selectedStation?.id === s.id ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'"></div>
            <span class="font-medium" :class="store.selectedStation?.id === s.id ? 'text-cyan-300' : 'text-gray-200'">{{ s.name }}</span>
          </div>
          <div class="text-gray-400 text-xs mt-1 ml-4">{{ s.latitude.toFixed(2) }}°N, {{ s.longitude.toFixed(2) }}°E</div>
        </div>
      </div>

      <!-- Station Overview -->
      <div v-if="store.selectedStation" class="bg-gradient-to-br from-cyan-900/30 to-gray-800 rounded-xl p-3 border border-cyan-500/30">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-cyan-300 font-bold text-sm">台站概览</h3>
            <p class="text-cyan-200/70 text-xs">{{ store.selectedStation.name }} 台站</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-gray-800/60 rounded-lg p-2">
            <div class="text-gray-400 text-xs">海拔高度</div>
            <div class="text-white font-semibold text-sm">{{ store.selectedStation.elevation }} m</div>
          </div>
          <div class="bg-gray-800/60 rounded-lg p-2">
            <div class="text-gray-400 text-xs">台站编号</div>
            <div class="text-white font-semibold text-sm">{{ store.selectedStation.id }}</div>
          </div>
        </div>

        <div class="bg-gray-800/60 rounded-lg p-2 mb-3">
          <div class="text-gray-400 text-xs mb-1">坐标位置</div>
          <div class="text-white text-sm font-mono">{{ store.selectedStation.latitude.toFixed(4) }}°N</div>
          <div class="text-white text-sm font-mono">{{ store.selectedStation.longitude.toFixed(4) }}°E</div>
        </div>

        <!-- Nearest Event Highlight -->
        <div v-if="store.nearestEvent" class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span class="text-amber-300 font-semibold text-xs">最近地震事件</span>
          </div>
          <div class="text-white text-sm font-medium mb-1">
            M{{ store.nearestEvent.magnitude }} {{ store.nearestEvent.location }}
          </div>
          <div class="grid grid-cols-2 gap-1 text-xs">
            <div class="text-gray-400">震中距</div>
            <div class="text-amber-300 text-right font-mono">{{ store.nearestEvent.distanceKm.toFixed(1) }} km</div>
            <div class="text-gray-400">方位角</div>
            <div class="text-amber-300 text-right font-mono">{{ store.nearestEvent.azimuth.toFixed(1) }}°</div>
            <div class="text-gray-400">P 波走时</div>
            <div class="text-red-300 text-right font-mono">{{ store.nearestEvent.travelTimeP.toFixed(1) }} s</div>
            <div class="text-gray-400">S 波走时</div>
            <div class="text-blue-300 text-right font-mono">{{ store.nearestEvent.travelTimeS.toFixed(1) }} s</div>
          </div>
        </div>
      </div>

      <!-- Events -->
      <div class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-cyan-300 font-bold text-sm mb-2">
          地震事件目录
          <span v-if="store.selectedStation" class="text-gray-500 text-xs font-normal ml-2">
            按距离排序
          </span>
        </h3>
        <div v-for="e in (store.selectedStation ? store.selectedStationEvents : store.events)" :key="e.id"
          class="rounded p-2 mb-1 text-xs transition-all duration-200"
          :class="store.nearestEvent?.id === e.id && store.selectedStation
            ? 'bg-amber-900/20 border border-amber-500/40'
            : 'bg-gray-700 border border-transparent'">
          <div class="flex items-center justify-between">
            <span class="font-medium" :class="store.nearestEvent?.id === e.id && store.selectedStation ? 'text-amber-300' : 'text-gray-200'">
              M{{ e.magnitude }} {{ e.location }}
            </span>
            <span v-if="store.nearestEvent?.id === e.id && store.selectedStation"
              class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
              最近
            </span>
          </div>
          <div class="text-gray-500 mt-1">深度 {{ e.depth }}km | {{ e.originTime.slice(0, 16) }}</div>
          <div v-if="store.selectedStation && 'distanceKm' in e" class="flex gap-3 mt-1 text-[11px]">
            <span class="text-cyan-400">{{ e.distanceKm.toFixed(0) }}km</span>
            <span class="text-gray-500">方位 {{ e.azimuth.toFixed(0) }}°</span>
            <span class="text-red-400">P {{ e.travelTimeP.toFixed(0) }}s</span>
            <span class="text-blue-400">S {{ e.travelTimeS.toFixed(0) }}s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main: Waveform Charts -->
    <div class="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
      <WaveformChart v-if="store.waveform" />
      <div v-else class="flex-1 flex items-center justify-center text-gray-600">
        请上传数据或加载模拟波形
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSeismicStore } from './store/seismic'
import WaveformChart from './components/WaveformChart.vue'

const store = useSeismicStore()

function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.uploadAndAnalyze(file)
}

function runPick() {
  store.picks = store.staLtaPicking()
}
</script>
