export type NavigationIntent = 'branch' | 'in-place';

export type NavigationEvent =
  | { trigger: 'ctrl-click' }
  | { trigger: 'middle-click' }
  | { trigger: 'click' }
  | { trigger: 'window-open' }
  | { trigger: 'form-submission'; target: 'same-page' | 'new-window' };

export function resolveNavigationIntent(event: NavigationEvent): NavigationIntent {
  switch (event.trigger) {
    case 'ctrl-click':
    case 'middle-click':
    case 'window-open':
      return 'branch';
    case 'click':
      return 'in-place';
    case 'form-submission':
      return event.target === 'new-window' ? 'branch' : 'in-place';
  }
}
