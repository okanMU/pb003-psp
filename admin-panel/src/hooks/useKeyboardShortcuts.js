import { useEffect } from 'react';

/**
 * Custom hook for keyboard shortcuts
 * Extracted from ManualCheckEnhanced component
 */
export const useKeyboardShortcuts = ({
  onApprove,
  onReject,
  onNext,
  onPrevious,
  onToggleSelect,
  onBatchApprove,
  enabled = true,
}) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'enter':
          e.preventDefault();
          onApprove?.();
          break;

        case 'r':
          e.preventDefault();
          onReject?.();
          break;

        case 'arrowdown':
        case 'j':
          e.preventDefault();
          onNext?.();
          break;

        case 'arrowup':
        case 'k':
          e.preventDefault();
          onPrevious?.();
          break;

        case ' ':
          e.preventDefault();
          onToggleSelect?.();
          break;

        case 'b':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onBatchApprove?.();
          }
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onApprove, onReject, onNext, onPrevious, onToggleSelect, onBatchApprove]);

  return null;
};

/**
 * Shortcut definitions for display
 */
export const KEYBOARD_SHORTCUTS = [
  { key: 'Enter', description: 'Approve current transaction' },
  { key: 'R', description: 'Reject current transaction' },
  { key: '↓ / J', description: 'Next transaction' },
  { key: '↑ / K', description: 'Previous transaction' },
  { key: 'Space', description: 'Toggle selection' },
  { key: 'Ctrl/Cmd + B', description: 'Batch approve selected' },
];
