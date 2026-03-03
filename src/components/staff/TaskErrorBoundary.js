'use client';
import React from 'react';

/**
 * TaskErrorBoundary – Global Error Boundary for staff task screens.
 * Catches client-side crashes in any child component and renders a
 * clean fallback UI with a "Restablecer Tarea" (Reset Task) button
 * instead of the generic Next.js client-side exception screen.
 */
export default class TaskErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('[TaskErrorBoundary] Caught error:', error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-10">
                    <div className="w-full max-w-md">
                        <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(220,38,38,0.25)]">
                            {/* Icon */}
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                </svg>
                            </div>

                            <p className="m-0 text-center text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-500">
                                Error técnico
                            </p>
                            <h2 className="mt-1 text-center text-xl font-black text-slate-900">
                                La tarea tuvo un problema
                            </h2>
                            <p className="mt-2 text-center text-sm font-medium leading-relaxed text-slate-600">
                                Ocurrió un error inesperado. Tu progreso no se ha perdido. Presiona el botón para restablecer esta tarea e intentar nuevamente.
                            </p>

                            {/* Error detail (collapsed) */}
                            <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <summary className="cursor-pointer text-xs font-bold text-slate-500">
                                    Detalle técnico
                                </summary>
                                <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[10px] text-red-600">
                                    {this.state.error?.message || 'Unknown error'}
                                    {this.state.errorInfo?.componentStack
                                        ? `\n\nComponent Stack:${this.state.errorInfo.componentStack.slice(0, 300)}`
                                        : ''}
                                </pre>
                            </details>

                            <div className="mt-5 grid grid-cols-1 gap-2.5">
                                <button
                                    type="button"
                                    onClick={this.resetError}
                                    className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_16px_28px_-18px_rgba(37,99,235,0.6)] transition hover:bg-blue-700 active:scale-[0.99]"
                                >
                                    Restablecer Tarea
                                </button>

                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Recargar App
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
