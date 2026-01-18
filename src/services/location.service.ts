import { Injectable } from '@angular/core';

export interface GeoLocationState {
  coords: {
    latitude: number;
    longitude: number;
  } | null;
  manualAddress: string | null;
  error: string | null;
  loading: boolean;
  isFallbackMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  getInitialState(): GeoLocationState {
    return {
      coords: null,
      manualAddress: null,
      error: null,
      loading: false,
      isFallbackMode: false
    };
  }

  getCurrentPosition(): Promise<{latitude: number, longitude: number}> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation is not supported by your browser.');
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            let errorMessage = 'Unknown error getting location.';
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'User denied the request for Geolocation.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable.';
                break;
              case error.TIMEOUT:
                errorMessage = 'The request to get user location timed out.';
                break;
            }
            reject(errorMessage);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
    });
  }
}