import { createApp } from 'vue'
import './style.css'
import './styles/prosemirror-override.scss'
import App from './App.vue'
import router from './router/router'

const app = createApp(App)
app.use(router)
app.mount('#app')
