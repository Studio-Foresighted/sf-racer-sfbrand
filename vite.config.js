import { defineConfig } from 'vite'

import fs from 'fs'
import path from 'path'

export default defineConfig({
  // Configuration for plain JS project
  server: {
    port: 8005,
    open: false
  },
  plugins: [
    {
      name: 'handle-save-map',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/save_map') {
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })
            req.on('end', () => {
              try {
                const data = JSON.parse(body)
                // Save to map_data.json in the root directory
                const filePath = path.resolve(process.cwd(), 'map_data.json')
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4))
                
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ 
                  status: 'success', 
                  message: 'Map saved to map_data.json' 
                }))
                console.log('Map saved successfully to map_data.json')
              } catch (e) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ 
                  status: 'error', 
                  message: e.message 
                }))
                console.error(`Error saving map: ${e.message}`)
              }
            })
          } else {
            next()
          }
        })
      }
    }
  ]
})
