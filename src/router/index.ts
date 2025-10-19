import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/clipboard",
  },
  {
    path: "/clipboard",
    name: "clipboard",
    component: () => import("../pages/History.vue"),
  },
  {
    path: "/history",
    redirect: "/clipboard",
  },
  {
    path: "/ai",
    name: "ai-tools",
    component: () => import("../pages/AiTools.vue"),
  },
  {
    path: "/api",
    name: "api-config",
    component: () => import("../pages/ApiConfig.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/Settings.vue"),
  },
  {
    path: "/quick-panel",
    name: "quick-panel",
    component: () => import("../pages/QuickPanel.vue"),
  },
];
