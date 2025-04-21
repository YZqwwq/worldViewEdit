// src/router.js 或 src/router.ts
import { createRouter, createMemoryHistory } from 'vue-router';
import ShowPanel from '../view/ShowPanel.vue'; // 修改为正确的路径
import WorldEditorView from '../view/WorldEditorView.vue'; // 导入世界观编辑器页面
import WorldMapView from '../components/WorldMap/WorldMapView.vue';
import CharactersView from '../view/CharactersView.vue';
import WorkToolView from '../view/WorkToolView.vue';

const routes = [
    {
        path: '/',
        name: 'ShowPanel',
        component: ShowPanel,
    },
    {
        path: '/tool',
        name: 'WorkTool',
        component: WorkToolView
    },
    {
        path: '/editor',
        name: 'WorldEditor',
        component: WorldEditorView,
        children: [
            {
                path: 'world',
                name: 'WorldList',
                component: WorldEditorView
            },
            {
                path: 'world/:title',
                name: 'WorldTitle',
                component: WorldEditorView
            },
            {
                path: 'map',
                name: 'Map',
                component: WorldMapView
            },
            {
                path: 'characters',
                name: 'Characters',
                component: CharactersView
            }
        ]
    },
    // 可以在这里添加更多路由
];

const router = createRouter({
    history: createMemoryHistory(),
    routes,
});

export default router;
