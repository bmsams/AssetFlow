/**
 * Accessibility Components and Utilities
 * Implements Requirement 11.8: Keyboard navigation and screen reader accessibility (WCAG 2.1 AA)
 */

export { FocusTrap, type FocusTrapProps } from './FocusTrap';
export { VisuallyHidden, type VisuallyHiddenProps } from './VisuallyHidden';
export { LiveRegion, Announcer, type LiveRegionProps, type Politeness, type AnnouncerProps } from './LiveRegion';
export { SkipLink, type SkipLinkProps } from './SkipLink';
export {
  useFocusManagement,
  type UseFocusManagementOptions,
  type UseFocusManagementReturn,
} from './useFocusManagement';
export {
  useKeyboardNavigation,
  type UseKeyboardNavigationOptions,
  type UseKeyboardNavigationReturn,
} from './useKeyboardNavigation';
export {
  useAnnounce,
  type UseAnnounceReturn,
} from './useAnnounce';
export {
  useRovingTabIndex,
  type UseRovingTabIndexOptions,
  type UseRovingTabIndexReturn,
} from './useRovingTabIndex';
