<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="`${BASE}/counters`" /></ion-buttons>
        <ion-title>{{ name }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="inv">
        <h2>{{ inv.name }} <span class="status-chip">{{ inv.docstatus === 1 ? "Submitted" : "Draft" }}</span></h2>
        <p><b>{{ inv.customer || inv.walkin_name }}</b> {{ inv.walkin_mobile }}<br>{{ inv.invoice_date }}</p>
        <ion-list>
          <ion-item v-for="(it, i) in inv.items" :key="i">
            <ion-label><h2>{{ it.item_name || it.item_master }} × {{ it.qty }}</h2><p>MRP ₹{{ it.mrp }} · Tax ₹{{ it.tax_amount }}</p></ion-label>
            <b slot="end">₹{{ it.line_total }}</b>
          </ion-item>
        </ion-list>
        <p>CGST ₹{{ inv.cgst_amount }} · SGST ₹{{ inv.sgst_amount }} · Round {{ inv.round_off }}</p>
        <h3>Total ₹{{ inv.grand_total }} · Outstanding ₹{{ (outstanding ?? 0).toFixed(2) }}</h3>
        <ion-button expand="block" @click="printReceipt">Print receipt</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const props = defineProps({ name: String })
const inv = ref(null)
const outstanding = ref(null)
const error = ref("")

async function load() {
  try {
    const r = await workshop.counter(props.name)
    inv.value = r.invoice
    outstanding.value = r.outstanding
  } catch (e) { error.value = e.message }
}
function printReceipt() {
  window.open(`/printview?doctype=Counter%20Invoice&name=${props.name}&format=EV%20Counter%20Receipt`, "_blank")
}
onMounted(load)
</script>
