const getCurrentLocation = () => {
  // If in WebView, request location from React Native
  if (window.ReactNativeWebView) {
    console.log('DEBUG: In WebView, requesting location');
    showToastMessage('Requesting location...');
    
    // Send message to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'requestLocation',
      timestamp: Date.now()
    }));
    
    return;
  }
  
  // Regular browser geolocation (for web app)
  if (!navigator.geolocation) {
    showToastMessage('Geolocation is not supported by your browser.');
    return;
  }
  
  showToastMessage('Requesting location permission...');
  
  // Show permission dialog to user
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      setCurrentEntry(prev => ({
        ...prev,
        latitude: latitude,
        longitude: longitude,
        address: `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }));
      
      showToastMessage('Location captured! Getting address...');
      
      // Get detailed address from coordinates
      await fetchAddressFromCoordinates(latitude, longitude);
    },
    (error) => {
      console.error('Geolocation error:', error);
      
      let errorMessage = 'Failed to get location';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please allow location access in your browser settings.';
          
          // Show helpful instructions
          setTimeout(() => {
            if (confirm('To enable location:\n1. Click the lock icon in address bar\n2. Click "Site settings"\n3. Allow "Location"\n\nOpen instructions?')) {
              window.open('https://support.google.com/chrome/answer/142065?hl=en', '_blank');
            }
          }, 1000);
          break;
          
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable. Please check if location services are enabled on your device.';
          break;
          
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.';
          break;
          
        default:
          errorMessage = 'An unknown error occurred while getting location.';
      }
      
      showToastMessage(errorMessage);
    },
    { 
      enableHighAccuracy: true,  // Use GPS if available
      timeout: 15000,           // Wait 15 seconds
      maximumAge: 0             // Don't use cached location
    }
  );
};
