'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">P</span>
                        </div>
                        <CardTitle className="text-2xl">PCOP</CardTitle>
                    </div>
                    <CardDescription>
                        Predictive Customer Outreach Platform
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="username" className="text-sm font-medium text-slate-700">
                                Username
                            </label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-slate-700">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>
                        
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-500 text-center mb-3">Demo Accounts</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-slate-50 rounded text-center">
                                <p className="font-medium text-slate-700">analyst</p>
                                <p className="text-slate-500">analyst123</p>
                            </div>
                            <div className="p-2 bg-slate-50 rounded text-center">
                                <p className="font-medium text-slate-700">manager</p>
                                <p className="text-slate-500">manager123</p>
                            </div>
                            <div className="p-2 bg-slate-50 rounded text-center">
                                <p className="font-medium text-slate-700">admin</p>
                                <p className="text-slate-500">admin123</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
