import type { InspektApi } from '../shared/api.ts'

declare global {
  interface Window {
    inspekt: InspektApi
  }
}

export {}
