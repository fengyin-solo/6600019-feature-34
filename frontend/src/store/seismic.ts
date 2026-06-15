import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { WaveformData, PhasePick, Station, SeismicEvent, StationEventRelation } from '../types'

export const useSeismicStore = defineStore('seismic', () => {
  const waveform = ref<WaveformData | null>(null)
  const picks = ref<PhasePick[]>([])
  const selectedStation = ref<Station | null>(null)
  const staWindow = ref(1.0)
  const ltaWindow = ref(10.0)
  const threshold = ref(3.5)
  const isLoading = ref(false)
  const events = ref<SeismicEvent[]>([
    { id: '1', magnitude: 4.2, depth: 12.5, originTime: '2025-01-15T08:23:41Z', location: '四川雅安', latitude: 30.0, longitude: 103.0 },
    { id: '2', magnitude: 3.8, depth: 8.3, originTime: '2025-01-14T14:12:05Z', location: '云南大理', latitude: 25.6, longitude: 100.2 },
    { id: '3', magnitude: 5.1, depth: 25.0, originTime: '2025-01-13T02:45:33Z', location: '台湾花莲', latitude: 24.0, longitude: 121.6 },
  ])

  const stations = ref<Station[]>([
    { id: 'STA01', name: 'BJI', latitude: 39.9, longitude: 116.4, elevation: 45 },
    { id: 'STA02', name: 'SSE', latitude: 31.2, longitude: 121.5, elevation: 10 },
    { id: 'STA03', name: 'KMI', latitude: 25.0, longitude: 102.7, elevation: 1890 },
    { id: 'STA04', name: 'HIA', latitude: 49.3, longitude: 119.7, elevation: 610 },
  ])

  function generateMockWaveform(): WaveformData {
    const sr = 100  // sampling rate Hz
    const duration = 60  // seconds
    const n = sr * duration
    const time = Array.from({ length: n }, (_, i) => i / sr)
    const bhz: number[] = [], bhn: number[] = [], bhe: number[] = []

    for (let i = 0; i < n; i++) {
      const t = time[i]
      // Background noise
      let vz = (Math.random() - 0.5) * 0.02
      let ns = (Math.random() - 0.5) * 0.02
      let ew = (Math.random() - 0.5) * 0.02

      // P-wave arrival at t=10s
      if (t > 10 && t < 18) {
        const amp = 0.8 * Math.exp(-(t - 12) * (t - 12) / 8)
        vz += amp * Math.sin(2 * Math.PI * 8 * t)
        ns += amp * 0.3 * Math.sin(2 * Math.PI * 8 * t + 0.5)
        ew += amp * 0.3 * Math.sin(2 * Math.PI * 8 * t + 1.0)
      }

      // S-wave arrival at t=22s
      if (t > 22 && t < 40) {
        const amp = 1.5 * Math.exp(-(t - 28) * (t - 28) / 30)
        vz += amp * 0.4 * Math.sin(2 * Math.PI * 4 * t)
        ns += amp * Math.sin(2 * Math.PI * 4 * t + 0.3)
        ew += amp * Math.sin(2 * Math.PI * 4 * t + 0.8)
      }

      // Surface waves at t=35s
      if (t > 35 && t < 55) {
        const amp = 2.0 * Math.exp(-(t - 42) * (t - 42) / 50)
        vz += amp * Math.sin(2 * Math.PI * 1.5 * t)
        ns += amp * Math.sin(2 * Math.PI * 1.5 * t + 0.4)
        ew += amp * Math.sin(2 * Math.PI * 1.5 * t + 0.9)
      }

      bhz.push(vz)
      bhn.push(ns)
      bhe.push(ew)
    }

    return { time, bhz, bhn, bhe, samplingRate: sr }
  }

  function loadMockData() {
    waveform.value = generateMockWaveform()
    picks.value = [
      { id: 'p1', type: 'P', time: 10.2, confidence: 0.92, method: 'STA/LTA' },
      { id: 'p2', type: 'S', time: 22.5, confidence: 0.88, method: 'STA/LTA' },
    ]
  }

  function staLtaPicking(): PhasePick[] {
    if (!waveform.value) return []
    const data = waveform.value.bhz
    const sr = waveform.value.samplingRate
    const staLen = Math.floor(staWindow.value * sr)
    const ltaLen = Math.floor(ltaWindow.value * sr)
    const newPicks: PhasePick[] = []

    let lta = 0
    for (let i = ltaLen; i < data.length - staLen; i++) {
      let sta = 0
      for (let j = 0; j < staLen; j++) sta += data[i + j] * data[i + j]
      sta /= staLen

      lta = 0
      for (let j = 0; j < ltaLen; j++) lta += data[i - j] * data[i - j]
      lta /= ltaLen

      const ratio = lta > 0 ? sta / lta : 0
      if (ratio > threshold.value) {
        const t = waveform.value.time[i]
        const existsNear = newPicks.some(p => Math.abs(p.time - t) < 2)
        if (!existsNear) {
          newPicks.push({
            id: `pick_${Date.now()}_${i}`,
            type: newPicks.length === 0 ? 'P' : 'S',
            time: t,
            confidence: Math.min(1, ratio / 10),
            method: 'STA/LTA'
          })
        }
      }
    }
    return newPicks
  }

  async function uploadAndAnalyze(file: File) {
    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/waveform/upload', { method: 'POST', body: formData })
      if (resp.ok) {
        const data = await resp.json()
        waveform.value = data.waveform
        picks.value = data.picks || []
      }
    } catch {
      loadMockData()
    } finally {
      isLoading.value = false
    }
  }

  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  function calculateAzimuth(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = lat1 * Math.PI / 180
    const phi2 = lat2 * Math.PI / 180
    const dLambda = (lon2 - lon1) * Math.PI / 180
    const y = Math.sin(dLambda) * Math.cos(phi2)
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
    let theta = Math.atan2(y, x)
    theta = theta * 180 / Math.PI
    return (theta + 360) % 360
  }

  function estimateTravelTime(distanceKm: number, depthKm: number, waveType: 'P' | 'S'): number {
    const vp = 6.0
    const vs = 3.5
    const speed = waveType === 'P' ? vp : vs
    const hypoDist = Math.sqrt(distanceKm * distanceKm + depthKm * depthKm)
    return hypoDist / speed
  }

  const selectedStationEvents = computed<(SeismicEvent & StationEventRelation)[]>(() => {
    if (!selectedStation.value) return []
    return events.value.map(e => {
      const dist = haversineDistance(
        selectedStation.value!.latitude, selectedStation.value!.longitude,
        e.latitude, e.longitude
      )
      const az = calculateAzimuth(
        selectedStation.value!.latitude, selectedStation.value!.longitude,
        e.latitude, e.longitude
      )
      return {
        ...e,
        eventId: e.id,
        distanceKm: dist,
        azimuth: az,
        travelTimeP: estimateTravelTime(dist, e.depth, 'P'),
        travelTimeS: estimateTravelTime(dist, e.depth, 'S'),
      }
    }).sort((a, b) => a.distanceKm - b.distanceKm)
  })

  const nearestEvent = computed(() => {
    if (!selectedStationEvents.value.length) return null
    return selectedStationEvents.value[0]
  })

  return {
    waveform, picks, selectedStation, staWindow, ltaWindow, threshold,
    isLoading, events, stations, selectedStationEvents, nearestEvent,
    loadMockData, staLtaPicking, uploadAndAnalyze, generateMockWaveform
  }
})
