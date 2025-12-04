/**
 * IP Detection Utility
 * Automatically detects the computer's IP address for backend connection
 */

/**
 * Extract IP address from Expo dev server connection
 * When running in Expo, we can get the dev server IP from the connection
 */
const getIPFromExpoConnection = () => {
  try {
    // Try multiple methods to get the IP from Expo connection
    
    // Method 1: Try global.__expo.manifestUrl
    if (typeof global !== 'undefined' && global.__expo) {
      const manifestUrl = global.__expo.manifestUrl;
      if (manifestUrl) {
        // Extract IP from URLs like: exp://192.168.1.100:8081 or http://192.168.1.100:8081
        // Also match 172.x.x.x and 10.x.x.x addresses
        const ipMatch = manifestUrl.match(/(?:exp|http):\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (ipMatch && ipMatch[1]) {
          return ipMatch[1];
        }
      }
      
      // Method 2: Try other Expo connection properties
      if (global.__expo && global.__expo.packagerInfo) {
        const packagerInfo = global.__expo.packagerInfo;
        if (packagerInfo && packagerInfo.packagerPort) {
          // Try to extract from packager URL
          const packagerUrl = packagerInfo.debuggerHost || packagerInfo.expoGoUrl;
          if (packagerUrl) {
            const ipMatch = packagerUrl.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
            if (ipMatch && ipMatch[1]) {
              return ipMatch[1];
            }
          }
        }
      }
    }
    
    // Method 3: Try to get from Metro bundler connection
    // Check if we can access the bundler URL
    if (typeof global !== 'undefined' && global.__fbBatchedBridge) {
      // Metro bundler might have connection info
      try {
        const location = window?.location || global.location;
        if (location && location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          const ipMatch = location.hostname.match(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/);
          if (ipMatch) {
            return location.hostname;
          }
        }
      } catch (e) {
        // Ignore
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Test if backend is accessible at a given IP
 */
const testBackendConnection = async (ip) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 2000); // 2 second timeout
    
    fetch(`http://${ip}:8000/health`, {
      method: 'GET',
    })
      .then(response => {
        clearTimeout(timeout);
        resolve(response.ok);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
  });
};

/**
 * Get subnet from an IP address
 * Returns the subnet prefix (e.g., "192.168.1" from "192.168.1.100")
 */
const getSubnetFromIP = (ip) => {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return parts.slice(0, 3).join('.');
  }
  return null;
};

/**
 * Detect IP by scanning the device's own subnet first, then common ranges
 * This is much more efficient, especially for university networks
 */
const detectIPByScanning = async (deviceIP = null) => {
  console.log('🔍 Scanning for backend...');
  
  const testIPs = [];
  
  // Method 1: If we have the device IP, scan its subnet first (most likely to work)
  if (deviceIP) {
    const subnet = getSubnetFromIP(deviceIP);
    if (subnet) {
      console.log(`📍 Scanning device subnet: ${subnet}.x`);
      // Scan the same subnet as the device (most efficient)
      // Try a range around the device IP first, then expand
      const deviceLastOctet = parseInt(deviceIP.split('.')[3]);
      
      // Scan from device IP ± 20 addresses first (fast path)
      for (let offset = -20; offset <= 20; offset++) {
        const testOctet = deviceLastOctet + offset;
        if (testOctet >= 1 && testOctet <= 254) {
          testIPs.push(`${subnet}.${testOctet}`);
        }
      }
      
      // Then scan the rest of the subnet
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        if (!testIPs.includes(ip)) {
          testIPs.push(ip);
        }
      }
    }
  }
  
  // Method 2: If no device IP, scan common network ranges
  // Include both home networks (192.168.x.x) and university networks (172.x.x.x)
  if (!deviceIP) {
    // Scan common home network ranges (original working code)
    const commonHomeRanges = [
      '192.168.1',
      '192.168.0',
      '192.168.2',
    ];
    
    commonHomeRanges.forEach(subnet => {
      for (let i = 1; i <= 100; i++) {
        const ip = `${subnet}.${i}`;
        if (!testIPs.includes(ip)) {
          testIPs.push(ip);
        }
      }
    });
    
    // Also scan common university/enterprise 172.x ranges
    // Scan common 172.16-31.x.x subnets (private IP range)
    // Focus on ranges commonly used by universities
    const common172Ranges = [
      '172.20.0',
      '172.21.0',
      '172.22.0',
      '172.23.0',
      '172.24.0',  // Your network is in this range!
      '172.25.0',
      '172.26.0',
      '172.16.0',
      '172.17.0',
      '172.18.0',
    ];
    
    // Scan 172.24.x.x more thoroughly - scan common third octets
    // Universities often use specific subnet ranges
    // Put 171 first since that's likely your subnet, and scan around 151 first
    const commonThirdOctets = [171, 170, 172, 0, 1, 10, 20, 30, 50, 100, 150, 200, 250];
    commonThirdOctets.forEach(thirdOctet => {
      const subnet = `172.24.${thirdOctet}`;
      
      // For 172.24.171.x, prioritize scanning around 151 first (your IP)
      if (thirdOctet === 171) {
        // Scan around 151 first (fast path)
        for (let offset = -30; offset <= 30; offset++) {
          const testOctet = 151 + offset;
          if (testOctet >= 1 && testOctet <= 254) {
            const ip = `${subnet}.${testOctet}`;
            if (!testIPs.includes(ip)) {
              testIPs.push(ip);
            }
          }
        }
        // Then scan the rest
        for (let i = 1; i <= 254; i++) {
          const ip = `${subnet}.${i}`;
          if (!testIPs.includes(ip)) {
            testIPs.push(ip);
          }
        }
      } else {
        // For other subnets, scan normally
        for (let i = 1; i <= 254; i++) {
          const ip = `${subnet}.${i}`;
          if (!testIPs.includes(ip)) {
            testIPs.push(ip);
          }
        }
      }
    });
    
    // Also scan other common 172.x ranges (but not 172.24.x since we already did that)
    common172Ranges.forEach(subnet => {
      if (!subnet.startsWith('172.24.')) {
        for (let i = 1; i <= 100; i++) {
          const ip = `${subnet}.${i}`;
          if (!testIPs.includes(ip)) {
            testIPs.push(ip);
          }
        }
      }
    });
  }
  
  // If we have a device IP in 172.x range, also scan common 172.x subnets as backup
  // This helps when device is on 172.x network but backend is on different subnet
  if (deviceIP && deviceIP.startsWith('172.')) {
    const secondOctet = parseInt(deviceIP.split('.')[1]);
    // If it's in the private 172.16-31 range, scan a few common ones
    if (secondOctet >= 16 && secondOctet <= 31) {
      const common172Ranges = [
        `172.${secondOctet}.0`,  // Same second octet
        '172.16.0',
        '172.17.0',
        '172.18.0',
      ];
      
      common172Ranges.forEach(subnet => {
        const deviceSubnet = getSubnetFromIP(deviceIP);
        if (subnet !== deviceSubnet) { // Don't re-scan already scanned subnet
          for (let i = 1; i <= 100; i++) {
            const ip = `${subnet}.${i}`;
            if (!testIPs.includes(ip)) {
              testIPs.push(ip);
            }
          }
        }
      });
    }
  }

  // Test in batches to avoid overwhelming the network
  const batchSize = 20;
  console.log(`🔍 Testing ${testIPs.length} IP addresses in batches of ${batchSize}...`);
  
  for (let i = 0; i < testIPs.length; i += batchSize) {
    const batch = testIPs.slice(i, i + batchSize);
    const promises = batch.map(ip => 
      testBackendConnection(ip).then(isValid => isValid ? ip : null)
    );
    
    const results = await Promise.all(promises);
    const foundIP = results.find(ip => ip !== null);
    
    if (foundIP) {
      return foundIP;
    }
    
    // Log progress occasionally (much less verbose)
    if ((i / batchSize) % 25 === 0 && testIPs.length > 50) {
      const progress = Math.min(100, Math.round((i / testIPs.length) * 100));
      if (progress % 25 === 0) { // Only log at 25%, 50%, 75%, 100%
        console.log(`🔍 Scanning progress: ${progress}%...`);
      }
    }
  }

  return null;
};

/**
 * Main function to detect the backend IP address
 * @param {boolean} allowScanning - If true, scan network even without Expo IP (default: false)
 * Returns the IP address or null if not found
 */
export const detectBackendIP = async (allowScanning = false) => {
  console.log('🔍 Auto-detecting backend IP address...');

  // Method 1: Try to get from Expo connection (fastest and most reliable)
  const expoIP = getIPFromExpoConnection();
  console.log('🔍 Expo IP extraction result:', expoIP || 'NOT FOUND');
  
  if (expoIP) {
    console.log('📍 Found IP from Expo connection:', expoIP);
    
    // Test if backend is accessible at this IP
    console.log('🔍 Testing backend connection at:', expoIP);
    const isValid = await testBackendConnection(expoIP);
    console.log('🔍 Backend health check result:', isValid ? 'SUCCESS' : 'FAILED');
    
    if (isValid) {
      console.log('✅ Verified backend at:', expoIP);
      return expoIP;
    }
    
    // Health check failed - scan the Expo IP's subnet
    console.log('⚠️ Backend not responding at Expo IP, scanning subnet...');
    const scannedIP = await detectIPByScanning(expoIP);
    if (scannedIP) {
      console.log('✅ Found backend at:', scannedIP);
      return scannedIP;
    }
    
    // If scanning failed, still trust the Expo IP - it's the computer's IP
    console.log('⚠️ Could not find backend in subnet, using Expo IP anyway:', expoIP);
    return expoIP;
  }

  // Method 2: No Expo IP - scan common ranges if allowed
  if (allowScanning) {
    console.log('🔍 Expo IP not found, scanning common network ranges...');
    const scannedIP = await detectIPByScanning(null);
    if (scannedIP) {
      console.log('✅ Found backend at:', scannedIP);
      return scannedIP;
    }
  }

  // If Expo IP wasn't found and scanning not allowed/failed
  console.warn('⚠️ Expo IP not available - cannot auto-detect');
  if (!allowScanning) {
    console.warn('💡 Please check Expo terminal for your computer\'s IP and enter it manually in Settings');
  }
  
  return null;
};

/**
 * Get the backend URL with detected or fallback IP
 * @param {string} fallbackIP - IP to use if detection fails (default: 192.168.1.128)
 * @returns {Promise<string>} Backend URL
 */
export const getBackendURL = async (fallbackIP = '192.168.1.128') => {
  const detectedIP = await detectBackendIP(true); // Allow scanning on startup too
  
  if (detectedIP) {
    const url = `http://${detectedIP}:8000`;
    console.log('✅ Using DETECTED backend URL:', url);
    return url;
  } else {
    const url = `http://${fallbackIP}:8000`;
    console.log('⚠️ Using FALLBACK backend URL:', url);
    console.warn('💡 Auto-detection failed. Please enter your computer\'s IP manually in Settings.');
    return url;
  }
};
