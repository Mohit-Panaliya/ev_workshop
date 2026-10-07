<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="`${BASE}/customers`" /></ion-buttons>
        <ion-title>Customer 360</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="data">
        <h2>{{ data.profile.customer_name }}</h2>
        <p>{{ data.profile.mobile_no }} · {{ data.profile.email_id }} · {{ data.profile.city }}</p>
        <ion-grid><ion-row>
          <ion-col class="kpi"><b>₹{{ agg.billed }}</b><span>Billed</span></ion-col>
          <ion-col class="kpi"><b>₹{{ agg.paid }}</b><span>Paid</span></ion-col>
          <ion-col class="kpi"><b>₹{{ agg.outstanding }}</b><span>Due</span></ion-col>
        </ion-row></ion-grid>

        <h3>Vehicles ({{ data.vehicles.length }})</h3>
        <ion-list>
          <ion-item v-for="v in data.vehicles" :key="v.name">
            <ion-label><h2>{{ v.registration_no }} — {{ v.model }}</h2><p>{{ v.is_primary ? "Primary" : "Co-owner" }}</p></ion-label>
          </ion-item>
        </ion-list>

        <h3>Jobs ({{ data.jobs.length }})</h3>
        <ion-list>
          <ion-item v-for="j in data.jobs" :key="j.name" :router-link="`${BASE}/jobs/${j.name}`">
            <ion-label><h2>{{ j.name }}</h2><p>{{ j.date }} · ₹{{ j.grand_total }}</p></ion-label>
            <span slot="end" :class="['status-chip', j.status]">{{ j.status }}</span>
          </ion-item>
        </ion-list>

        <h3>Statement</h3>
        <ion-item>
          <ion-input label="From" type="date" v-model="fromDate" />
          <ion-input label="To" type="date" v-model="toDate" />
        </ion-item>
        <ion-button expand="block" fill="outline" @click="loadStatement">Show statement</ion-button>
        <ion-list>
          <ion-item v-for="s in statement" :key="s.name">
            <ion-label><h2>{{ s.name }} · {{ s.posting_date }}</h2><p>Paid ₹{{ s.paid_amount }}</p></ion-label>
            <span slot="end">Due ₹{{ s.outstanding_amount }}</span>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel, IonInput, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const props = defineProps({ name: String })
const data = ref(null)
const statement = ref([])
const fromDate = ref("")
const toDate = ref("")
const error = ref("")
const agg = computed(() => data.value?.aggregates || { billed: 0, paid: 0, outstanding: 0 })

async function load() {
  try { data.value = await workshop.customer(decodeURIComponent(props.name)) }
  catch (e) { error.value = e.message }
}
async function loadStatement() {
  try { statement.value = await workshop.statement(decodeURIComponent(props.name), fromDate.value || undefined, toDate.value || undefined) }
  catch (e) { error.value = e.message }
}
onMounted(load)
</script>
