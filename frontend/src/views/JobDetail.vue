<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button default-href="/workshop/jobs" /></ion-buttons>
        <ion-title>{{ name }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="job">
        <h2>{{ job.name }} <span :class="['status-chip', job.status]">{{ job.status }}</span></h2>
        <p><b>{{ job.customer_name }}</b> · {{ job.mobile_no }}<br>
        {{ ownership.registration_no }} · {{ ownership.model }} · {{ job.service_type }} · {{ job.date }}</p>

        <h3>Complaints</h3>
        <p>{{ job.complaints }}</p>

        <h3>Items ({{ (job.items || []).length }})</h3>
        <ion-list>
          <ion-item v-for="(it, i) in job.items" :key="i">
            <ion-label>
              <h2>{{ it.item_name || it.item_no }} × {{ it.qty }}</h2>
              <p>Rate ₹{{ it.rate }} · Tax ₹{{ it.tax_amount }}</p>
            </ion-label>
            <b slot="end">₹{{ it.total_amount }}</b>
          </ion-item>
        </ion-list>
        <h3>Total: ₹{{ job.grand_total }}</h3>

        <div v-if="allowed.length">
          <h3>Next step</h3>
          <ion-button v-for="s in allowed" :key="s" expand="block" :disabled="busy" @click="advance(s)">
            Move to {{ s }}
          </ion-button>
        </div>
        <ion-button expand="block" fill="outline" :disabled="busy" @click="shareQuote">Share quote on WhatsApp</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop } from "../api.js"

const props = defineProps({ name: String })
const job = ref(null)
const ownership = ref({})
const allowed = ref([])
const error = ref("")
const busy = ref(false)

async function load() {
  error.value = ""
  try {
    const r = await workshop.job(props.name)
    job.value = r.job
    ownership.value = r.ownership || {}
    allowed.value = r.allowed_next || []
  } catch (e) { error.value = e.message }
}

async function advance(to) {
  busy.value = true
  error.value = ""
  try {
    const r = await workshop.advance(props.name, to)
    job.value.status = r.status
    allowed.value = []
    await load()
  } catch (e) { error.value = e.message }
  busy.value = false
}

async function shareQuote() {
  busy.value = true
  try {
    const r = await workshop.quoteUrl(props.name)
    window.open(r.url, "_blank")
  } catch (e) { error.value = e.message }
  busy.value = false
}

onMounted(load)
</script>
