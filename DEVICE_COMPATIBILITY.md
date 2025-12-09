# Device & Network Compatibility Guide

## IP Auto-Detection Compatibility

The IP auto-detection feature works well in many scenarios, but there are some cases where it may not work automatically. This document explains the limitations and solutions.

## ✅ When Auto-Detection Usually Works

- **Home WiFi networks** - Most common home routers allow device-to-device communication
- **Mobile hotspots** - Personal mobile hotspots typically work well
- **Simple corporate networks** - Networks without client isolation

## ⚠️ When Auto-Detection May Fail

### 1. University/Enterprise WiFi Networks

**Why it fails:**
- **Client Isolation**: Many university networks prevent devices from seeing each other for security
- **Network Segmentation**: Devices might be on different VLANs/subnets even on the same WiFi
- **Firewall Rules**: Strict firewall policies block port scanning or device discovery
- **Network Authentication**: Some networks require special authentication that interferes with detection

**Solution:** Use **manual IP entry** in Settings (always works)

### 2. Different Devices/Platforms

**Potential Issues:**
- **Expo IP Extraction**: Different Expo versions or platforms may expose connection info differently
  - iOS vs Android might handle Expo connection details differently
  - Some devices don't provide `global.__expo.manifestUrl`
- **Network Permissions**: iOS and Android handle network permissions differently
- **Device-Specific Policies**: Some devices have stricter network security settings

**Solution:** Manual IP entry works on all devices

### 3. Network Configuration Differences

**Issues:**
- **Uncommon IP Ranges**: Not all networks use standard ranges (192.168.x.x, 172.x.x.x, 10.x.x.x)
- **Custom Subnets**: Some networks use non-standard subnet configurations
- **IPv6 Networks**: Current detection only supports IPv4
- **Multiple Network Interfaces**: Devices with multiple network adapters might confuse detection

**Solution:** Manual IP entry - just use your computer's actual IP

### 4. VPNs and Security Software

**Issues:**
- VPNs can route traffic differently, making detection unreliable
- Corporate VPNs might isolate devices
- Firewall software can block network scanning

**Solution:** Disable VPN temporarily or use manual IP entry

## 🎯 Reliable Solution: Manual IP Entry

**Manual IP entry works on ALL devices and networks.** It's the most reliable method.

### How to Get Your Computer's IP:

**Windows:**
```powershell
ipconfig
# Look for "Wireless LAN adapter Wi-Fi" section
# Find "IPv4 Address" - that's your IP (e.g., 192.168.1.100)
```

**Mac/Linux:**
```bash
ifconfig | grep "inet "
# Or:
ip addr show
# Look for your WiFi adapter's IP address
```

**Then:**
1. Open the app
2. Go to Settings (⚙️ button)
3. Enter your IP address (e.g., `192.168.1.100`)
4. Tap "Save" or "Test Connection"

## 📱 Device-Specific Notes

### iOS Devices
- Network permissions are generally more restrictive
- Some network features require explicit permissions
- Manual entry is recommended for enterprise networks

### Android Devices
- Generally more flexible with network access
- Some manufacturers add additional security layers
- VPN apps can interfere with detection

## 🔧 Best Practices

1. **First Time Setup:**
   - Try auto-detection first (it's fastest)
   - If it fails or takes too long, use manual entry

2. **University/Enterprise Networks:**
   - Skip auto-detection - use manual entry directly
   - Much faster and more reliable

3. **Network Changes:**
   - If you switch WiFi networks, you'll need to update the IP
   - The app doesn't auto-detect on network changes (only on startup)
   - Just update it in Settings when you change networks

4. **Testing:**
   - Before using the app, test from your phone's browser:
   - Go to: `http://YOUR_COMPUTER_IP:8000/health`
   - If this works, the IP is correct
   - If it doesn't work, check firewall/network settings

## 🚨 Common Error Messages

**"Could not automatically detect backend IP"**
- **Meaning:** Auto-detection failed
- **Solution:** Use manual IP entry in Settings

**"Network request timed out"**
- **Meaning:** Can't connect to backend at detected IP
- **Solution:** The auto-detected IP might be wrong - use manual entry

**"Backend not responding"**
- **Meaning:** Backend is not accessible (might be wrong IP, firewall, or backend not running)
- **Solution:** 
  1. Verify backend is running (`docker ps`)
  2. Check IP is correct (test in browser)
  3. Check firewall settings

## 💡 Summary

- **Auto-detection works well** on simple networks (home WiFi, mobile hotspots)
- **Auto-detection may fail** on complex networks (university, enterprise, VPNs)
- **Manual IP entry** works on **all devices and networks** - it's the most reliable method
- The app always provides the option to manually enter the IP address
- When in doubt, use manual entry - it's simple and always works

## 📞 Need Help?

1. Check `TROUBLESHOOTING.md` for detailed solutions
2. Try manual IP entry first - it's the most reliable
3. Test backend connectivity from your phone's browser
4. Check that backend is running and accessible

