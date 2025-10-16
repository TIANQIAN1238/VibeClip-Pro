import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/panel",
    name: "panel",
    component: () => import("../pages/Panel.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/Settings.vue"),
  },
  {
    path: "/",
    name: "history",
    component: () => import("../pages/History.vue"),
  },
];
