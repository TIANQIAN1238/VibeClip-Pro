import { createApp } from "vue";
import App from "./App.vue";
import './index.css';

import { createWebHistory, createRouter } from 'vue-router'
import { routes } from './routes';

const router = createRouter({
    history: createWebHistory(),
    routes,
})

createApp(App)
    .use(router)
    .mount("#app");
