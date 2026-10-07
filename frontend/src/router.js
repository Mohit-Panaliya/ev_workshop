import { createRouter, createWebHistory } from "@ionic/vue-router"
import { loggedUser } from "./api.js"
import Login from "./views/Login.vue"
import Dashboard from "./views/Dashboard.vue"
import Jobs from "./views/Jobs.vue"
import JobDetail from "./views/JobDetail.vue"

const routes = [
  { path: "/workshop/login", component: Login },
  { path: "/workshop", component: Dashboard },
  { path: "/workshop/jobs", component: Jobs },
  { path: "/workshop/jobs/:name", component: JobDetail, props: true },
  { path: "/:pathMatch(.*)*", redirect: "/workshop" },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (to.path === "/workshop/login") return true
  const user = await loggedUser()
  if (!user) return "/workshop/login"
  return true
})

export default router
