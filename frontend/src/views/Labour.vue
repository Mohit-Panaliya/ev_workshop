<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Labour Rates</ion-title>
      </ion-toolbar>
      <ion-toolbar><ion-searchbar v-model="search" placeholder="Service" @ionInput="reload" /></ion-toolbar>
    </ion-header>
    <ion-content>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-list>
        <ion-item v-for="l in rows" :key="l.name">
          <ion-label><h2>{{ l.service_name }}</h2><p>{{ l.category }} · GST {{ l.gst_rate }}%</p></ion-label>
          <b slot="end">₹{{ l.standard_rate }}</b>
        </ion-item>
      </ion-list>
      <ion-button expand="block" fill="outline" @click="exportCsv">Export CSV</ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSearchbar, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const rows = ref([])
const search = ref("")
const error = ref("")
let timer = null

async function load() {
  try { rows.value = await workshop.labour({ search: search.value || undefined }) }
  catch (e) { error.value = e.message }
}
function reload() { clearTimeout(timer); timer = setTimeout(load, 300) }
function exportCsv() { window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=labour_masters`, "_blank") }
onMounted(load)
</script>
