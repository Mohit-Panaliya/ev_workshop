<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Payments</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-list>
        <ion-item v-for="p in rows" :key="p.name">
          <ion-label><h2>{{ p.party }}</h2><p>{{ p.posting_date }} · {{ p.mode_of_payment }} · {{ p.status }}</p></ion-label>
          <b slot="end">₹{{ p.paid_amount }}</b>
        </ion-item>
      </ion-list>
      <ion-button v-if="hasMore" expand="block" fill="clear" @click="more">Load more</ion-button>
      <ion-button expand="block" fill="outline" @click="exportCsv">Export CSV</ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const rows = ref([])
const hasMore = ref(false)
const error = ref("")
let offset = 0

async function load(reset = true) {
  try {
    if (reset) { offset = 0; rows.value = [] }
    const r = await workshop.payments({ limit: 20, offset })
    rows.value = reset ? r.payments : [...rows.value, ...r.payments]
    hasMore.value = r.has_more
    offset += r.payments.length
  } catch (e) { error.value = e.message }
}
function more() { load(false) }
function exportCsv() { window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=payments`, "_blank") }
onMounted(() => load(true))
</script>
