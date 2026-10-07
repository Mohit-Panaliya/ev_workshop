<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Workshop</ion-title>
        <ion-buttons slot="end"><ion-button @click="doLogout">Logout</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p v-if="error" class="error">{{ error }}</p>
      <ion-grid v-if="dash">
        <ion-row>
          <ion-col class="kpi"><b>{{ dash.open_count }}</b><span>Open jobs</span></ion-col>
          <ion-col class="kpi"><b>{{ dash.today_count }}</b><span>Today</span></ion-col>
          <ion-col class="kpi"><b>₹{{ dash.month_completed_revenue }}</b><span>Month ₹</span></ion-col>
        </ion-row>
      </ion-grid>
      <ion-list v-if="dash">
        <ion-item v-for="(count, status) in dash.by_status" :key="status" :router-link="`${BASE}/jobs?status=${status}`">
          <ion-label>{{ status }}</ion-label>
          <ion-badge slot="end">{{ count }}</ion-badge>
        </ion-item>
      </ion-list>
      <ion-button expand="block" :router-link="`${BASE}/jobs`">All jobs</ion-button>
      <ion-list>
        <ion-item :router-link="`${BASE}/counters`"><ion-label>Counter sales</ion-label></ion-item>
        <ion-item :router-link="`${BASE}/customers`"><ion-label>Customers</ion-label></ion-item>
        <ion-item :router-link="`${BASE}/payments`"><ion-label>Payments</ion-label></ion-item>
        <ion-item :router-link="`${BASE}/labour`"><ion-label>Labour rates</ion-label></ion-item>
        <ion-item :router-link="`${BASE}/catalog`"><ion-label>Vehicle catalog</ion-label></ion-item>
        <ion-item :router-link="`${BASE}/analytics`"><ion-label>Analytics</ion-label></ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel, IonBadge } from "@ionic/vue"
import { workshop, logout, BASE } from "../api.js"

const dash = ref(null)
const error = ref("")

onMounted(async () => {
  try { dash.value = await workshop.dashboard() }
  catch (e) { error.value = e.message }
})

async function doLogout() { await logout() }
</script>
