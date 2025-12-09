# Troubleshooting Guide

## Current Issues and Solutions

### Issue 1: HTTP 422 Error when Generating Content

**Symptoms:**
- App loads successfully
- Can scan notes or record audio
- Getting "HTTP error! status: 422" when trying to generate content

**Possible Causes:**
1. Network connectivity issue - phone can't reach backend
2. Request format issue
3. Backend not receiving JSON properly

**Solutions to Try:**

1. **Test Backend from Phone Browser:**
   - On your phone, open a web browser
   - Go to: `http://YOUR_IP:8000/` (replace YOUR_IP with your computer's IP)
   - Should see: `{"message":"Study Coach API is running","status":"healthy"}`
   - If this doesn't work, it's a network issue

2. **Check WiFi Connection:**
   - Ensure phone and computer are on the same WiFi network
   - Disable VPN if active
   - Try turning WiFi off and on

3. **Check Windows Firewall:**
   - Windows Defender Firewall might be blocking port 8000
   - Go to: Windows Defender Firewall → Advanced Settings → Inbound Rules
   - Create new rule for port 8000 (TCP) - allow connection

4. **Check Backend Logs:**
   ```powershell
   docker logs study-coach-backend --tail 50
   ```
   Look for the actual error message

### Issue 2: Network Request Failed

**Symptoms:**
- "Network request failed" error
- Cannot connect to backend

**Solutions:**
1. Verify backend is running: `docker ps` (should show study-coach-backend)
2. Test from phone browser (see above)
3. Check IP address is correct: `ipconfig` (look for WiFi adapter IP)
4. Update `mobile-app/services/api.js` with correct IP if needed

### Issue 3: Ollama Connection Error

**Symptoms:**
- Backend can't connect to Ollama
- Error: "500 Server Error: Internal Server Error for url: http://ollama:11434/api/generate"

**Solutions:**
1. Check Ollama is running: `docker ps` (should show study-coach-ollama)
2. Verify model is pulled: `docker exec study-coach-ollama ollama list`
3. Restart Ollama: `docker-compose restart ollama`
4. Test Ollama directly: `docker exec study-coach-ollama ollama run llama3 "Hello"`

## Quick Fixes

### Restart Everything
```powershell
# Stop all services
docker-compose down

# Start services
docker-compose up -d

# Pull model if needed
docker exec study-coach-ollama ollama pull llama3

# Restart backend
docker-compose restart backend
```

### Clear Expo Cache
```powershell
cd mobile-app
npx expo start --clear --tunnel --port 8082
```

### Update IP Address
If your computer's IP changed:
1. Run `ipconfig` to find new IP
2. Update `mobile-app/services/api.js` - change `API_BASE_URL`
3. Update `mobile-app/App.js` - change `API_BASE_URL` (if it exists there)
4. Restart Expo

## Testing Steps

1. **Test Backend Health:**
   ```powershell
   Invoke-WebRequest http://localhost:8000/
   ```

2. **Test from Phone Browser:**
   - Open: `http://YOUR_IP:8000/` (replace YOUR_IP with your computer's IP)
   - Should see API health message

3. **Test API Endpoint:**
   ```powershell
   $body = @{text="test"; content_type="summary"} | ConvertTo-Json
   Invoke-WebRequest -Uri "http://localhost:8000/api/generate-content" -Method POST -Body $body -ContentType "application/json"
   ```

4. **Check Expo Console:**
   - Look for detailed error messages
   - Check network requests in console

## Common Error Messages

- **422 Unprocessable Entity**: Request format issue or validation error
- **500 Internal Server Error**: Backend error (check logs)
- **Network request failed**: Can't reach backend (network/firewall issue)
- **TurboModule error**: App compatibility issue (should be fixed now)

### Issue 4: IP Auto-Detection Not Working

**Symptoms:**
- Auto-detection fails to find backend
- App shows "Could not automatically detect backend IP"
- Network scanning times out or finds nothing

**Why Auto-Detection Might Fail:**

1. **Expo IP Extraction Issues:**
   - Different Expo versions may expose connection info differently
   - Some devices/platforms (iOS vs Android) may not provide Expo connection details
   - The `global.__expo.manifestUrl` might not be available on all devices
   - Network configuration differences between devices

2. **Network Scanning Limitations:**
   - **Client Isolation**: Many university/corporate WiFi networks prevent devices from seeing each other
   - **Firewall Rules**: Some networks block port scanning or restrict device-to-device communication
   - **Different IP Ranges**: Not all networks use common ranges (192.168.x.x, 172.x.x.x, 10.x.x.x)
   - **Network Segmentation**: Devices might be on different subnets even on the same WiFi

3. **Platform Differences:**
   - iOS and Android handle network permissions differently
   - Some devices have stricter network security policies
   - VPNs can interfere with network detection

**Solutions:**

1. **Manual IP Entry (Recommended if auto-detection fails):**
   - Go to Settings in the app
   - Find your computer's IP address:
     - **Windows**: Run `ipconfig` in terminal, look for WiFi adapter IP
     - **Mac/Linux**: Run `ifconfig | grep "inet "` or `ip addr show`
   - Enter the IP address manually in the Settings screen
   - This is the most reliable method across all devices and networks

2. **Check Network Compatibility:**
   - Ensure both devices are on the same WiFi network
   - Disable VPN if active
   - Some networks (especially enterprise/university) have client isolation that prevents auto-detection
   - In these cases, manual IP entry is required

3. **Verify Backend Accessibility:**
   - Test from phone browser: `http://YOUR_COMPUTER_IP:8000/health`
   - If this works, the network is fine - just use manual entry
   - If this doesn't work, it's a network/firewall issue, not an auto-detection problem

4. **Network-Specific Notes:**
   - **Home WiFi**: Auto-detection usually works well
   - **University/Corporate WiFi**: Often has client isolation - use manual entry
   - **Mobile Hotspot**: Usually works, but IP might change frequently
   - **VPN Active**: Disable VPN for best results

## Still Having Issues?

1. Check all services are running: `docker ps`
2. Check backend logs: `docker logs study-coach-backend`
3. Check Ollama logs: `docker logs study-coach-ollama`
4. Verify network connectivity from phone
5. Check Windows Firewall settings
6. **If auto-detection fails, use manual IP entry in Settings - this works on all devices and networks**

