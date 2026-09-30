/**
 * A way for a component deep in a tab to send you to another tab — an empty
 * chart's "Log today" button — without every panel being handed an `onOpen`
 * prop down five levels. The shell registers the real navigator once.
 */
let navigator: ((tab: string) => void) | null = null;

export const registerNavigator = (fn: (tab: string) => void) => {
  navigator = fn;
};

export const navigateTo = (tab: string) => navigator?.(tab);
