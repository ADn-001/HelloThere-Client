/**
 * Retrieves the current geolocation of the device
 * @returns {Promise} Resolves with geolocation data or rejects with an error
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    console.log('[Geolocation] Requesting current position');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[Geolocation] Position obtained:', position.coords);
        resolve(position);
      },
      (error) => {
        console.error('[Geolocation] Error:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
};