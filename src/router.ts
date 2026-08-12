import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import SessionView from './views/SessionView.vue'
import HistoryView from './views/HistoryView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/session',
      name: 'session',
      component: SessionView,
      // A session is nothing without its seed; a bare URL goes back to setup.
      beforeEnter: (to) => (to.query.seed ? true : { name: 'home' }),
    },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
})
