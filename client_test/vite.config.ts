import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5357,
		proxy: {
			'/api': {
				target: 'http://localhost:3002',
				changeOrigin: true,
				secure: false,
				configure: (proxy:any, _options:any) => {
					proxy.on('error', (err:any, _req:any, _res:any) => {
						console.log('proxy error', err);
					});
					proxy.on('proxyReq', (proxyReq:any, req:any, _res:any) => {
						console.log('Sending Request to the Target:', req.method, req.url);
					});
					proxy.on('proxyRes', (proxyRes:any, req:any, _res:any) => {
						console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
					});
				},
			}
		}
	}
})