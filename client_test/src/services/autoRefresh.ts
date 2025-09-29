import { getCurrentUser, setCurrentUser } from './api';
import api from './api';

class AutoRefreshService {
    private renewalInterval: NodeJS.Timeout | null = null;
    private isRenewing = false;
    private failureCount = 0;
    private readonly maxFailures = 5;
    private readonly renewalIntervalMs = 90 * 1000; 

    startAutoRefresh(): void {
        console.log('🔄 [AUTO-REFRESH] ===== STARTING SERVICE =====');
        console.log(`⏰ [AUTO-REFRESH] Will renew every ${this.renewalIntervalMs/1000} seconds`);
        
        this.stopAutoRefresh();
        
        this.renewalInterval = setInterval(() => {
            this.attemptRenewal();
        }, this.renewalIntervalMs);
        
        console.log('🚀 [AUTO-REFRESH] First renewal in 30 seconds...');
        setTimeout(() => this.attemptRenewal(), 30000);
    }

    stopAutoRefresh(): void {
        if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = null;
        }
        this.failureCount = 0;
        console.log('🛑 [AUTO-REFRESH] Service stopped');
    }

    private async attemptRenewal(): Promise<void> {
        if (this.isRenewing) {
            console.log('⏳ [AUTO-REFRESH] Already renewing, skipping...');
            return;
        }

        const user = getCurrentUser();
        if (!user?.id) {
            console.log('❌ [AUTO-REFRESH] No user ID available');
            this.stopAutoRefresh();
            return;
        }

        this.isRenewing = true;
        
        try {
            console.log(`🔄 [AUTO-REFRESH] Renewing token for user ${user.id}...`);
            
            const response = await api.post<{
                access_token: string;
                expires_in: number;
                refresh_token_updated: boolean;
            }>('/auth/renew-token', {}, {
                headers: { 
                    'X-User-ID': user.id.toString()
                    // 'X-Renewal-Attempt': this.failureCount.toString()
                }
            });

            this.failureCount = 0; 
            console.log('✅ [AUTO-REFRESH] Token renewed successfully!');
            
        } catch (error: any) {
            this.failureCount++;
            
            if (error.response) {
                if (error.response.status === 404) {
                    console.error('❌ [AUTO-REFRESH] Endpoint not found (404)');
                    console.log('💡 [AUTO-REFRESH] Checking if endpoint exists...');
                    this.checkEndpointExists();
                } else {
                    console.error(`❌ [AUTO-REFRESH] Server error: ${error.response.status}`);
                }
            } else if (error.code === 'ECONNREFUSED') {
                console.error('❌ [AUTO-REFRESH] Cannot connect to server');
            } else {
                console.error('❌ [AUTO-REFRESH] Error:', error.message);
            }

            if (this.shouldForceLogout()) {
                console.error('🚨 [AUTO-REFRESH] Critical failure detected');
                this.handleCriticalFailure();
            } else {
                console.log(`🔄 [AUTO-REFRESH] Will retry (attempt ${this.failureCount}/${this.maxFailures})`);
            }
        } finally {
            this.isRenewing = false;
        }
    }

    private shouldForceLogout(): boolean {
        return this.failureCount >= this.maxFailures;
    }

    private async checkEndpointExists(): Promise<void> {
        try {
            const response = await fetch('http://localhost:3002/api/v1/auth/renew-token', {
                method: 'OPTIONS',
                credentials: 'include'
            });
            console.log('🔍 [AUTO-REFRESH] Endpoint OPTIONS status:', response.status);
        } catch (error) {
            console.error('🔍 [AUTO-REFRESH] Cannot check endpoint:', error);
        }
    }

    private async handleCriticalFailure(): Promise<void> {
        console.error('🚨 [AUTO-REFRESH] Critical failure - verifying session before logout');
        
        try {
            const sessionResponse = await api.get('/auth/session');
            if (sessionResponse.data.valid) {
                console.log('✅ [AUTO-REFRESH] Session is still valid, keeping user logged in');
                this.failureCount = 0; // Reset counter
                return;
            }
        } catch (sessionError) {
            console.error('❌ [AUTO-REFRESH] Cannot verify session:', sessionError);
        }
        
        console.log('🔐 [AUTO-REFRESH] Session invalid, logging out...');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        this.stopAutoRefresh();
        
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }

    // Método para testing manual - MEJORADO
    async manualRenewal(): Promise<boolean> {
        console.log('🔧 [AUTO-REFRESH] Manual renewal requested');
        
        const user = getCurrentUser();
        if (!user?.id) {
            console.log('❌ [AUTO-REFRESH] No user for manual renewal');
            return false;
        }

        try {
            const response = await fetch('http://localhost:3002/api/v1/auth/renew-token', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': user.id.toString()
                },
                body: JSON.stringify({})
            });

            console.log('🔧 [MANUAL] Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔧 [MANUAL] Renewal successful:', data);
                return true;
            } else {
                const error = await response.text();
                console.error('🔧 [MANUAL] Renewal failed:', error);
                return false;
            }
        } catch (error) {
            console.error('🔧 [MANUAL] Renewal error:', error);
            return false;
        }
    }

    getStatus() {
        return {
            running: !!this.renewalInterval,
            renewing: this.isRenewing,
            failures: this.failureCount,
            healthy: this.failureCount < this.maxFailures,
            nextRenewalIn: this.renewalInterval ? this.renewalIntervalMs : 0
        };
    }

    debugInfo() {
        const user = getCurrentUser();
        return {
            service: this.getStatus(),
            user: user ? { id: user.id, email: user.email } : 'No user',
            timestamp: new Date().toISOString()
        };
    }
}

export const autoRefreshService = new AutoRefreshService();

if (typeof window !== 'undefined') {
    (window as any).$refresh = autoRefreshService;
    console.log('🔧 [AUTO-REFRESH] Debug commands available:');
    console.log('   - $refresh.manualRenewal() - Forzar renovación');
    console.log('   - $refresh.debugInfo() - Ver estado', (window as any).$refresh.debugInfo() );
}