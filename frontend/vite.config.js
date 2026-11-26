import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'ethereum', test: /node_modules[\\/](viem|ox|abitype|@noble|@scure)[\\/]/ },
          ],
        },
      },
    },
  },
})
