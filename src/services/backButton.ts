import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

type BackHandler = () => boolean; // return true if handled

const backHandlers: BackHandler[] = [];

export function registerBackButtonHandler(handler: BackHandler): () => void {
  backHandlers.unshift(handler);
  return () => {
    const idx = backHandlers.indexOf(handler);
    if (idx !== -1) {
      backHandlers.splice(idx, 1);
    }
  };
}

let isInitialized = false;

export function initBackButtonListener() {
  if (isInitialized) return;
  isInitialized = true;

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', () => {
      for (const handler of backHandlers) {
        if (handler()) {
          return;
        }
      }
    });
  }

  // Also support browser back / popstate if user taps mobile browser back
  window.addEventListener('popstate', () => {
    for (const handler of backHandlers) {
      if (handler()) {
        return;
      }
    }
  });
}
