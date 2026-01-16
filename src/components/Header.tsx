import React from 'react';

interface HeaderProps {
    userEmail: string;
    onLogout?: () => void;
}

export function Header({ userEmail, onLogout }: HeaderProps) {
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo / Title */}
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Controle de Operações</h1>
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="font-medium">{userEmail}</span>
                        </div>

                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 px-3 py-1.5 rounded-full transition-colors font-bold"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                SAIR
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
