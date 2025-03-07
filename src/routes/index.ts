import Home from '../pages/Home.vue';
import Panel from '../pages/Panel.vue';

export const routes = [
    {
        path: '/panel',
        name: 'panel',
        component: Panel
    },
    {
        path: '/',
        name: 'home',
        component: Home
    },
]