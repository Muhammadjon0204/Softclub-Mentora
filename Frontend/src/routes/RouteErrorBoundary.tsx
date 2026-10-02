import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { ErrorState } from '../shared/ui/ErrorState';

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: unknown;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Page crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <ErrorState
          error={this.state.error}
          title="Что-то пошло не так на этой странице"
          onRetry={() => {
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Without a boundary an exception during render unmounts the whole app — the blank white page both a
 * Lead and a Mentor got from one malformed submission. This keeps the layout and navigation alive and
 * shows a retry instead. Keyed by path, so moving to another page clears the error.
 */
export function RouteErrorBoundary({ children }: BoundaryProps): JSX.Element {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
