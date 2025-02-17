export const routes = [
    {
        path: '/panel',
        name: 'panel',
        component: () => import('../pages/Panel.vue')
    },
    {
        path: '/',
        name: 'home',
        component: () => import('../pages/Home.vue')
    },
]