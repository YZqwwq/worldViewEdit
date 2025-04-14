// src/router.js 或 src/router.ts
import { createRouter, createMemoryHistory } from 'vue-router';
import ShowPanel from '../view/ShowPanel.vue'; // 修改为正确的路径
import WorldEditorView from '../view/WorldEditorView.vue'; // 导入世界观编辑器页面

const routes = [
    {
        path: '/',
        name: 'ShowPanel',
        component: ShowPanel,
    },
    // 添加世界观编辑器路由
    {
        path: '/editor',
        name: 'WorldEditor',
        component: WorldEditorView,
    },
    // 可以在这里添加更多路由
];

const router = createRouter({
    history: createMemoryHistory(),
    routes,
});

export default router;
