import { createApp } from "vue"
import { IonicVue } from "@ionic/vue"
import router from "./router.js"
import App from "./App.vue"

/* Ionic core CSS */
import "@ionic/vue/css/core.css"
import "@ionic/vue/css/normalize.css"
import "@ionic/vue/css/structure.css"
import "@ionic/vue/css/typography.css"
import "@ionic/vue/css/padding.css"
import "./theme.css"

const app = createApp(App).use(IonicVue).use(router)
router.isReady().then(() => app.mount("#app"))
