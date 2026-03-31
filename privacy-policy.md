# Privacy Policy for HopOff!

**Last Updated: March 31, 2026**

HopOff! ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.

---

## 1. Information We Collect

### Location Data

To provide the core functionality of location-based alarms, HopOff! requires access to your device's location.

- **Foreground Location:** Used to show your position on the map and search for nearby destinations.
- **Background Location:** Essential for triggering alarms when you approach your destination, even if the app is minimised or the screen is locked.

### Search and Destination Data

- When you search for a destination, your text query is sent to Nominatim (OpenStreetMap) for geocoding (converting a place name into coordinates).
- Your saved destinations and search history are stored locally on your device using SQLite and AsyncStorage. This data never leaves your device and is not accessible to us.

---

## 2. How We Use Your Information

- **Core Functionality:** To calculate the distance between your current location and your target stop.
- **Notifications:** To send local alerts and triggers when you enter a destination radius.
- **User Experience:** To remember your frequent stops for quicker access.
- **Map Rendering:** To display your current position and destination on the map via the Google Maps SDK.

---

## 3. Data Sharing

### Nominatim (OpenStreetMap)

We use Nominatim for geocoding services. When you search for a destination, your text query is sent to Nominatim's servers. Please refer to [OpenStreetMap's Privacy Policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy) for more details.

### Google Maps SDK

We use the Google Maps SDK for Android to render maps within the app. This SDK may automatically collect and transmit the following data to Google, independently of our app:

- Device metadata (OS version, device model, brand, and form factor)
- Crash metrics and stack traces
- IP address
- A pseudonymous Maps SDK identifier used to measure daily active SDK users

This data is used by Google to maintain and improve Google services and is governed by [Google's Privacy Policy](https://policies.google.com/privacy).

### No Commercial Sharing

We do not sell, trade, or share your location history or personal data with advertisers or third-party data brokers.

---

## 4. Data Retention

All your transit data (saved stops, history) resides strictly on your physical device. You can delete this data at any time by clearing the app cache or deleting specific entries within the app. We do not store any of your data on our servers.

---

## 5. Permissions

You can grant or revoke the following permissions at any time via your device settings:

- **Location:** Required for core alarm functionality.
- **Notifications:** Required to alert you when you arrive.

---

## 6. Children's Privacy

HopOff! is not directed at children under the age of 13. We do not knowingly collect personal information from children.

---

## 7. Contact Us

If you have any questions regarding this Privacy Policy, you may contact us at: [sanyam@sanyamchhabra.in](mailto:sanyam@sanyamchhabra.in)
