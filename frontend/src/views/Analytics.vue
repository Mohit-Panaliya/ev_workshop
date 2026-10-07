<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Analytics</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="a">
        <h3>Revenue — last 6 months</h3>
        <svg viewBox="0 0 320 120" style="width:100%">
          <rect v-for="(b, i) in bars" :key="i" :x="10 + i * 50" :y="110 - b.h" width="36" :height="b.h" fill="#1d4ed8" rx="3" />
          <text v-for="(b, i) in bars" :key="'t' + i" :x="12 + i * 50" y="118" font-size="9">{{ b.m }}</text>
        </svg>

        <h3>Jobs by status</h3>
        <ion-list>
          <ion-item v-for="(v, k) in a.jobs_by_status" :key="k"><ion-label>{{ k }}</ion-label><ion-badge slot="end">{{ v }}</ion-badge></ion-item>
        </ion-list>

        <h3>Revenue split</h3>
        <ion-list>
          <ion-item v-for="(v, k) in a.revenue_split" :key="k"><ion-label>{{ k }}</ion-label><b slot="end">₹{{ v }}</b></ion-item>
        </ion-list>

        <h3>Payments by mode</h3>
        <ion-list>
          <ion-item v-for="p in a.payments_by_mode" :key="p.mode"><ion-label><h2>{{ p.mode }}</h2><p>{{ p.count }} payments</p></ion-label><b slot="end">₹{{ p.total }}</b></ion-item>
        </ion-list>

        <h3>Top customers</h3>
        <ion-list>
          <ion-item v-for="c in a.top_customers" :key="c.customer" :router-link="`${BASE}/customers/${c.customer}`">
            <ion-label><h2>{{ c.customer }}</h2><p>Due ₹{{ c.outstanding }}</p></ion-label>
            <b slot="end">₹{{ c.billed }}</b>
          </ion-item>
        </ion-list>

        <h3>Stock value ₹{{ a.stock_value }} · Low stock ({{ a.low_stock.length }})</h3>
        <ion-list>
          <ion-item v-for="s in a.low_stock" :key="s.item_code"><ion-label>{{ s.item_code }}</ion-label><b slot="end">{{ s.actual_qty }}</b></ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonBadge } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const a = ref(null)
const error = ref("")
const bars = computed(() => {
  if (!a.value?.revenue_trend?.length) return []
  const max = Math.max(...a.value.revenue_trend.map((r) => Number(r.revenue) || 0), 1)
  return a.value.revenue_trend.slice(-6).map((r) => ({ m: String(r.month).slice(2), h: Math.round((Number(r.revenue) / max) * 90) + 4 }))
})

onMounted(async () => {
  try { a.value = await workshop.analytics() }
  catch (e) { error.value = e.message }
})
</script>
