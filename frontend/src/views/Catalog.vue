<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="BASE" /></ion-buttons>
        <ion-title>Vehicle Catalog</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-list v-for="b in brands" :key="b.name">
        <ion-list-header>{{ b.brand_name }}</ion-list-header>
        <ion-item v-for="m in b.models" :key="m.name">
          <ion-label><h2>{{ m.model_name }}</h2><p>{{ m.battery_type || "—" }}</p></ion-label>
        </ion-item>
        <ion-item v-if="!b.models.length"><ion-label><p>No models yet</p></ion-label></ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonListHeader, IonItem, IonLabel } from "@ionic/vue"
import { workshop, BASE } from "../api.js"

const brands = ref([])
const error = ref("")
onMounted(async () => {
  try { brands.value = await workshop.catalog() }
  catch (e) { error.value = e.message }
})
</script>
