import { createRouter, createWebHistory } from "@ionic/vue-router"
import { loggedUser } from "./api.js"
import Login from "./views/Login.vue"
import Dashboard from "./views/Dashboard.vue"
import Jobs from "./views/Jobs.vue"
import JobDetail from "./views/JobDetail.vue"

export const BASE = window.location.pathname.startsWith("/evhub") ? "/evhub" : "/workshop"

function makeRoutes(base) {
  return [
    { path: `${base}/login`, component: Login },
    { path: base, component: Dashboard },
    { path: `${base}/jobs`, component: Jobs },
    { path: `${base}/jobs/:name`, component: JobDetail, props: true },
  ]
}

const routes = [...makeRoutes("/workshop"), ...makeRoutes("/evhub"), { path: "/:pathMatch(.*)*", redirect: () => BASE }]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (to.path === `${BASE}/login`) return true
  // Normalize cross-base hits (e.g. bookmarked /workshop link while on /evhub)
  if (to.path.startsWith("/workshop") && BASE === "/evhub") {
    return to.path.replace("/workshop", "/evhub")
  }
  if (to.path.startsWith("/evhub") && BASE === "/workshop") {
    return to.path.replace("/evhub", "/workshop")
  }
  const user = await loggedUser()
  if (!user) return `${BASE}/login`
  return true
})

export default router
