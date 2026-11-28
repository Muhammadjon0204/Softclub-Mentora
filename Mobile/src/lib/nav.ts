import { router, type Href } from 'expo-router';

/** Back to where the person came from; a screen opened from a link has nowhere to go back to. */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
