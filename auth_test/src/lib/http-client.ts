import axios, { AxiosInstance } from 'axios';


export class HttpClient {
	private instance: AxiosInstance;

	constructor(baseURL: string, private clientId?: string, private clientSecret?: string) {
        console.log('🔗 Creating HttpClient with baseURL:', baseURL);
        console.log('🔑 Client ID:', clientId ? 'PRESENT' : 'MISSING');
        console.log('🔑 Client Secret:', clientSecret ? 'PRESENT' : 'MISSING');
        
        this.instance = axios.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': clientId,
                'x-client-secret': clientSecret
            },
            family: 4,
        });

        this.setupInterceptors();
    }

	private setupInterceptors() {
		this.instance.interceptors.request.use(
			(config: any) => {
				console.log(`➡️  REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
				console.log(`🔑 Headers:`, {
					'x-client-id': config.headers['x-client-id'] ? 'PRESENT' : 'MISSING',
					'x-client-secret': config.headers['x-client-secret'] ? 'PRESENT' : 'MISSING'
				});
				console.log(`📦 Body:`, {
					username: config.data?.username,
					password: config.data?.password ? '***' : 'MISSING'
				});
				return config;
			},
			(error: any) => {
				console.error('❌ REQUEST ERROR:', error.message);
				return Promise.reject(error);
			}
		);

		this.instance.interceptors.response.use(
			(response: any) => {
				console.log(`⬅️  RESPONSE: ${response.status} ${response.config.url}`);
				return response;
			},
			(error: any) => {
				console.error('❌ RESPONSE ERROR:', error.message);
				
				if (error.code === 'ECONNREFUSED') {
					console.error('❌ Connection refused - is the external auth service running?');
					error.message = 'Authentication service unavailable';
				} else if (error.response) {
					console.error('❌ Response status:', error.response.status);
					console.error('❌ Response data:', error.response.data);
					
					// Para errores 404, mejorar el mensaje
					if (error.response.status === 404) {
						error.message = 'Invalid email or password';
					}
				}
				
				return Promise.reject(error);
			}
		);
	}
	
	async get<T>(url: string): Promise<T> {
		try {
			console.log(`📡 GET: ${url}`);
			const response = await this.instance.get(url);
			return response.data;
		} catch (error: any) {
			console.error(`❌ GET ${url} failed:`, error.message);
			throw error;
		}
	}

	async post<T>(url: string, data: any): Promise<T> {
		try {
			console.log(`📡 POST: ${url}`);
			console.log(`📦 Request data:`, JSON.stringify(data));
			const response = await this.instance.post(url, data);
			return response.data;
		} catch (error: any) {
			console.error(`❌ POST ${url} failed:`, error.message);
			throw error;
		}
	}

	async put<T>(url: string, data: any): Promise<T> {
		try {
			console.log(`📡 PUT: ${url}`);
			const response = await this.instance.put(url, data);
			return response.data;
		} catch (error: any) {
			console.error(`❌ PUT ${url} failed:`, error.message);
			throw error;
		}
	}

	async delete<T>(url: string): Promise<T> {
		try {
			console.log(`📡 DELETE: ${url}`);
			const response = await this.instance.delete(url);
			return response.data;
		} catch (error: any) {
			console.error(`❌ DELETE ${url} failed:`, error.message);
			throw error;
		}
	}
}