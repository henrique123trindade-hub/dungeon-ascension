import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dungeon Ascension UI Error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0a0e] p-6 text-[#e8e3d9]">
          <div className="dark-panel w-full max-w-md p-6 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-[#f8e3a8]">
              Algo inesperado aconteceu
            </h1>
            <p className="text-sm text-[#b8afa1] leading-relaxed">
              Ocorreu um erro temporário na interface. Seu progresso salvo permanece protegido.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#b83232] hover:bg-[#cf3a3a] text-white font-display font-bold text-xs tracking-wider uppercase border border-[#e3b55c]/50 cursor-pointer"
            >
              Recarregar Jogo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
