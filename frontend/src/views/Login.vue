<template>
  <ion-page>
    <ion-header><ion-toolbar><ion-title>EV Workshop</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <h2>Sign in</h2>
      <p>Use your workshop login (e.g. Mechanic / Supervisor account).</p>
      <ion-item>
        <ion-input label="Username" v-model="usr" autocomplete="username" />
      </ion-item>
      <ion-item>
        <ion-input label="Password" type="password" v-model="pwd" @keyup.enter="doLogin" />
      </ion-item>
      <p v-if="error" class="error">{{ error }}</p>
      <ion-button expand="block" :disabled="busy" @click="doLogin">Login</ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref } from "vue"
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonButton } from "@ionic/vue"
import { login } from "../api.js"

const usr = ref("")
const pwd = ref("")
const error = ref("")
const busy = ref(false)

async function doLogin() {
  error.value = ""
  busy.value = true
  try {
    await login(usr.value.trim(), pwd.value)
  } catch (e) {
    error.value = e.message
    busy.value = false
  }
}
</script>
