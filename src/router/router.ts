// src/router.js 或 src/router.ts
import { createRouter, createMemoryHistory } from 'vue-router';
import type { RouteLocationNormalized } from 'vue-router';
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
        component: WorldMapView,
        props: (route: RouteLocationNormalized) => {
            console.log('Route query:', route.query);
            const worldData = route.query.worldData ? JSON.parse(route.query.worldData as string) : undefined;
            console.log('Parsed worldData:', worldData);
            return { worldData };
        }
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
