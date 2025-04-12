// src/router.js 或 src/router.ts
import { createRouter, createWebHistory } from 'vue-router';
import ShowPanel from '../view/ShowPanel.vue'; // 修改为正确的路径
import App from '../App.vue';

const routes = [
    {
        path: '/',
        name: 'ShowPanel',
        component: ShowPanel,
    },
    // 可以在这里添加更多路由
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
