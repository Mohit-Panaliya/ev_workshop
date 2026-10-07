<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Counter Sales</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="search" placeholder="Invoice / walk-in" @ionInput="reload" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-list>
        <ion-item v-for="i in rows" :key="i.name" :router-link="`${BASE}/counters/${i.name}`">
          <ion-label>
            <h2>{{ i.name }} — {{ i.customer || i.walkin_name || "Walk-in" }}</h2>
            <p>{{ i.invoice_date }} · Outstanding ₹{{ (outstanding[i.name] ?? 0).toFixed(2) }}</p>
          </ion-label>
          <b slot="end">₹{{ i.grand_total }}</b>
        </ion-item>
      </ion-list>
      <ion-button v-if="hasMore" expand="block" fill="clear" @click="more">Load more</ion-button>
      <ion-button expand="block" fill="outline" @click="exportCsv">Export CSV</ion-button>
      <p class="hint">New counter sales are created in Desk (Counter Invoice). Receipts print from the detail view.</p>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSearchbar, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const rows = ref([])
const outstanding = ref({})
const search = ref("")
const hasMore = ref(false)
const error = ref("")
let timer = null, offset = 0

async function load(reset = true) {
  error.value = ""
  try {
    if (reset) { offset = 0; rows.value = [] }
    const r = await workshop.counters({ search: search.value || undefined, limit: 20, offset })
    rows.value = reset ? r.invoices : [...rows.value, ...r.invoices]
    outstanding.value = { ...outstanding.value, ...r.outstanding }
    hasMore.value = r.has_more
    offset += r.invoices.length
  } catch (e) { error.value = e.message }
}
function reload() { clearTimeout(timer); timer = setTimeout(() => load(true), 300) }
function more() { load(false) }
function exportCsv() { window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=counter_invoices`, "_blank") }
onMounted(() => load(true))
</script>

<style scoped>.hint { font-size: 12px; color: #64748b; padding: 0 16px; }</style>
