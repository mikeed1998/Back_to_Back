import axios, { AxiosInstance } from 'axios';

export class HttpClient {
  private instance: AxiosInstance;

  constructor(baseURL: string) {
    console.log('🔗 Creating HttpClient with baseURL:', baseURL);
    
    this.instance = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        console.log(`➡️  REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        console.log(`➡️  Full URL: ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ REQUEST ERROR:', error.message);
        console.error('❌ Error code:', error.code);
        return Promise.reject(error);
      }
    );

    this.instance.interceptors.response.use(
      (response) => {
        console.log(`⬅️  RESPONSE: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ RESPONSE ERROR:', error.message);
        console.error('❌ Error code:', error.code);
        if (error.response) {
          console.error('❌ Response status:', error.response.status);
        }
        if (error.request) {
          console.error('❌ Request details:', error.request);
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
      console.error(`❌ Full error:`, error);
      throw new Error(`Cannot connect to user service: ${error.message}`);
    }
  }
}