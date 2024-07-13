import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SneakerView from '@/views/SneakerView.vue'
import EmailVerificationView from '../views/EmailVerificationView.vue'
import SearchView from '@/views/SearchView.vue'
import CartView from '@/views/CartView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import CGUView from '@/views/legal/CGUView.vue'
import { checkAuth } from '@/helpers/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/verify-email',
      name: 'email_verification',
      component: EmailVerificationView
    },
    {
      path: '/search',
      name: 'search',
      component: SearchView
    },
    {
      path: '/sneakers/:slugSneaker',
      name: 'sneakers',
      component: SneakerView
    },
    {
      path: '/cart',
      name: 'cart',
      component: CartView
    },
    {
      path: '/reset-password',
      name: 'reset_password',
      component: ResetPasswordView
    },
    {
      path: '/legal',
      children: [{ path: 'cgu', component: CGUView }]
    }
  ]
})

router.afterEach(() => {
  checkAuth()
})

router.afterEach(() => {
  checkAuth()
})

export default router
