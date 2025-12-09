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
    // Try multiple methods to get IP from Expo connection
    if (typeof global !== 'undefined' && global.__expo) {
      // Method 1: Try manifestUrl (most common)
      const manifestUrl = global.__expo.manifestUrl;
      if (manifestUrl) {
        console.log('🔍 Checking manifestUrl:', manifestUrl);
        // Extract IP from URLs like: exp://192.168.1.100:8081 or http://192.168.1.100:8081
        // Works for all IP ranges: 192.168.x.x, 172.x.x.x, 10.x.x.x, etc.
        const ipMatch = manifestUrl.match(/(?:exp|http|https):\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (ipMatch && ipMatch[1]) {
          console.log('✅ Found IP in manifestUrl:', ipMatch[1]);
          return ipMatch[1];
        }
      }
      
      // Method 2: Try packagerInfo/debuggerHost
      if (global.__expo.packagerInfo) {
        const packagerInfo = global.__expo.packagerInfo;
        console.log('🔍 Checking packagerInfo:', packagerInfo);
        if (packagerInfo.debuggerHost) {
          const ipMatch = packagerInfo.debuggerHost.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
          if (ipMatch && ipMatch[1]) {
            console.log('✅ Found IP in debuggerHost:', ipMatch[1]);
            return ipMatch[1];
          }
        }
        if (packagerInfo.expoGoUrl) {
          const ipMatch = packagerInfo.expoGoUrl.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
          if (ipMatch && ipMatch[1]) {
            console.log('✅ Found IP in expoGoUrl:', ipMatch[1]);
            return ipMatch[1];
          }
        }
      }
      
      // Method 3: Try any URL strings in __expo
      try {
        const checkForIP = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          for (const key in obj) {
            const value = obj[key];
            if (typeof value === 'string') {
              const ipMatch = value.match(/(?:exp|http|https):\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
              if (ipMatch && ipMatch[1] && !ipMatch[1].startsWith('127.') && !ipMatch[1].startsWith('0.')) {
                return ipMatch[1];
              }
            } else if (typeof value === 'object' && value !== null) {
              const found = checkForIP(value);
              if (found) return found;
            }
          }
          return null;
        };
        const foundIP = checkForIP(global.__expo);
        if (foundIP) {
          console.log('✅ Found IP in __expo properties:', foundIP);
          return foundIP;
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return null;
  } catch (error) {
    console.log('❌ Error extracting Expo IP:', error);
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
 * Works with any IP range: 192.168.x.x, 172.x.x.x, 10.x.x.x, etc.
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
  
  // Method 2: If no device IP, do a very limited smart scan (max 30 IPs total)
  // PRIORITIZE 172.x.x.x (university networks) FIRST, then 192.x.x.x (home networks)
  if (!deviceIP) {
    // University networks - prioritize these FIRST since user is on university WiFi
    // Check known backend IPs first
    testIPs.push('172.24.171.151'); // Your known backend IP - check first!
    testIPs.push('172.24.171.150');
    testIPs.push('172.24.171.152');
    // Sample common 172.x ranges more thoroughly
    ['172.24.171', '172.24.0', '172.20.0', '172.16.0'].forEach(subnet => {
      for (let i = 1; i <= 254; i += 30) { // More thorough sampling
        testIPs.push(`${subnet}.${i}`);
      }
    });
    
    // Home networks - check these LAST (only if university scan fails)
    const homeRanges = ['192.168.1'];
    homeRanges.forEach(subnet => {
      // Only scan a few common addresses (every 30th IP)
      for (let i = 1; i <= 100; i += 30) {
        testIPs.push(`${subnet}.${i}`);
      }
    });
  }

  // Test in batches - limit to 50 IPs max to ensure we check both 172.x.x.x and 192.x.x.x ranges
  const maxIPsToScan = 50;
  const limitedTestIPs = testIPs.slice(0, maxIPsToScan);
  
  const batchSize = 10; // Smaller batches for faster response
  console.log(`🔍 Testing ${limitedTestIPs.length} IP addresses (quick scan)...`);
  
  for (let i = 0; i < limitedTestIPs.length; i += batchSize) {
    const batch = limitedTestIPs.slice(i, i + batchSize);
    const promises = batch.map(ip => 
      testBackendConnection(ip).then(isValid => isValid ? ip : null)
    );
    
    const results = await Promise.all(promises);
    const foundIP = results.find(ip => ip !== null);
    
    if (foundIP) {
      return foundIP;
    }
  }

  return null;
};

/**
 * Main function to detect the backend IP address
 * @param {boolean} allowScanning - If true, scan network even without Expo IP (default: false)
 * Returns the IP address or null if not found
 */
export const detectBackendIP = async () => {
  console.log('🔍 Auto-detecting backend IP address...');

  // Method 1: Try to get from Expo connection (fastest and most reliable)
  const expoIP = getIPFromExpoConnection();
  console.log('🔍 Expo IP extraction result:', expoIP || 'NOT FOUND');
  
  if (expoIP) {
    console.log('📍 Found IP from Expo connection:', expoIP);
    
    // Test if backend is accessible at this IP
    console.log('🔍 Testing backend connection at:', expoIP);
    const isValid = await testBackendConnection(expoIP);
    
    if (isValid) {
      console.log('✅ Verified backend at:', expoIP);
      return expoIP;
    }
    
    // Health check failed - scan the Expo IP's subnet (this works for 172.x.x.x networks)
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

  // Method 2: No Expo IP - do a very quick limited scan (max 30 IPs, fail fast)
  console.log('⚠️ Expo IP not found, doing quick limited scan...');
  const scannedIP = await detectIPByScanning(null);
  if (scannedIP) {
    console.log('✅ Found backend at:', scannedIP);
    return scannedIP;
  }
  
  console.log('💡 Auto-detection failed. Check Expo terminal for your computer IP and enter it manually in Settings');
  return null;
};

/**
 * Get the backend URL with detected or fallback IP
 * IMPORTANT: This ALWAYS attempts full detection first before using any fallback.
 * Detection includes: Expo IP extraction → health check → subnet scanning.
 * Fallback is ONLY used if ALL detection methods fail.
 * 
 * @param {string} fallbackIP - IP to use ONLY if all detection fails (default: 192.168.1.128)
 * @returns {Promise<string>} Backend URL
 */
export const getBackendURL = async (fallbackIP = '192.168.1.128') => {
  // Always attempt detection first - never skip to fallback
  const detectedIP = await detectBackendIP();
  
  if (detectedIP) {
    const url = `http://${detectedIP}:8000`;
    console.log('✅ Using DETECTED backend URL:', url);
    return url;
  } else {
    // Only use fallback if ALL detection methods failed
    const url = `http://${fallbackIP}:8000`;
    console.log('⚠️ Using FALLBACK backend URL (all detection methods failed):', url);
    return url;
  }
};
