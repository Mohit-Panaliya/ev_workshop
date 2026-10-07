<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Jobs</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="search" placeholder="Job / customer / mobile" @ionInput="reload" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-select v-model="status" interface="popover" placeholder="All statuses" @ionChange="reload">
          <ion-select-option value="">All</ion-select-option>
          <ion-select-option v-for="s in statuses" :key="s" :value="s">{{ s }}</ion-select-option>
        </ion-select>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-list>
        <ion-item v-for="j in jobs" :key="j.name" :router-link="`${BASE}/jobs/${j.name}`">
          <ion-label>
            <h2>{{ j.name }} — {{ j.customer_name }}</h2>
            <p>{{ j.vehicle }} · {{ j.service_type }} · {{ j.date }}</p>
          </ion-label>
          <span slot="end" :class="['status-chip', j.status]">{{ j.status }}</span>
        </ion-item>
      </ion-list>
      <ion-button v-if="hasMore" expand="block" fill="clear" @click="more">Load more</ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRoute } from "vue-router"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSearchbar, IonSelect, IonSelectOption, IonContent, IonList, IonItem, IonLabel, IonButton } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const statuses = ["Admitted", "Inspection", "Quoted", "Approved", "Repairing", "Ready", "Completed", "Cancelled"]
const route = useRoute()
const jobs = ref([])
const search = ref("")
const status = ref(route.query.status || "")
const hasMore = ref(false)
const error = ref("")
let timer = null
let offset = 0

async function load(reset = true) {
  error.value = ""
  try {
    if (reset) { offset = 0; jobs.value = [] }
    const r = await workshop.jobs({ status: status.value || undefined, search: search.value || undefined, limit: 20, offset })
    jobs.value = reset ? r.jobs : [...jobs.value, ...r.jobs]
    hasMore.value = r.has_more
    offset += r.jobs.length
  } catch (e) { error.value = e.message }
}
function reload() { clearTimeout(timer); timer = setTimeout(() => load(true), 300) }
function more() { load(false) }
onMounted(() => load(true))
</script>
