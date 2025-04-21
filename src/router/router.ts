// src/router.js 或 src/router.ts
import { createRouter, createMemoryHistory } from 'vue-router';
import ShowPanel from '../view/ShowPanel.vue';
import WorldEditorView from '../view/WorldEditorView.vue';
import WorldMapView from '../view/WorldMapView.vue';
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
            }
        ]
    },
    {
        path: '/map',
        name: 'WorldMap',
        component: WorldMapView
    },
    {
        path: '/characters',
        name: 'Characters',
        component: CharactersView
    }
];

const router = createRouter({
    history: createMemoryHistory(),
    routes,
});

export default router;
