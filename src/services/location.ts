import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export async function getEmergencyLocation(): Promise<{
  latitude?: number;
  longitude?: number;
}> {
  const timeoutMs = 4000;

  // Try Capacitor Geolocation first
  if (Capacitor.isNativePlatform()) {
    try {
      const positionPromise = Geolocation.getCurrentPosition({
        timeout: timeoutMs,
        enableHighAccuracy: true,
        maximumAge: 60000,
      });

      const timeoutPromise = new Promise<{ coords?: { latitude: number; longitude: number } }>(
        (resolve) => setTimeout(() => resolve({}), timeoutMs)
      );

      const result: any = await Promise.race([positionPromise, timeoutPromise]);
      if (result && result.coords) {
        return {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        };
      }
    } catch {
      // Failed or timed out
    }
  }

  // Fallback to browser navigator.geolocation
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({});
      }, timeoutMs);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          clearTimeout(timer);
          resolve({});
        },
        {
          timeout: timeoutMs,
          maximumAge: 60000,
          enableHighAccuracy: false,
        }
      );
    });
  }

  return {};
}
