import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./index.css";
import { routes } from "./router";

window.addEventListener("error", event => {
  console.error("Uncaught error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", event => {
  console.error("Unhandled promise rejection", event.reason);
});

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
